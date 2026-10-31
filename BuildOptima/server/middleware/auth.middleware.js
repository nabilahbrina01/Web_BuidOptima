const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
  }
  next();
};

const authorizeSelfOrAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthenticated' });
  if (req.user.role === 'admin' || String(req.user.id) === String(req.params.id)) return next();
  return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
};

module.exports = { authenticate, authorize, authorizeSelfOrAdmin };
