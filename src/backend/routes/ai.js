import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { pool } from '../db.js';
import { generateAssistantReply } from '../ai-assistant/assistant.js';import { audit } from '../services/audit.js';
const router = Router();
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'AI request limit reached. Try again later.' }
});
router.use(authenticate);
router.use(aiLimiter);

const chatRules = [
  body('question').isString().trim().isLength({ min: 1, max: 1000 }),
  body('history').optional().isArray({ max: 8 }),
  body('history').optional().custom(history =>
    Array.isArray(history) && history.every(message =>
      message &&
      ['user', 'assistant'].includes(message.role) &&
      typeof message.content === 'string' &&
      message.content.trim().length > 0 &&
      message.content.length <= 1000
    )
  ).withMessage('Chat history must contain only short user and assistant messages')
];

async function getFinancialProfile(userId) {
  const [totalsRows] = await pool.execute(
    `SELECT COUNT(*) AS transaction_count,
      COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE 0 END),0) AS income,
      COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END),0) AS expenses
     FROM transactions
     WHERE user_id=? AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       AND transaction_date <= CURDATE()`,
    [userId]
  );
  const [categoryRows] = await pool.execute(
    `SELECT category, COALESCE(SUM(amount),0) AS amount
     FROM transactions
     WHERE user_id=? AND type='EXPENSE'
       AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       AND transaction_date <= CURDATE()
     GROUP BY category ORDER BY amount DESC LIMIT 20`,
    [userId]
  );
  const [monthlyRows] = await pool.execute(
    `SELECT DATE_FORMAT(transaction_date,'%Y-%m') AS month,
      COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE 0 END),0) AS income,
      COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END),0) AS expenses
     FROM transactions
     WHERE user_id=? AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       AND transaction_date <= CURDATE()
     GROUP BY DATE_FORMAT(transaction_date,'%Y-%m')
     ORDER BY month ASC`,
    [userId]
  );
  const [budgetRows] = await pool.execute(
    `SELECT b.category, b.amount, b.start_date, b.end_date,
       COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END),0) AS spent
     FROM budgets b
     LEFT JOIN transactions t
       ON t.user_id=b.user_id AND t.category=b.category
       AND t.transaction_date BETWEEN b.start_date AND b.end_date
     WHERE b.user_id=? AND b.start_date <= CURDATE()
       AND b.end_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
     GROUP BY b.id
     ORDER BY b.end_date ASC LIMIT 20`,
    [userId]
  );

  const income = Number(totalsRows[0].income);
  const expenses = Number(totalsRows[0].expenses);
  return {
    periodDays: 90,
    transactionCount: Number(totalsRows[0].transaction_count),
    summary: { income, expenses, balance: income - expenses },
    expenseByCategory: categoryRows.map(row => ({
      category: row.category,
      amount: Number(row.amount)
    })),
    monthly: monthlyRows.map(row => ({
      month: row.month,
      income: Number(row.income),
      expenses: Number(row.expenses)
    })),
    budgets: budgetRows.map(row => ({
      category: row.category,
      amount: Number(row.amount),
      spent: Number(row.spent)
    }))
  };
}

router.post('/chat', chatRules, validate, async (req, res, next) => {
  try {
    const financialProfile = await getFinancialProfile(req.user.id);
    const history = (req.body.history || []).map(({ role, content }) => ({
      role,
      content: content.trim()
    }));
    const result = await generateAssistantReply({
      question: req.body.question.trim(),
      history,
      financialProfile
    });

    await audit(req, 'AI_CHAT_MESSAGE', 'ai');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/insights', [
  body('question').optional().isString().trim().isLength({ max: 1000 })
], validate, async (req, res, next) => {
  try {
    const result = await generateAssistantReply({
      question: req.body.question?.trim() || 'Analyze my recent spending and suggest practical improvements.',
      history: [],
      financialProfile: await getFinancialProfile(req.user.id)
    });

    await audit(req, 'AI_INSIGHT_REQUEST', 'ai');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
