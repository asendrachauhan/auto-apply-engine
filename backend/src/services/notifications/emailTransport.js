/**
 * Email Transport Engine — Unified Resend + Nodemailer SMTP Fallback
 *
 * Tier 1 (Primary): Resend SDK
 * Tier 2 (Fallback / Standalone): Nodemailer SMTP
 *   Supports free providers:
 *     - Gmail App Passwords (500 free emails/day)
 *     - Brevo / Sendinblue (300 free emails/day to ANY recipient)
 *     - Mailjet (200 free emails/day)
 *     - Custom / Self-hosted SMTP
 */
'use strict';

const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const logger     = require('../../utils/logger');

/* ─── State / Singletons ─────────────────────────────────────────────────── */
let _resendClient = null;
let _smtpTransporter = null;

const _resetClientsForTesting = () => {
  _resendClient = null;
  _smtpTransporter = null;
};

/* ─── Provider Detection ──────────────────────────────────────────────────── */
const isResendConfigured = () => Boolean(process.env.RESEND_API_KEY);

const isSmtpConfigured = () => {
  if (process.env.SMTP_SERVICE) {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  }
  if (process.env.SMTP_HOST) {
    if (process.env.SMTP_USER) {
      return Boolean(process.env.SMTP_PASS);
    }
    return true; // e.g. local unauthenticated dev SMTP / MailHog
  }
  return false;
};

const isEmailConfigured = () => isResendConfigured() || isSmtpConfigured();

/* ─── Resend Client ───────────────────────────────────────────────────────── */
const getResendClient = (forceNew = false) => {
  if (_resendClient && !forceNew) return _resendClient;
  if (!isResendConfigured()) return null;
  _resendClient = new Resend(process.env.RESEND_API_KEY);
  return _resendClient;
};

const getResendFrom = (overrideFrom) => {
  if (overrideFrom) return overrideFrom;
  return process.env.RESEND_FROM_EMAIL || 'AutoApply AI <onboarding@resend.dev>';
};

/* ─── SMTP Transporter ────────────────────────────────────────────────────── */
const createSmtpTransporter = () => {
  if (!isSmtpConfigured()) return null;

  const transportOpts = {};

  if (process.env.SMTP_SERVICE) {
    transportOpts.service = process.env.SMTP_SERVICE;
  } else if (process.env.SMTP_HOST) {
    transportOpts.host = process.env.SMTP_HOST;
    transportOpts.port = Number(process.env.SMTP_PORT) || 587;
    transportOpts.secure = process.env.SMTP_SECURE === 'true' || transportOpts.port === 465;
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transportOpts.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  // Socket & connection timeouts to prevent blocking background jobs
  transportOpts.connectionTimeout = Number(process.env.SMTP_TIMEOUT_MS) || 10000;
  transportOpts.greetingTimeout   = Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 10000;
  transportOpts.socketTimeout     = Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 15000;

  if (process.env.SMTP_IGNORE_TLS === 'true' || process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false') {
    transportOpts.tls = { rejectUnauthorized: false };
  }

  return nodemailer.createTransport(transportOpts);
};

const getSmtpTransporter = (forceNew = false) => {
  if (_smtpTransporter && !forceNew) return _smtpTransporter;
  _smtpTransporter = createSmtpTransporter();
  return _smtpTransporter;
};

const getSmtpFrom = (overrideFrom) => {
  if (overrideFrom) return overrideFrom;
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.SMTP_USER && process.env.SMTP_USER.includes('@')) {
    return `AutoApply AI <${process.env.SMTP_USER}>`;
  }
  return process.env.RESEND_FROM_EMAIL || 'AutoApply AI <noreply@autoapply.ai>';
};

/* ─── Dispatch via Resend ─────────────────────────────────────────────────── */
const sendViaResend = async ({ to, subject, html, text, from, replyTo }) => {
  const client = getResendClient();
  if (!client) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const fromAddress = getResendFrom(from);
  const payload = {
    from: fromAddress,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  const { data, error } = await client.emails.send(payload);
  if (error) {
    throw new Error(error.message ?? JSON.stringify(error));
  }

  logger.info(`[Email] Delivered via Resend: "${subject}" → ${to} [id:${data?.id}]`);
  return { success: true, provider: 'resend', id: data?.id };
};

/* ─── Dispatch via Nodemailer SMTP ────────────────────────────────────────── */
const sendViaSmtp = async ({ to, subject, html, text, from, replyTo }) => {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    throw new Error('SMTP transporter could not be initialized — check SMTP environment variables');
  }

  const fromAddress = getSmtpFrom(from);
  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
    ...(replyTo ? { replyTo } : {}),
  };

  const info = await transporter.sendMail(mailOptions);
  logger.info(`[Email] Delivered via SMTP: "${subject}" → ${to} [msgId:${info?.messageId}]`);
  return {
    success: true,
    provider: 'smtp',
    id: info?.messageId,
    response: info?.response,
  };
};

/* ─── Unified Send with Failover ──────────────────────────────────────────── */
const sendWithFallback = async ({ to, subject, html, text, from, replyTo }) => {
  if (!to || !subject) {
    logger.warn('[Email] Missing recipient or subject — email skipped');
    return null;
  }

  const providerMode = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();

  // Mode: Forced SMTP
  if (providerMode === 'smtp') {
    return sendViaSmtp({ to, subject, html, text, from, replyTo });
  }

  // Mode: Forced Resend
  if (providerMode === 'resend') {
    return sendViaResend({ to, subject, html, text, from, replyTo });
  }

  // Mode: Auto (Resend Primary -> SMTP Secondary Fallback)
  if (isResendConfigured()) {
    try {
      return await sendViaResend({ to, subject, html, text, from, replyTo });
    } catch (resendErr) {
      const isSandboxRestriction =
        resendErr.message &&
        resendErr.message.includes('You can only send testing emails to your own email address');

      if (isSandboxRestriction) {
        logger.warn(
          `[Email Sandbox] Resend free domain restriction hit for "${subject}" → ${to}. Attempting fallback to SMTP...`
        );
      } else {
        logger.warn(
          `[Email] Resend delivery failed for "${subject}" → ${to} (${resendErr.message}). Attempting fallback to SMTP...`
        );
      }

      if (isSmtpConfigured()) {
        try {
          const smtpResult = await sendViaSmtp({ to, subject, html, text, from, replyTo });
          logger.info(`[Email] Fallback to SMTP succeeded: "${subject}" → ${to} [msgId:${smtpResult.id}]`);
          return smtpResult;
        } catch (smtpErr) {
          logger.error(`[Email] Both Resend and SMTP fallback failed for "${subject}" → ${to}`);
          throw new Error(`Email failed (Resend: ${resendErr.message} | SMTP fallback: ${smtpErr.message})`);
        }
      } else {
        logger.warn('[Email] No SMTP fallback configured in .env (configure SMTP_HOST/SMTP_USER to enable free SMTP failover)');
        throw resendErr;
      }
    }
  }

  // If Resend is not configured, but SMTP is available:
  if (isSmtpConfigured()) {
    logger.info(`[Email] Resend not configured — dispatching directly via SMTP: "${subject}" → ${to}`);
    return sendViaSmtp({ to, subject, html, text, from, replyTo });
  }

  // Neither is configured:
  logger.warn(`[Email] Skipped (neither RESEND_API_KEY nor SMTP configured): "${subject}" → ${to}`);
  return null;
};

module.exports = {
  sendWithFallback,
  sendViaResend,
  sendViaSmtp,
  isResendConfigured,
  isSmtpConfigured,
  isEmailConfigured,
  getResendClient,
  getSmtpTransporter,
  getResendFrom,
  getSmtpFrom,
  _resetClientsForTesting,
};
