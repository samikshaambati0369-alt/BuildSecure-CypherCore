import crypto from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Normalize an origin so comparisons are consistent.
 */
function normalizeOrigin(value) {
  if (!value) {
    return '';
  }

  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

/**
 * Enforce browser Origin protection for state-changing requests.
 *
 * Allowed origins:
 * - Production Vercel frontend from FRONTEND_URL
 * - Localhost:5173
 * - Localhost:5174
 *
 * Requests without an Origin header are allowed for:
 * - Postman
 * - Server-to-server requests
 * - Other non-browser clients
 */
export function enforceBrowserOrigin(req, res, next) {
  // GET, HEAD and OPTIONS are safe/read-only requests.
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174'
].filter(Boolean);

  const requestOrigin = req.get('Origin');

  // Allow requests without an Origin header.
  if (!requestOrigin) {
    return next();
  }

  // Block unknown browser origins.
  if (!allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({
      success: false,
      message: 'Blocked by origin security policy'
    });
  }

  return next();
}

/**
 * Validate important security configuration at startup.
 */
export function requireSecureConfig() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'Security configuration error: JWT_SECRET must be at least 32 characters long.'
    );
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '2h';

  if (!/^\d+[smhd]$/.test(expiresIn)) {
    throw new Error(
      'Security configuration error: JWT_EXPIRES_IN must use a value such as 15m, 2h, or 1d.'
    );
  }

  if (!process.env.FRONTEND_URL) {
    console.warn(
      'Warning: FRONTEND_URL is not configured. Using http://localhost:5173'
    );
  }

  if (!process.env.COOKIE_SECURE) {
    console.warn(
      'Warning: COOKIE_SECURE is not configured. Use false for local HTTP development and true for HTTPS production.'
    );
  }

  return true;
}

/**
 * Generate a cryptographically secure random secret.
 */
export function generateSecureSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}