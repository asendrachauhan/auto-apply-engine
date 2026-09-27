/**
 * Global error handler — never leaks stack traces to clients.
 * Logs full error internally. Returns safe message externally.
 * 
 * CRITICAL: Distinguishes between authentication errors (401 from our JWT
 * validation) vs external API errors that happen to return 401 (Stripe,
 * LinkedIn, etc.). The latter MUST NOT be sent as-is to the frontend — they
 * get converted to 502/503 so the frontend doesn't misinterpret them as
 * "user session expired" and log the user out incorrectly.
 */
const logger          = require('../utils/logger');
const { sendCriticalAlert } = require('../utils/alertMailer');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal server error';
  let isAuthError = false;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // JWT errors (REAL authentication failures, OK to send 401)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    isAuthError = true;
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    isAuthError = true;
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File too large — maximum 5MB';
  }

  // CRITICAL FIX: If status is 401 but NOT a real authentication error
  // (i.e., it came from an external API like Stripe, LinkedIn, etc.),
  // convert it to 502 (Bad Gateway) so the frontend knows this isn't a
  // user session problem. This prevents external API auth failures from
  // logging out the user incorrectly.
  if (statusCode === 401 && !isAuthError) {
    statusCode = 502;
    message = 'A service we depend on is temporarily unavailable. Please try again in a moment.';
    logger.warn(`[ErrorHandler] Converting non-auth 401 to 502: ${err.message}`);
  }

  logger.error(`${req.method} ${req.originalUrl} — ${statusCode}: ${err.message}`, { stack: err.stack });

  // Email alert for unhandled 500s in production
  if (statusCode === 500) {
    sendCriticalAlert(err, {
      method : req.method,
      url    : req.originalUrl,
      userId : req.user?.id,
    }).catch(() => {}); // never block the response
  }

  // Never expose internal details in production
  const safeMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Something went wrong. Please try again.'
    : message;

  res.status(statusCode).json({ success: false, message: safeMessage });
};

module.exports = { errorHandler };
