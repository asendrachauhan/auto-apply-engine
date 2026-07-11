/**
 * Job Alert Notification Service
 * Sends email (and optionally WhatsApp) when a new job match is found.
 * Email template uses the unified AutoApply AI design system.
 */
'use strict';
const { Resend } = require('resend');
const twilio     = require('twilio');
const logger     = require('../../utils/logger');
const { jobAlertEmail } = require('../../utils/emailTemplates');

/* ─── Resend ──────────────────────────────────────────────────────────────── */
let _emailClient = null;
const getEmailClient = () => {
  if (_emailClient) return _emailClient;
  if (!process.env.RESEND_API_KEY) return null;
  _emailClient = new Resend(process.env.RESEND_API_KEY);
  return _emailClient;
};

const FROM = process.env.RESEND_FROM_EMAIL || 'AutoApply AI <onboarding@resend.dev>';

/* ─── Twilio WhatsApp ─────────────────────────────────────────────────────── */
let _waClient = null;
const getWaClient = () => {
  if (_waClient) return _waClient;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  _waClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return _waClient;
};

/* ─── WhatsApp alert ──────────────────────────────────────────────────────── */
const sendWhatsAppAlert = async (phoneNumber, alert) => {
  const client = getWaClient();
  if (!client || !phoneNumber) return false;

  const appUrl     = process.env.APP_URL || 'http://localhost:4200';
  const scoreLabel = alert.matchScore >= 85 ? 'Excellent Match'
    : alert.matchScore >= 70 ? 'Good Match' : 'Fair Match';

  const msg = [
    `*New Job Match — AutoApply AI* (${scoreLabel})`,
    '',
    `*${alert.title}*`,
    `${alert.company}  ·  ${alert.location || 'Remote'}`,
    `via ${(alert.source || '').toUpperCase()}`,
    `Match Score: *${alert.matchScore}%*`,
    '',
    `📄 Apply here:\n${alert.jobUrl}`,
    '',
    alert.tailoredResumePdfUrl
      ? `Your tailored resume:\n${alert.tailoredResumePdfUrl}`
      : 'Your tailored resume is ready in the app.',
    '',
    `📋 Pre-filled form data & step-by-step guide:\n${appUrl}/alerts/${alert._id}`,
    '',
    'Estimated apply time: 5–8 minutes',
    'AutoApply AI prepared everything. You just click & paste.',
  ].join('\n');

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to:   `whatsapp:${phoneNumber}`,
      body: msg,
    });
    logger.info(`[JobAlert] WhatsApp sent → ${phoneNumber}: ${alert.title}`);
    return true;
  } catch (err) {
    logger.error(`[JobAlert] WhatsApp failed: ${err.message}`);
    return false;
  }
};

/* ─── Email alert ─────────────────────────────────────────────────────────── */
const sendEmailAlert = async (emailAddress, alert, prefillCard) => {
  const client = getEmailClient();
  if (!client || !emailAddress) return false;

  const { subject, html } = jobAlertEmail({ emailAddress, alert, prefillCard });

  try {
    const { data, error } = await client.emails.send({ from: FROM, to: emailAddress, subject, html });
    if (error) throw new Error(error.message ?? JSON.stringify(error));
    logger.info(`[JobAlert] Email sent → ${emailAddress}: ${alert.title} [id:${data?.id}]`);
    return true;
  } catch (err) {
    logger.error(`[JobAlert] Email failed: ${err.message}`);
    return false;
  }
};

/* ─── Combined dispatch ───────────────────────────────────────────────────── */
const sendJobAlert = async (user, alert, prefillCard) => {
  const ns = user.notificationSettings || {};
  const results = { whatsapp: false, email: false };

  if (ns.whatsappEnabled && ns.whatsappNumber) {
    results.whatsapp = await sendWhatsAppAlert(ns.whatsappNumber, alert);
  }
  if (ns.emailEnabled !== false && (ns.emailAddress || user.email)) {
    results.email = await sendEmailAlert(ns.emailAddress || user.email, alert, prefillCard);
  }

  return results;
};

module.exports = { sendJobAlert, sendWhatsAppAlert, sendEmailAlert };
