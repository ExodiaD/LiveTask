import { Router, Response } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET all alerts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type, severity, unreadOnly } = req.query;

    const where: any = { isDismissed: false, userId: req.user!.id };

    if (type) where.type = String(type);
    if (severity) where.severity = String(severity);
    if (unreadOnly === 'true') where.isRead = false;

    const alerts = await prisma.alert.findMany({
      where,
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(alerts);
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
});

// GET unread alert count
router.get('/count', async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.alert.count({
      where: { isRead: false, isDismissed: false, userId: req.user!.id }
    });
    res.json({ count });
  } catch (error) {
    console.error('Erro ao contar alertas:', error);
    res.status(500).json({ error: 'Erro ao contar alertas' });
  }
});

// PATCH mark alert as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.alert.findFirst({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!existing) return res.status(404).json({ error: 'Alerta não encontrado' });

    const alert = await prisma.alert.update({
      where: { id: existing.id },
      data: { isRead: true }
    });
    res.json(alert);
  } catch (error) {
    console.error('Erro ao marcar alerta como lido:', error);
    res.status(500).json({ error: 'Erro ao marcar alerta como lido' });
  }
});

// PATCH mark all alerts as read
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.alert.updateMany({
      where: { isRead: false, isDismissed: false, userId: req.user!.id },
      data: { isRead: true }
    });
    res.json({ message: 'Todos os alertas marcados como lidos' });
  } catch (error) {
    console.error('Erro ao marcar alertas como lidos:', error);
    res.status(500).json({ error: 'Erro ao marcar alertas como lidos' });
  }
});

// PATCH dismiss alert
router.patch('/:id/dismiss', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.alert.findFirst({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!existing) return res.status(404).json({ error: 'Alerta não encontrado' });

    const alert = await prisma.alert.update({
      where: { id: existing.id },
      data: { isDismissed: true }
    });
    res.json(alert);
  } catch (error) {
    console.error('Erro ao dispensar alerta:', error);
    res.status(500).json({ error: 'Erro ao dispensar alerta' });
  }
});

export { router as alertRoutes };
