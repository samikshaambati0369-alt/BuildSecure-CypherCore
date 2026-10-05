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
import { enforceBrowserOrigin, requireSecureConfig } from './middleware/security.js';

dotenv.config();
requireSecureConfig();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(enforceBrowserOrigin);
app.use(express.json({ limit: '50kb', strict: true }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
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
  console.log(`FinTrack API listening on port ${PORT}`);
});
