const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { SELLER_ROLES } = require('../config/constants');

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Require a valid JWT and an active account
exports.protect = async (req, res, next) => {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please login to continue.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Your account was not found. Please login again.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact the admin.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Your session has expired. Please login again.' });
  }
};

// Attach the user when a valid token is present, but never block the request
exports.optionalAuth = async (req, res, next) => {
  const token = readToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    } catch (e) {
      /* ignore invalid token for public routes */
    }
  }
  next();
};

// Role-based authorization: authorize('admin') or authorize('seller') for any seller role
exports.authorize = (...roles) => (req, res, next) => {
  const allowed = roles.flatMap((r) => (r === 'seller' ? SELLER_ROLES : [r]));
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to do this.' });
  }
  next();
};

exports.signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
