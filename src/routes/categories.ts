
import { Router, Response } from 'express';
import { prisma } from '../server';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  color: z.string().default('#6366f1'),
  icon: z.string().default('📦')
});

// GET all categories
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.id },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// POST create category
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({ 
      data: { ...data, userId: req.user!.id } 
    });
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// PUT update category
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const existing = await prisma.category.findFirst({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

    const category = await prisma.category.update({
      where: { id: existing.id },
      data
    });
    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// DELETE category
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.category.findFirst({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

    const productCount = await prisma.product.count({
      where: { categoryId: existing.id }
    });

    if (productCount > 0) {
      return res.status(400).json({
        error: `Não é possível excluir: ${productCount} produto(s) associado(s)`
      });
    }

    await prisma.category.delete({ where: { id: existing.id } });
    res.json({ message: 'Categoria excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    res.status(500).json({ error: 'Erro ao excluir categoria' });
  }
});

export { router as categoryRoutes };
