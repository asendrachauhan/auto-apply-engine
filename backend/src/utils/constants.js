/**
 * Application constants — single source of truth.
 * No magic strings anywhere in the codebase.
 */

const { PLANS_CONFIG } = require('../config/plans.config');

const PLAN = Object.freeze({
  FREE:    'free',
  STARTER: 'starter',
  PRO:     'pro',
  ELITE:   'elite',
});

// Derived from config/plans.config.js (env-driven) — kept here too so
// existing `PLAN_LIMITS[plan]` lookups across the codebase keep working.
const PLAN_LIMITS = Object.freeze(
  Object.fromEntries(
    Object.values(PLANS_CONFIG).map(p => [p.id, { dailyApply: p.dailyApply, sources: p.sources, realtime: p.realtime }])
  )
);

const JOB_STATUS = Object.freeze({
  APPLIED:   'applied',
  PENDING:   'pending',
  VIEWED:    'viewed',
  INTERVIEW: 'interview',
  REJECTED:  'rejected',
  OFFER:     'offer',
  WITHDRAWN: 'withdrawn',
});

const AUTO_SESSION_STATUS = Object.freeze({
  RUNNING:   'running',
  COMPLETED: 'completed',
  FAILED:    'failed',
  CANCELLED: 'cancelled',
});

const GHOST_VERDICT = Object.freeze({
  REAL:         'REAL',
  UNCERTAIN:    'UNCERTAIN',
  LIKELY_GHOST: 'LIKELY_GHOST',
});

const SOURCES = Object.freeze({
  REMOTIVE:   'remotive',
  HIMALAYAS:  'himalayas',
  ARBEITNOW:  'arbeitnow',
  ADZUNA:     'adzuna',
  MANUAL:     'manual',
});

const HTTP = Object.freeze({
  OK:         200,
  CREATED:    201,
  NO_CONTENT: 204,
  BAD_REQUEST:      400,
  UNAUTHORIZED:     401,
  FORBIDDEN:        403,
  NOT_FOUND:        404,
  CONFLICT:         409,
  UNPROCESSABLE:    422,
  TOO_MANY:         429,
  SERVER_ERROR:     500,
});

const GDPR = Object.freeze({
  CONSENT_VERSION:        '1.0',
  DATA_RETENTION_DAYS:    365,
  DELETION_WINDOW_DAYS:   30,
  EXPORT_FORMAT:          'json',
});

const RATE_LIMITS = Object.freeze({
  GLOBAL:        { windowMs: 15 * 60 * 1000, max: 100 },
  AUTH:          { windowMs: 15 * 60 * 1000, max: 10  },
  API:           { windowMs: 15 * 60 * 1000, max: 200 },
  AUTOMATION:    { windowMs: 60 * 60 * 1000, max: 1   },
});

const SECURITY = Object.freeze({
  BCRYPT_ROUNDS:         12,
  JWT_ACCESS_EXPIRY:    '15m',
  JWT_REFRESH_EXPIRY:   '7d',
  VERIFY_TOKEN_EXPIRY:   24 * 60 * 60 * 1000, // 24h
  RESET_TOKEN_EXPIRY:    60 * 60 * 1000,       // 1h
  MAX_LOGIN_ATTEMPTS:    5,
  LOCKOUT_DURATION:      15 * 60 * 1000,       // 15min
  ALLOWED_FILE_TYPES:   ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  MAX_FILE_SIZE_BYTES:   5 * 1024 * 1024,      // 5MB
});

module.exports = {
  PLAN, PLAN_LIMITS, JOB_STATUS, AUTO_SESSION_STATUS,
  GHOST_VERDICT, SOURCES, HTTP, GDPR, RATE_LIMITS, SECURITY,
};
