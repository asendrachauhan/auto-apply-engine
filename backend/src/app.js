/**
 * AutoApply AI — Express Application v2.0
 * Production-grade security, rate limiting, CORS, error handling.
 */
'use strict';
require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');

const connectDB           = require('./config/database');
const logger              = require('./utils/logger');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit.middleware');
const { errorHandler }    = require('./middleware/errorHandler.middleware');
const { sanitizeBody }    = require('./middleware/validate.middleware');

// Routes
const authRoutes         = require('./routes/auth.routes');
const resumeRoutes       = require('./routes/resume.routes');
const jobsRoutes         = require('./routes/jobs.routes');
const automationRoutes   = require('./routes/automation.routes');
const settingsRoutes     = require('./routes/settings.routes');
const intelligenceRoutes = require('./routes/intelligence.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const jobAlertRoutes     = require('./routes/jobAlert.routes');
const watchRoutes        = require('./routes/watch.routes');
const configRoutes       = require('./routes/config.routes');
const { startScheduler }     = require('./services/automation/scheduler.service');
const { resumeAllWatchers }  = require('./services/realtime/jobWatcher.service');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Stripe webhook BEFORE body parsers (needs raw body) ────────────────────────
app.use('/api/subscription/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => { req._isWebhook = true; next(); }
);

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  hsts:               { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:            true,
  xssFilter:          true,
  referrerPolicy:     { policy: 'strict-origin-when-cross-origin' },
}));

// Remove fingerprinting headers
app.disable('x-powered-by');
app.use((_, res, next) => { res.removeHeader('X-Powered-By'); next(); });

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4200').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials:    true,
  methods:        ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  maxAge:         86400,
}));
app.options('*', cors());

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(sanitizeBody);

// ── Logging ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: msg => logger.http(msg.trim()) },
    skip:   (req) => req.path === '/health',
  }));
}

// ── Trust proxy (Railway/Render/Heroku) ───────────────────────────────────────
app.set('trust proxy', 1);

// ── Rate limiting ──────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status:    'ok',
  version:   process.env.npm_package_version || '2.0.0',
  env:       process.env.NODE_ENV,
  timestamp: new Date().toISOString(),
}));

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/resume',       resumeRoutes);
app.use('/api/jobs',         jobsRoutes);
app.use('/api/automation',   automationRoutes);
app.use('/api/settings',     settingsRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/alerts',       jobAlertRoutes);
app.use('/api/watch',        watchRoutes);
app.use('/api/config',       configRoutes);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({
  success: false,
  message: `${req.method} ${req.originalUrl} not found`,
}));

// ── Global error handler ───────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ───────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on :${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
    // Background jobs — the 6-hourly automation run and Pro/Elite real-time
    // watchers. Both are fully implemented but were never started anywhere,
    // so "activate automation" only ever flipped a flag with nothing reading it.
    if (process.env.NODE_ENV !== 'test') {
      startScheduler();
      resumeAllWatchers().catch(err => logger.error(`Watcher resume failed: ${err.message}`));
    }
  } catch (err) {
    logger.error(`Server failed to start: ${err.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',     err => { logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack }); process.exit(1); });
process.on('unhandledRejection',    err => { logger.error(`Unhandled rejection: ${err}`); process.exit(1); });

start();
module.exports = app;
