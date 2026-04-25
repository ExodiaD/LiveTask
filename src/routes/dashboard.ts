import { Router, Response } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET dashboard stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const allProducts = await prisma.product.findMany({
      where: { isActive: true, userId: req.user!.id },
      include: { category: true }
    });

    const totalProducts = allProducts.length;
    const totalItems = allProducts.reduce((sum, p) => sum + p.quantity, 0);
    const totalValue = allProducts.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0);
    const totalSaleValue = allProducts.reduce((sum, p) => sum + (p.quantity * p.salePrice), 0);
    const lowStock = allProducts.filter(p => p.quantity <= p.minQuantity).length;
    const outOfStock = allProducts.filter(p => p.quantity === 0).length;
    const expiringSoon = allProducts.filter(p => 
      p.expirationDate && p.expirationDate <= thirtyDaysFromNow && p.expirationDate > now
    ).length;
    const expired = allProducts.filter(p =>
      p.expirationDate && p.expirationDate <= now
    ).length;

    // Recent movements
    const recentMovements = await prisma.movement.count({
      where: { userId: req.user!.id, createdAt: { gte: thirtyDaysAgo } }
    });

    const movementsIn = await prisma.movement.count({
      where: { userId: req.user!.id, type: 'IN', createdAt: { gte: thirtyDaysAgo } }
    });

    const movementsOut = await prisma.movement.count({
      where: { userId: req.user!.id, type: 'OUT', createdAt: { gte: thirtyDaysAgo } }
    });

    // Unread alerts
    const unreadAlerts = await prisma.alert.count({
      where: { userId: req.user!.id, isRead: false, isDismissed: false }
    });

    // Category breakdown
    const categoryBreakdown = await prisma.category.findMany({
      where: { userId: req.user!.id },
      include: {
        _count: { select: { products: true } },
        products: {
          where: { isActive: true },
          select: { quantity: true, costPrice: true }
        }
      }
    });

    const categories = categoryBreakdown.map(cat => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      productCount: cat._count.products,
      totalItems: cat.products.reduce((sum, p) => sum + p.quantity, 0),
      totalValue: cat.products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0)
    }));

    res.json({
      totalProducts,
      totalItems,
      totalValue,
      totalSaleValue,
      lowStock,
      outOfStock,
      expiringSoon,
      expired,
      recentMovements,
      movementsIn,
      movementsOut,
      unreadAlerts,
      categories
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// GET movement history for charts
router.get('/movements-chart', async (req: AuthRequest, res: Response) => {
  try {
    const days = Number(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const movements = await prisma.movement.findMany({
      where: { userId: req.user!.id, createdAt: { gte: startDate } },
      orderBy: { createdAt: 'asc' },
      select: {
        type: true,
        quantity: true,
        createdAt: true
      }
    });

    // Group by day
    const grouped: Record<string, { in: number; out: number; adjustment: number }> = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      grouped[key] = { in: 0, out: 0, adjustment: 0 };
    }

    movements.forEach(m => {
      const key = m.createdAt.toISOString().split('T')[0];
      if (grouped[key]) {
        if (m.type === 'IN') grouped[key].in += m.quantity;
        else if (m.type === 'OUT') grouped[key].out += m.quantity;
        else grouped[key].adjustment += m.quantity;
      }
    });

    const chartData = Object.entries(grouped).map(([date, data]) => ({
      date,
      ...data
    }));

    res.json(chartData);
  } catch (error) {
    console.error('Erro ao buscar dados do gráfico:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do gráfico' });
  }
});

// GET top products by turnover
router.get('/top-products', async (req: AuthRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: { isActive: true, userId: req.user!.id },
      include: {
        category: true,
        movements: {
          where: {
            type: 'OUT',
            createdAt: { gte: thirtyDaysAgo }
          }
        }
      }
    });

    const topProducts = products
      .map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        categoryColor: p.category.color,
        quantity: p.quantity,
        totalOut: p.movements.reduce((sum, m) => sum + m.quantity, 0),
        turnoverRate: p.quantity > 0
          ? p.movements.reduce((sum, m) => sum + m.quantity, 0) / p.quantity
          : 0
      }))
      .sort((a, b) => b.totalOut - a.totalOut)
      .slice(0, 10);

    res.json(topProducts);
  } catch (error) {
    console.error('Erro ao buscar top produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar top produtos' });
  }
});

// GET expiring products list
router.get('/expiring', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: {
        userId: req.user!.id,
        isActive: true,
        expirationDate: {
          lte: sixtyDaysFromNow
        }
      },
      include: { category: true },
      orderBy: { expirationDate: 'asc' }
    });

    const result = products.map(p => {
      const daysUntilExpiry = p.expirationDate
        ? Math.ceil((p.expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      return {
        ...p,
        daysUntilExpiry,
        status: daysUntilExpiry !== null
          ? (daysUntilExpiry <= 0 ? 'expired' : daysUntilExpiry <= 7 ? 'critical' : 'warning')
          : 'ok'
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Erro ao buscar produtos vencendo:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos vencendo' });
  }
});

export { router as dashboardRoutes };
