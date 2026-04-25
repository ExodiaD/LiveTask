import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'livetask_super_secret';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Limite de 10 requisições por IP
  message: { error: 'Muitas tentativas. Tente novamente mais tarde.' }
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter um caractere especial'),
  accountType: z.enum(['HOME', 'STORE'])
});

router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        accountType: data.accountType
      }
    });

    // Create default categories based on account type
    const defaultCategories = data.accountType === 'STORE' 
      ? [
          { name: 'Geral', color: '#6366f1', icon: '📦', userId: user.id },
          { name: 'Eletrônicos', color: '#ef4444', icon: '💻', userId: user.id }
        ]
      : [
          { name: 'Despensa', color: '#f59e0b', icon: '🥫', userId: user.id },
          { name: 'Limpeza', color: '#10b981', icon: '🧹', userId: user.id }
        ];

    await prisma.category.createMany({ data: defaultCategories });

    const token = jwt.sign({ userId: user.id, role: user.accountType }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.accountType }, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msgs = error.errors.map(e => e.message).join(' | ');
      return res.status(400).json({ error: msgs });
    }
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ userId: user.id, role: user.accountType }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.accountType }, token });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao realizar login' });
  }
});

export { router as authRoutes };
