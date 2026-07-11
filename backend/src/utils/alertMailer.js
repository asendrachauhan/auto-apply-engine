/**
 * Critical Error Alert Mailer
 * Sends a production-grade HTML email to ALERT_EMAIL on every 500-level error.
 *
 * Behaviour:
 *  • Works in ALL environments (dev + prod) — use FORCE_ALERT_EMAIL=false to silence in dev
 *  • Debounces identical errors for 5 minutes so the inbox is never flooded
 *  • Uses the unified emailTemplates design system for consistency
 *
 * Usage:
 *   const { sendCriticalAlert } = require('./alertMailer');
 *   await sendCriticalAlert(err, { method:'GET', url:'/api/foo', userId:'...' });
 */
'use strict';
const { Resend }          = require('resend');
const logger              = require('./logger');
const { criticalAlertEmail } = require('./emailTemplates');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL   = process.env.ALERT_EMAIL || 'asendrachauhan176@gmail.com';
// Verified domain address OR Resend safe-sender
const FROM_EMAIL    = process.env.RESEND_FROM_EMAIL || 'AutoApply AI <onboarding@resend.dev>';
const ENV           = process.env.NODE_ENV || 'development';

// Set to "false" explicitly to suppress in dev; defaults to enabled everywhere
const ENABLED = process.env.FORCE_ALERT_EMAIL !== 'false';

// Debounce identical errors — 5 minutes per unique (message + url) pair
const _debounce    = new Map();
const DEBOUNCE_MS  = 5 * 60 * 1000;

let _client = null;
const getClient = () => {
  if (_client) return _client;
  if (RESEND_API_KEY) _client = new Resend(RESEND_API_KEY);
  return _client;
};

/**
 * @param {Error}  err
 * @param {{ method?:string, url?:string, userId?:string }} context
 */
async function sendCriticalAlert(err, context = {}) {
  if (!ENABLED) return;

  const client = getClient();
  if (!client) {
    logger.warn('[AlertMailer] RESEND_API_KEY not set — skipping alert');
    return;
  }

  const key      = `${err.message}::${context.url || ''}`;
  const lastSent = _debounce.get(key);
  if (lastSent && Date.now() - lastSent < DEBOUNCE_MS) {
    logger.warn(`[AlertMailer] Debounced alert for: "${err.message}"`);
    return;
  }
  _debounce.set(key, Date.now());

  const { subject, html } = criticalAlertEmail({
    err,
    method : context.method,
    url    : context.url,
    userId : context.userId,
    env    : ENV,
  });

  try {
    const { data, error } = await client.emails.send({
      from   : FROM_EMAIL,
      to     : ALERT_EMAIL,
      subject,
      html,
    });
    if (error) throw new Error(error.message ?? JSON.stringify(error));
    logger.info(`[AlertMailer] Alert sent → ${ALERT_EMAIL} [id:${data?.id}]`);
  } catch (mailErr) {
    logger.error(`[AlertMailer] Failed to send alert: ${mailErr.message}`);
  }
}

module.exports = { sendCriticalAlert };
