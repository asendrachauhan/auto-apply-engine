/**
 * Auth middleware — JWT verification + plan enforcement.
 * Security: no stack traces exposed, timing-safe comparisons.
 */
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { sendError } = require('../utils/apiResponse');
const { HTTP }      = require('../utils/constants');
const logger        = require('../utils/logger');

/** Verify JWT and attach user to req */
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return sendError(res, HTTP.UNAUTHORIZED, 'Authentication required');
    }

    const token = header.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const msg = err.name === 'TokenExpiredError' ? 'Session expired — please sign in again' : 'Invalid authentication token';
      return sendError(res, HTTP.UNAUTHORIZED, msg);
    }

    const user = await User.findById(decoded.id).select('-password -refreshToken -emailVerifyToken -passwordResetToken');
    if (!user) return sendError(res, HTTP.UNAUTHORIZED, 'Account not found');

    // Block deleted accounts
    if (user.deletionRequestedAt) return sendError(res, HTTP.FORBIDDEN, 'This account is scheduled for deletion');

    req.user = user;
    next();
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`);
    return sendError(res, HTTP.SERVER_ERROR, 'Authentication error');
  }
};

/** Require verified email for sensitive operations */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user.emailVerified) {
    return sendError(res, HTTP.FORBIDDEN, 'Please verify your email address to continue');
  }
  next();
};

/** Plan-based access control */
const requirePlan = (...allowedPlans) => (req, res, next) => {
  if (!allowedPlans.includes(req.user.plan)) {
    return sendError(res, HTTP.FORBIDDEN,
      `This feature requires a ${allowedPlans.join(' or ')} plan. Upgrade to unlock.`
    );
  }
  next();
};

module.exports = { protect, authenticate: protect, requireVerifiedEmail, requirePlan };
