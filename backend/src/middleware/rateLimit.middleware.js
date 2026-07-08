/**
 * Rate limiting — tiered by endpoint sensitivity.
 * Uses memory store for single-server, Redis for multi-server.
 */
const rateLimit  = require('express-rate-limit');
const { RATE_LIMITS, HTTP } = require('../utils/constants');

const makeHandler = (config) => rateLimit({
  ...config,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => res.status(HTTP.TOO_MANY).json({
    success: false,
    message: 'Too many requests — please slow down and try again shortly.',
    retryAfter: Math.ceil(config.windowMs / 1000),
  }),
});

// Global rate limit
const apiLimiter  = makeHandler(RATE_LIMITS.API);

// Strict limit for auth endpoints (brute force protection)
const authLimiter = makeHandler(RATE_LIMITS.AUTH);

// Automation — max once per hour per user
const autoLimiter = makeHandler(RATE_LIMITS.AUTOMATION);

module.exports = { apiLimiter, authLimiter, autoLimiter, automationTriggerLimiter: autoLimiter };
