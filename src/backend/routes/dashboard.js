import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { pool } from '../db.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const [summaryRows] = await pool.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE 0 END),0) income,
        COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END),0) expenses
      FROM transactions WHERE user_id=?
    `, [req.user.id]);

    const [categoryRows] = await pool.execute(`
      SELECT category, COALESCE(SUM(amount),0) total
      FROM transactions
      WHERE user_id=? AND type='EXPENSE'
      GROUP BY category
      ORDER BY total DESC
    `, [req.user.id]);

    const [recentRows] = await pool.execute(`
      SELECT id, type, amount, category, description, transaction_date
      FROM transactions WHERE user_id=?
      ORDER BY transaction_date DESC, id DESC LIMIT 8
    `, [req.user.id]);

    const [budgetRows] = await pool.execute(`
      SELECT b.id, b.category, b.amount, b.start_date, b.end_date,
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END),0) spent
      FROM budgets b
      LEFT JOIN transactions t
        ON t.user_id=b.user_id AND t.category=b.category
        AND t.transaction_date BETWEEN b.start_date AND b.end_date
      WHERE b.user_id=? GROUP BY b.id ORDER BY b.start_date DESC
    `, [req.user.id]);

    const income = Number(summaryRows[0].income);
    const expenses = Number(summaryRows[0].expenses);
    res.json({
      success: true,
      data: {
        summary: { income, expenses, balance: income - expenses },
        categories: categoryRows.map(x => ({ category: x.category, total: Number(x.total) })),
        recent: recentRows,
        budgets: budgetRows.map(x => ({ ...x, amount: Number(x.amount), spent: Number(x.spent) }))
      }
    });
  } catch (err) { next(err); }
});

export default router;
