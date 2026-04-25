import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { productRoutes } from './routes/products';
import { categoryRoutes } from './routes/categories';
import { movementRoutes } from './routes/movements';
import { alertRoutes } from './routes/alerts';
import { dashboardRoutes } from './routes/dashboard';
import { authRoutes } from './routes/auth';
import { authMiddleware } from './middleware/auth';
import { checkAlerts } from './services/alertService';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

export const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/categories', authMiddleware, categoryRoutes);
app.use('/api/movements', authMiddleware, movementRoutes);
app.use('/api/alerts', authMiddleware, alertRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);

// WebSocket connections
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// Cron job: check alerts every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  try {
    await checkAlerts(prisma, io);
  } catch (error) {
    console.error('Erro no cron de alertas:', error);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  📦 Gerenciador de Inventário em Tempo Real  ║
  ║                                              ║
  ║  🌐 API:       http://localhost:${PORT}          ║
  ║  📊 Frontend:  http://localhost:3001          ║
  ║  🔌 WebSocket: ws://localhost:${PORT}            ║
  ╚══════════════════════════════════════════════╝
  `);
  
  // Initial alert check is skipped here because it runs on cron now
});
