/**
 * Global error handler — never leaks stack traces to clients.
 * Logs full error internally. Returns safe message externally.
 */
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal server error';

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

  // JWT errors
  if (err.name === 'JsonWebTokenError')  { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError')  { statusCode = 401; message = 'Token expired'; }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') { statusCode = 400; message = 'File too large — maximum 5MB'; }

  logger.error(`${req.method} ${req.originalUrl} — ${statusCode}: ${err.message}`, { stack: err.stack });

  // Never expose internal details in production
  const safeMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Something went wrong. Please try again.'
    : message;

  res.status(statusCode).json({ success: false, message: safeMessage });
};

module.exports = { errorHandler };
