import { Router, Response } from 'express';
import { prisma } from '../server';
import { z } from 'zod';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const movementSchema = z.object({
  productId: z.number().int().positive(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  reason: z.string().optional(),
  reference: z.string().optional(),
  performedBy: z.string().default('Sistema')
});

// GET movements (with filtering)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { productId, type, startDate, endDate, page, limit } = req.query;

    const where: any = { userId: req.user!.id };

    if (productId) where.productId = Number(productId);
    if (type) where.type = String(type);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const pageNum = Number(page) || 1;
    const pageSize = Number(limit) || 50;

    const [movements, total] = await Promise.all([
      prisma.movement.findMany({
        where,
        include: { product: { include: { category: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize
      }),
      prisma.movement.count({ where })
    ]);

    res.json({
      data: movements,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    res.status(500).json({ error: 'Erro ao buscar movimentações' });
  }
});

// POST create movement
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = movementSchema.parse(req.body);

    // Get current product
    const product = await prisma.product.findFirst({
      where: { id: data.productId, userId: req.user!.id }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Calculate new quantity
    let newQuantity = product.quantity;
    if (data.type === 'IN') {
      newQuantity += data.quantity;
    } else if (data.type === 'OUT') {
      newQuantity -= data.quantity;
      if (newQuantity < 0) {
        return res.status(400).json({
          error: `Estoque insuficiente. Disponível: ${product.quantity} ${product.unit}`
        });
      }
    } else {
      // ADJUSTMENT - set directly
      newQuantity = data.quantity;
    }

    // Create movement and update product atomically
    const [movement, updatedProduct] = await prisma.$transaction([
      prisma.movement.create({
        data: { ...data, userId: req.user!.id },
        include: { product: { include: { category: true } } }
      }),
      prisma.product.update({
        where: { id: data.productId },
        data: { quantity: newQuantity },
        include: { category: true }
      })
    ]);

    const io: SocketIOServer = req.app.get('io');
    io.emit(`movement-created-${req.user!.id}`, movement);
    io.emit(`product-updated-${req.user!.id}`, updatedProduct);

    res.status(201).json(movement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao registrar movimentação:', error);
    res.status(500).json({ error: 'Erro ao registrar movimentação' });
  }
});

export { router as movementRoutes };
