/**
 * Email service — Resend SDK
 * All templates live in utils/emailTemplates.js for consistency.
 *
 * FROM address resolution (in order of priority):
 *  1. RESEND_FROM_EMAIL env var  (e.g. "AutoApply AI <hello@yourdomain.com>")
 *  2. onboarding@resend.dev      (Resend's safe-sender; works on free plan without domain verification)
 */
'use strict';
const { Resend } = require('resend');
const logger     = require('../../utils/logger');
const {
  verificationEmail,
  passwordResetEmail,
  welcomeEmail,
  applicationEmail,
  planUpgradeEmail,
} = require('../../utils/emailTemplates');

/* ─── Client ──────────────────────────────────────────────────────────────── */
let _client = null;
const getClient = () => {
  if (_client) return _client;
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[Email] RESEND_API_KEY not set — emails disabled');
    return null;
  }
  _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
};

// Use verified domain address OR Resend's universal test sender as fallback
const FROM = process.env.RESEND_FROM_EMAIL || 'AutoApply AI <onboarding@resend.dev>';

/* ─── Core send ───────────────────────────────────────────────────────────── */
const send = async ({ to, subject, html }) => {
  const client = getClient();
  if (!client) { logger.warn(`[Email] Skipped (no client): "${subject}" → ${to}`); return null; }
  try {
    const { data, error } = await client.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message ?? JSON.stringify(error));
    logger.info(`[Email] Sent: "${subject}" → ${to} [id:${data?.id}]`);
    return data;
  } catch (err) {
    logger.error(`[Email] Failed: "${subject}" → ${to} — ${err.message}`);
    throw err;
  }
};

/* ─── Public API ──────────────────────────────────────────────────────────── */
const sendVerificationEmail = (to, name, verifyUrl) => {
  const { subject, html } = verificationEmail({ name, verifyUrl });
  return send({ to, subject, html });
};

const sendPasswordResetEmail = (to, name, resetUrl) => {
  const { subject, html } = passwordResetEmail({ name, resetUrl });
  return send({ to, subject, html });
};

const sendWelcomeEmail = (to, name, dashboardUrl) => {
  const { subject, html } = welcomeEmail({ name, dashboardUrl });
  return send({ to, subject, html });
};

const sendApplicationEmail = (to, name, jobData) => {
  const { subject, html } = applicationEmail({ name, ...jobData });
  return send({ to, subject, html });
};

const sendPlanUpgradeEmail = (to, name, planData) => {
  const { subject, html } = planUpgradeEmail({ name, ...planData });
  return send({ to, subject, html });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendApplicationEmail,
  sendPlanUpgradeEmail,
  // expose raw send for custom one-off emails
  send,
};
