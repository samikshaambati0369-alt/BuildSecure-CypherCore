import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import budgetRoutes from './routes/budgets.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';
import reportRoutes from './routes/reports.js';
import { notFound, errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

app.get('/api/health', (req, res) => res.json({ success: true, service: 'FinTrack API' }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`FinTrack API running on http://localhost:${PORT}`);
});
