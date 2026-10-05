import { Router } from 'express';
import { body, param } from 'express-validator';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT b.id, b.category, b.amount, b.period, b.start_date, b.end_date,
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END),0) AS spent
      FROM budgets b
      LEFT JOIN transactions t
        ON t.user_id=b.user_id AND t.category=b.category
        AND t.transaction_date BETWEEN b.start_date AND b.end_date
      WHERE b.user_id=?
      GROUP BY b.id
      ORDER BY b.start_date DESC, b.id DESC
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/', [
  body('category').trim().isLength({ min: 1, max: 80 }),
  body('amount').isFloat({ min: 0.01, max: 999999999 }),
  body('period').isIn(['MONTHLY','WEEKLY','CUSTOM']),
  body('start_date').isISO8601(),
  body('end_date').isISO8601()
], validate, async (req, res, next) => {
  try {
    const { category, amount, period, start_date, end_date } = req.body;
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }
    const [result] = await pool.execute(
      `INSERT INTO budgets (user_id, category, amount, period, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, category, amount, period, start_date, end_date]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) { next(err); }
});

router.delete('/:id', [param('id').isInt({ min: 1 })], validate, async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM budgets WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Budget not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
