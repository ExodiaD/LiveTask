import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados (LiveTask)...');

  // Clear existing data
  await prisma.alert.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('123456', 10);

  // Create Users
  const storeUser = await prisma.user.create({
    data: {
      name: 'Minha Loja',
      email: 'loja@livetask.com',
      password,
      accountType: 'STORE'
    }
  });

  const homeUser = await prisma.user.create({
    data: {
      name: 'Minha Casa',
      email: 'casa@livetask.com',
      password,
      accountType: 'HOME'
    }
  });

  console.log('✅ Usuários criados: loja@livetask.com / casa@livetask.com (Senha: 123456)');

  // Categories for STORE
  const storeCats = await Promise.all([
    prisma.category.create({ data: { name: 'Alimentos', color: '#f59e0b', icon: '🍎', userId: storeUser.id } }),
    prisma.category.create({ data: { name: 'Eletrônicos', color: '#ef4444', icon: '💻', userId: storeUser.id } })
  ]);

  // Categories for HOME
  const homeCats = await Promise.all([
    prisma.category.create({ data: { name: 'Despensa', color: '#f59e0b', icon: '🥫', userId: homeUser.id } }),
    prisma.category.create({ data: { name: 'Limpeza', color: '#10b981', icon: '🧹', userId: homeUser.id } })
  ]);

  const now = new Date();
  const daysMs = 24 * 60 * 60 * 1000;

  // STORE Products
  const storeProducts = [
    {
      name: 'Arroz 5kg',
      sku: 'ALM-001',
      description: 'Arroz branco 5kg',
      categoryId: storeCats[0].id,
      userId: storeUser.id,
      quantity: 45,
      minQuantity: 20,
      maxQuantity: 200,
      unit: 'pct',
      costPrice: 18.50,
      salePrice: 24.90,
      expirationDate: new Date(now.getTime() + 180 * daysMs)
    },
    {
      name: 'Cabo USB-C',
      sku: 'ELE-001',
      description: 'Cabo 1 metro',
      categoryId: storeCats[1].id,
      userId: storeUser.id,
      quantity: 5,
      minQuantity: 10,
      maxQuantity: 50,
      unit: 'un',
      costPrice: 10.00,
      salePrice: 25.00
    }
  ];

  for (const data of storeProducts) {
    const p = await prisma.product.create({ data });
    await prisma.movement.create({
      data: { productId: p.id, userId: storeUser.id, type: 'IN', quantity: data.quantity, reason: 'Estoque inicial' }
    });
  }

  // HOME Products
  const homeProducts = [
    {
      name: 'Feijão',
      categoryId: homeCats[0].id,
      userId: homeUser.id,
      quantity: 2,
      minQuantity: 1,
      maxQuantity: 10,
      unit: 'pct',
      expirationDate: new Date(now.getTime() + 30 * daysMs)
    },
    {
      name: 'Detergente',
      categoryId: homeCats[1].id,
      userId: homeUser.id,
      quantity: 0,
      minQuantity: 2,
      maxQuantity: 10,
      unit: 'un'
    }
  ];

  for (const data of homeProducts) {
    const p = await prisma.product.create({ data });
    if(data.quantity > 0) {
      await prisma.movement.create({
        data: { productId: p.id, userId: homeUser.id, type: 'IN', quantity: data.quantity, reason: 'Compra mercado' }
      });
    }
  }

  console.log('🎉 Seed concluído com sucesso!');
}

seed()
  .catch((error) => {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
