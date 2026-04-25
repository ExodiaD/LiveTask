import { Router, Response } from 'express';
import { prisma } from '../server';
import { z } from 'zod';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  categoryId: z.number().int().positive(),
  quantity: z.number().int().min(0).default(0),
  minQuantity: z.number().int().min(0).default(10),
  maxQuantity: z.number().int().min(1).default(1000),
  unit: z.string().default('un'),
  costPrice: z.number().min(0).default(0),
  salePrice: z.number().min(0).default(0),
  expirationDate: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true)
});

// GET all products
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, status, sortBy, order, page, limit } = req.query;

    const where: any = { userId: req.user!.id };

    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { sku: { contains: String(search) } },
        { description: { contains: String(search) } },
        { supplier: { contains: String(search) } }
      ];
    }

    if (category) {
      where.categoryId = Number(category);
    }

    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const orderBy: any = {};
    if (sortBy) {
      orderBy[String(sortBy)] = order === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.updatedAt = 'desc';
    }

    const pageNum = Number(page) || 1;
    const pageSize = Number(limit) || 50;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize
      }),
      prisma.product.count({ where })
    ]);

    let filteredProducts = products;
    if (status === 'low_stock') {
      filteredProducts = products.filter(p => p.quantity <= p.minQuantity);
    }
    if (status === 'expiring') {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      filteredProducts = products.filter(p => 
        p.expirationDate && p.expirationDate <= thirtyDaysFromNow && p.expirationDate > new Date()
      );
    }

    res.json({
      data: filteredProducts,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// GET single product
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: Number(req.params.id), userId: req.user!.id },
      include: {
        category: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 20 },
        alerts: { where: { isDismissed: false }, orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json(product);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// POST create product
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = productSchema.parse(req.body);

    const product = await prisma.product.create({
      data: {
        ...data,
        userId: req.user!.id,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null
      },
      include: { category: true }
    });

    if (data.quantity > 0) {
      await prisma.movement.create({
        data: {
          productId: product.id,
          userId: req.user!.id,
          type: 'IN',
          quantity: data.quantity,
          reason: 'Estoque inicial',
          performedBy: 'Sistema'
        }
      });
    }

    const io: SocketIOServer = req.app.get('io');
    io.emit(`product-created-${req.user!.id}`, product);

    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

// PUT update product
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = productSchema.partial().parse(req.body);

    const existing = await prisma.product.findFirst({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...data,
        expirationDate: data.expirationDate !== undefined
          ? (data.expirationDate ? new Date(data.expirationDate) : null)
          : undefined
      },
      include: { category: true }
    });

    if (data.quantity !== undefined && data.quantity !== existing.quantity) {
      const diff = data.quantity - existing.quantity;
      await prisma.movement.create({
        data: {
          productId: product.id,
          userId: req.user!.id,
          type: diff > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(diff),
          reason: 'Ajuste manual via edição',
          performedBy: 'Sistema'
        }
      });
    }

    const io: SocketIOServer = req.app.get('io');
    io.emit(`product-updated-${req.user!.id}`, product);

    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// DELETE product
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findFirst({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });

    await prisma.movement.deleteMany({ where: { productId: existing.id } });
    await prisma.alert.deleteMany({ where: { productId: existing.id } });
    await prisma.product.delete({ where: { id: existing.id } });

    const io: SocketIOServer = req.app.get('io');
    io.emit(`product-deleted-${req.user!.id}`, { id: existing.id });

    res.json({ message: 'Produto excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ error: 'Erro ao excluir produto' });
  }
});

export { router as productRoutes };
