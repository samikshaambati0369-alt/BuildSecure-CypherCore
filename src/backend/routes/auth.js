import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { pool } from '../db.js';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { audit } from '../services/audit.js';

const router = Router();
const DUMMY_PASSWORD_HASH = '$2b$12$b.Pvx74LoeMLFch02hT1POK.PXkyQaWYelXxFv4iLBibD6CYj7oMi';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many failed login attempts. Try again later.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Try again later.' }
});

const passwordRule = body('password')
  .isLength({ min: 10, max: 128 })
  .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/).withMessage('Password must contain a number')
  .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a special character');

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  passwordRule
];

function cookieOptions() {
  const secure = process.env.COOKIE_SECURE === 'true';
  return [
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 2}`,
    ...(secure ? ['Secure'] : [])
  ].join('; ');
}

function clearCookieOptions() {
  const secure = process.env.COOKIE_SECURE === 'true';
  return ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join('; ');
}

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h', algorithm: 'HS256', issuer: 'fintrack-api', audience: 'fintrack-web' }
  );
}

router.post('/register', registerLimiter, registerRules, validate, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );

    await audit(req, 'ACCOUNT_CREATED', 'user', result.insertId);
    res.status(201).json({ success: true, data: { id: result.insertId, name, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Unable to create account with those details' });
    }
    next(err);
  }
});

router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1, max: 128 })
], validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );

    const passwordHash = rows[0]?.password_hash || DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(password, passwordHash);
    if (!rows.length || !passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const token = issueToken(user);
    res.setHeader('Set-Cookie', `fintrack_access=${encodeURIComponent(token)}; ${cookieOptions()}`);
    await audit({ user }, 'LOGIN_SUCCESS', 'auth');

    res.json({
      success: true,
      data: { user: { id: user.id, name: user.name, email: user.email, role: user.role } }
    });
  } catch (err) { next(err); }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    res.setHeader('Set-Cookie', `fintrack_access=; ${clearCookieOptions()}`);
    await audit(req, 'LOGOUT', 'auth');
    res.json({ success: true });
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
