/**
 * WhatsApp notification service using Twilio Sandbox.
 */

const twilio = require('twilio');
const logger = require('../../utils/logger');

let client;

const getClient = () => {
  if (!client) {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) { logger.warn('Twilio credentials not set — WhatsApp disabled'); return null; }
    client = twilio(sid, token);
  }
  return client;
};

/**
 * Send WhatsApp message via Twilio.
 * @param {string} to - E.164 format: +919876543210
 * @param {string} body
 */
const normalizePhone = (raw) => {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\s+/g, '');
  // Already has a + prefix → use as-is
  if (cleaned.startsWith('+')) return cleaned;
  // 10-digit Indian number → prepend +91
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  // 12-digit Indian number starting with 91 → add +
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  // Unknown format: add + and hope for the best
  return `+${cleaned}`;
};

const sendWhatsApp = async (to, body) => {
  const c = getClient();
  if (!c) return;

  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) { logger.warn('WhatsApp: no valid phone number provided'); return; }

  // NOTE: Twilio Sandbox requires users to manually opt-in by texting
  // "join <keyword>" to +14155238886 from their WhatsApp number.
  // For production, use a Twilio approved WhatsApp Business number
  // and set TWILIO_WHATSAPP_FROM in .env.
  try {
    await c.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to:   `whatsapp:${normalizedTo}`,
      body,
    });
    logger.info(`WhatsApp sent to ${normalizedTo}`);
  } catch (err) {
    logger.error(`WhatsApp failed to ${to}: ${err.message}`);
  }
};

/**
 * Notify user about a new application.
 */
const notifyApplication = async (phoneNumber, application) => {
  const body =
`*AutoApply AI*

Applied to: *${application.jobTitle}*
Company: ${application.company}
Match Score: ${application.matchScore}%
Source: ${application.source || 'AutoApply'}
Time: ${new Date(application.appliedAt).toLocaleTimeString()}

View dashboard: ${process.env.APP_URL || 'http://localhost:4200'}/jobs`;

  await sendWhatsApp(phoneNumber, body);
};

/**
 * Daily summary notification.
 */
const notifyDailySummary = async (phoneNumber, stats) => {
  const body =
`*Daily AutoApply Summary*

Jobs Found: ${stats.found}
Matched: ${stats.matched}
Applied: ${stats.applied}

Keep going — your next interview is one application away.`;

  await sendWhatsApp(phoneNumber, body);
};

module.exports = { notifyApplication, notifyDailySummary };
