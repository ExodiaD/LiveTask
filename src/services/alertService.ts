import { PrismaClient, Prisma } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

const EXPIRY_WARNING_DAYS = 30; // Alert 30 days before expiry
const CRITICAL_EXPIRY_DAYS = 7; // Critical alert 7 days before

export async function checkAlerts(prisma: PrismaClient, io: SocketIOServer) {
  const now = new Date();
  const warningDate = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  const criticalDate = new Date(now.getTime() + CRITICAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const allActiveProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true }
  });

  const lowStock = allActiveProducts.filter(p => p.quantity <= p.minQuantity);
  const overStock = allActiveProducts.filter(p => p.quantity > p.maxQuantity);

  const expiringProducts = allActiveProducts.filter(p => {
    if (!p.expirationDate) return false;
    return p.expirationDate <= warningDate && p.expirationDate > now;
  });

  const expiredProducts = allActiveProducts.filter(p => {
    if (!p.expirationDate) return false;
    return p.expirationDate <= now;
  });

  // Group alerts by user to emit them properly
  const alertsByUser: Record<number, any[]> = {};

  const addAlertForUser = (userId: number, alert: any) => {
    if (!alertsByUser[userId]) alertsByUser[userId] = [];
    alertsByUser[userId].push(alert);
  };

  // Process low stock alerts
  for (const product of lowStock) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        productId: product.id,
        type: 'LOW_STOCK',
        isDismissed: false,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    if (!existingAlert) {
      const severity = product.quantity === 0 ? 'critical' : 'warning';
      const alert = await prisma.alert.create({
        data: {
          productId: product.id,
          userId: product.userId,
          type: 'LOW_STOCK',
          severity,
          message: product.quantity === 0
            ? `⚠️ SEM ESTOQUE: "${product.name}" está com estoque zerado!`
            : `📉 Estoque baixo: "${product.name}" - ${product.quantity}/${product.minQuantity} ${product.unit}`
        },
        include: { product: { include: { category: true } } }
      });
      addAlertForUser(product.userId, alert);
    }
  }

  // Process expired product alerts
  for (const product of expiredProducts) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        productId: product.id,
        type: 'EXPIRED',
        isDismissed: false,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    if (!existingAlert) {
      const alert = await prisma.alert.create({
        data: {
          productId: product.id,
          userId: product.userId,
          type: 'EXPIRED',
          severity: 'critical',
          message: `🚨 VENCIDO: "${product.name}" venceu em ${product.expirationDate!.toLocaleDateString('pt-BR')}`
        },
        include: { product: { include: { category: true } } }
      });
      addAlertForUser(product.userId, alert);
    }
  }

  // Process expiring product alerts
  for (const product of expiringProducts) {
    const daysUntilExpiry = Math.ceil((product.expirationDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const severity = daysUntilExpiry <= CRITICAL_EXPIRY_DAYS ? 'critical' : 'warning';

    const existingAlert = await prisma.alert.findFirst({
      where: {
        productId: product.id,
        type: 'EXPIRING',
        isDismissed: false,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    if (!existingAlert) {
      const alert = await prisma.alert.create({
        data: {
          productId: product.id,
          userId: product.userId,
          type: 'EXPIRING',
          severity,
          message: `⏰ Vencimento próximo: "${product.name}" vence em ${daysUntilExpiry} dia(s)`
        },
        include: { product: { include: { category: true } } }
      });
      addAlertForUser(product.userId, alert);
    }
  }

  // Process overstock alerts
  for (const product of overStock) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        productId: product.id,
        type: 'OVERSTOCK',
        isDismissed: false,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    });

    if (!existingAlert) {
      const alert = await prisma.alert.create({
        data: {
          productId: product.id,
          userId: product.userId,
          type: 'OVERSTOCK',
          severity: 'info',
          message: `📈 Excesso de estoque: "${product.name}" - ${product.quantity}/${product.maxQuantity} ${product.unit}`
        },
        include: { product: { include: { category: true } } }
      });
      addAlertForUser(product.userId, alert);
    }
  }

  // Emit new alerts via WebSocket per user
  for (const [userId, userAlerts] of Object.entries(alertsByUser)) {
    if (userAlerts.length > 0) {
      io.emit(`new-alerts-${userId}`, userAlerts);
      
      const unreadCount = await prisma.alert.count({
        where: { userId: Number(userId), isRead: false, isDismissed: false }
      });
      io.emit(`alert-count-${userId}`, unreadCount);
    }
  }
}
