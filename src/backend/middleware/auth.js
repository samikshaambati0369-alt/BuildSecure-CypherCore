import jwt from 'jsonwebtoken';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return null; }
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = readCookie(req, 'fintrack_access') || bearer;

  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'fintrack-api',
      audience: 'fintrack-web'
    });
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
}
