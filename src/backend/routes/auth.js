import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { pool } from '../db.js';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { audit } from '../services/audit.js';

const router = Router();

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 })
];

router.post('/register', registerRules, validate, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );

    res.status(201).json({ success: true, data: { id: result.insertId, name, email } });
  } catch (err) { next(err); }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1, max: 128 })
], validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
    );

    await audit({ user }, 'LOGIN_SUCCESS', 'auth');
    res.json({
      success: true,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
    });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

export default router;
