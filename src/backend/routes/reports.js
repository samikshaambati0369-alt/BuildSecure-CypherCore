import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { pool } from '../db.js';
import { audit } from '../services/audit.js';

const router = Router();
router.use(authenticate);

router.get('/csv', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT transaction_date, type, category, amount, description
       FROM transactions WHERE user_id=? ORDER BY transaction_date DESC LIMIT 10000`,
      [req.user.id]
    );

    const escape = value => {
      let text = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('\"', '\"\"')}"`;
    };
    const csv = [
      'Date,Type,Category,Amount,Description',
      ...rows.map(r => [r.transaction_date, r.type, r.category, r.amount, r.description].map(escape).join(','))
    ].join('\n');

    await audit(req, 'REPORT_EXPORTED', 'csv');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fintrack-report.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

export default router;
