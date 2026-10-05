import crypto from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function enforceBrowserOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const expectedOrigin = normalizeOrigin(
    process.env.FRONTEND_URL || 'http://localhost:5173'
  );

  const requestOrigin = req.get('Origin');

  // Allow non-browser/server-to-server requests that don't send Origin.
  if (!requestOrigin) {
    return next();
  }

  if (requestOrigin !== expectedOrigin) {
    return res.status(403).json({
      success: false,
      message: 'Blocked by origin security policy'
    });
  }

  next();
}

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

// Utility for generating secure random values if needed elsewhere.
export function generateSecureSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}