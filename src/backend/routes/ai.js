import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { pool } from '../db.js';
import { generateFinancialInsight } from '../services/ai.js';
import { audit } from '../services/audit.js';

const router = Router();
const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'AI request limit reached. Try again later.' } });
router.use(authenticate);
router.use(aiLimiter);

router.post('/insights', [body('question').optional().trim().isLength({ max: 1000 })], validate, async (req, res, next) => {
  try {
    const [transactions] = await pool.execute(
      `SELECT type, amount, category, description, transaction_date
       FROM transactions WHERE user_id=? ORDER BY transaction_date DESC LIMIT 100`,
      [req.user.id]
    );
    const [budgets] = await pool.execute(
      `SELECT b.category, b.amount, b.start_date, b.end_date,
       COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END),0) spent
       FROM budgets b
       LEFT JOIN transactions t
         ON t.user_id=b.user_id AND t.category=b.category
         AND t.transaction_date BETWEEN b.start_date AND b.end_date
       WHERE b.user_id=? GROUP BY b.id`,
      [req.user.id]
    );

    const income = transactions.filter(t => t.type === 'INCOME').reduce((s,t) => s + Number(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + Number(t.amount), 0);

    const result = await generateFinancialInsight({
      summary: { income, expenses, balance: income - expenses },
      transactions,
      budgets,
      question: req.body.question
    });

    await audit(req, 'AI_INSIGHT_REQUEST', 'ai');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
