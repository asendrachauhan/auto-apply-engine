/**
 * Email service — Resend SDK with automatic Nodemailer SMTP Fallback
 * All templates live in utils/emailTemplates.js for consistency.
 *
 * Sender resolution:
 *  1. RESEND_FROM_EMAIL env var (e.g. "AutoApply AI <hello@yourdomain.com>")
 *  2. SMTP_FROM / SMTP_USER fallback
 *  3. onboarding@resend.dev (Resend test sender)
 */
'use strict';
const logger = require('../../utils/logger');
const {
  verificationEmail,
  passwordResetEmail,
  welcomeEmail,
  applicationEmail,
  planUpgradeEmail,
} = require('../../utils/emailTemplates');
const {
  sendWithFallback,
  isEmailConfigured,
  isResendConfigured,
  isSmtpConfigured,
} = require('./emailTransport');

/* ─── Core send ───────────────────────────────────────────────────────────── */
const send = async ({ to, subject, html, text, from, replyTo }) => {
  return sendWithFallback({ to, subject, html, text, from, replyTo });
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
  sendEmail: send,
  isEmailConfigured,
  isResendConfigured,
  isSmtpConfigured,
};

