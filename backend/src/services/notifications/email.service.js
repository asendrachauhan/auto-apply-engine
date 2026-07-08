/**
 * Email service — Resend.com
 * Production-grade HTML templates, no dependencies on external CSS.
 */
const { Resend } = require('resend');
const logger = require('../../utils/logger');

let _client = null;
const getClient = () => {
  if (!_client) {
    if (!process.env.RESEND_API_KEY) { logger.warn('RESEND_API_KEY not set — emails disabled'); return null; }
    _client = new Resend(process.env.RESEND_API_KEY);
  }
  return _client;
};

const FROM    = process.env.RESEND_FROM_EMAIL || 'noreply@autoapplyai.com';
const APP_URL = process.env.APP_URL           || 'https://autoapplyai.com';
const BRAND   = 'AutoApply AI';

const baseTemplate = (title, content) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="padding-bottom:24px;text-align:center;">
  <div style="display:inline-flex;align-items:center;gap:8px;">
    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#2563eb);display:inline-block;"></div>
    <span style="font-size:16px;font-weight:700;color:#f8fafc;">${BRAND}</span>
  </div>
</td></tr>
<tr><td style="background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
${content}
</td></tr>
<tr><td style="padding:20px 0;text-align:center;">
  <p style="font-size:11px;color:#334155;margin:0;">
    © ${new Date().getFullYear()} ${BRAND} · 
    <a href="${APP_URL}/privacy-policy" style="color:#475569;">Privacy Policy</a> · 
    <a href="${APP_URL}/unsubscribe" style="color:#475569;">Unsubscribe</a>
  </p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

const send = async ({ to, subject, html }) => {
  const client = getClient();
  if (!client) { logger.warn(`Email skipped (no client): ${subject} → ${to}`); return; }
  try {
    const { data, error } = await client.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message);
    logger.info(`Email sent: ${subject} → ${to} [${data?.id}]`);
    return data;
  } catch (err) {
    logger.error(`Email failed: ${subject} → ${to}: ${err.message}`);
    throw err;
  }
};

const sendVerificationEmail = (to, name, verifyUrl) => send({
  to, subject: `Verify your email — ${BRAND}`,
  html: baseTemplate('Verify your email', `
    <h1 style="font-size:22px;font-weight:800;color:#f8fafc;margin:0 0 8px;">Verify your email</h1>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">Hi ${name}, click the button below to verify your email address and activate your account.</p>
    <a href="${verifyUrl}" style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;border-radius:999px;font-weight:700;font-size:14px;">Verify Email Address</a>
    <p style="font-size:12px;color:#475569;margin:20px 0 0;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
  `),
});

const sendPasswordResetEmail = (to, name, resetUrl) => send({
  to, subject: `Reset your password — ${BRAND}`,
  html: baseTemplate('Reset your password', `
    <h1 style="font-size:22px;font-weight:800;color:#f8fafc;margin:0 0 8px;">Reset your password</h1>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">Hi ${name}, we received a request to reset your password. Click below to choose a new one.</p>
    <a href="${resetUrl}" style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;border-radius:999px;font-weight:700;font-size:14px;">Reset Password</a>
    <p style="font-size:12px;color:#475569;margin:20px 0 0;">This link expires in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
  `),
});

const sendApplicationEmail = (to, name, { jobTitle, company, matchScore, jobUrl, source }) => send({
  to, subject: `Applied: ${jobTitle} at ${company} — ${BRAND}`,
  html: baseTemplate(`Applied: ${jobTitle}`, `
    <h1 style="font-size:20px;font-weight:800;color:#f8fafc;margin:0 0 4px;">Application submitted</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">AutoApply AI applied on your behalf.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:6px 0;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Role</span><br><span style="font-size:15px;font-weight:700;color:#f8fafc;">${jobTitle}</span></td></tr>
      <tr><td style="padding:6px 0;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Company</span><br><span style="font-size:15px;font-weight:700;color:#f8fafc;">${company}</span></td></tr>
      <tr><td style="padding:6px 0;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">AI Match Score</span><br><span style="font-size:15px;font-weight:700;color:#10b981;">${matchScore}%</span></td></tr>
      <tr><td style="padding:6px 0;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Source</span><br><span style="font-size:13px;color:#94a3b8;">${source}</span></td></tr>
    </table>
    <a href="${jobUrl}" style="display:inline-block;padding:11px 22px;background:rgba(124,58,237,0.15);color:#a78bfa;text-decoration:none;border-radius:999px;font-weight:600;font-size:13px;border:1px solid rgba(124,58,237,0.3);">View Job Posting</a>
    <a href="${APP_URL}/jobs" style="display:inline-block;margin-left:10px;padding:11px 22px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-size:13px;">View All Applications</a>
  `),
});

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendApplicationEmail };
