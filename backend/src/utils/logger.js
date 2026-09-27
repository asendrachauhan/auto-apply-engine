/**
 * Winston logger — structured logging for production.
 * JSON in production (for log aggregators like Datadog/Logtail).
 * Pretty in development.
 *
 * In production a custom transport fires sendCriticalAlert() for every
 * logger.error() call so the ops team receives an email immediately.
 */
const winston = require('winston');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level}]: ${stack || message}`
);

// ── Custom email transport (production only) ────────────────────────────────
class EmailAlertTransport extends winston.Transport {
  constructor(opts) { super(opts); this.name = 'emailAlert'; }
  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    // Fire-and-forget — never block the logger
    try {
      const { sendCriticalAlert } = require('./alertMailer');
      const err = info[Symbol.for('splat')]?.[0]?.err || new Error(info.message);
      sendCriticalAlert(err, { url: info.url || '', method: info.method || '' })
        .catch(() => {}); // silence secondary failures
    } catch (_) {}
    callback();
  }
}

const transports = [
  process.env.NODE_ENV === 'production'
    ? new winston.transports.Console({ format: combine(timestamp(), errors({ stack: true }), json()) })
    : new winston.transports.Console({ format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat) }),
];

const fs      = require('fs');
const path    = require('path');

// Add email-alert transport in production (or when FORCE_ALERT_EMAIL is set)
if (process.env.NODE_ENV === 'production' || process.env.FORCE_ALERT_EMAIL === 'true') {
  transports.push(new EmailAlertTransport({ level: 'error' }));
}

// Add persistent file logging when configured (disabled during tests)
if (process.env.NODE_ENV !== 'test' && (process.env.LOG_TO_FILE === 'true' || process.env.LOG_DIR)) {
  try {
    const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: combine(timestamp(), errors({ stack: true }), json()),
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: combine(timestamp(), errors({ stack: true }), json()),
      })
    );
  } catch (_) {
    // Graceful fallback if running in read-only environment
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  transports,
});

module.exports = logger;
