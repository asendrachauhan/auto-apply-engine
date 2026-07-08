/**
 * Winston logger — structured logging for production.
 * JSON in production (for log aggregators like Datadog/Logtail).
 * Pretty in development.
 */
const winston = require('winston');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level}]: ${stack || message}`
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  transports: [
    process.env.NODE_ENV === 'production'
      ? new winston.transports.Console({ format: combine(timestamp(), errors({ stack: true }), json()) })
      : new winston.transports.Console({ format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat) }),
  ],
});

module.exports = logger;
