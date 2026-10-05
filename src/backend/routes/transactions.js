import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { audit } from '../services/audit.js';

const router = Router();
router.use(authenticate);

const common = [
  body('type').isIn(['INCOME','EXPENSE']),
  body('amount').isFloat({ min: 0.01, max: 999999999 }),
  body('category').trim().isLength({ min: 1, max: 80 }),
  body('description').optional().trim().isLength({ max: 255 }),
  body('transaction_date').isISO8601()
];

router.get('/', [
  query('type').optional().isIn(['INCOME','EXPENSE']),
  query('category').optional().trim().isLength({ max: 80 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], validate, async (req, res, next) => {
  try {
    const conditions = ['user_id = ?'];
    const params = [req.user.id];

    if (req.query.type) { conditions.push('type = ?'); params.push(req.query.type); }
    if (req.query.category) { conditions.push('category = ?'); params.push(req.query.category); }
    if (req.query.from) { conditions.push('transaction_date >= ?'); params.push(req.query.from); }
    if (req.query.to) { conditions.push('transaction_date <= ?'); params.push(req.query.to); }

    const [rows] = await pool.execute(
      `SELECT id, type, amount, category, description, transaction_date, created_at, updated_at
       FROM transactions WHERE ${conditions.join(' AND ')}
       ORDER BY transaction_date DESC, id DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/', common, validate, async (req, res, next) => {
  try {
    const { type, amount, category, description = '', transaction_date } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO transactions (user_id, type, amount, category, description, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, type, amount, category, description, transaction_date]
    );
    await audit(req, 'TRANSACTION_CREATED', 'transaction', result.insertId);
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) { next(err); }
});

router.put('/:id', [
  param('id').isInt({ min: 1 }),
  ...common
], validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, amount, category, description = '', transaction_date } = req.body;
    const [result] = await pool.execute(
      `UPDATE transactions
       SET type=?, amount=?, category=?, description=?, transaction_date=?
       WHERE id=? AND user_id=?`,
      [type, amount, category, description, transaction_date, id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Transaction not found' });
    await audit(req, 'TRANSACTION_UPDATED', 'transaction', id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', [param('id').isInt({ min: 1 })], validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM transactions WHERE id=? AND user_id=?', [id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Transaction not found' });
    await audit(req, 'TRANSACTION_DELETED', 'transaction', id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
