/**
 * AutoApply AI — Unified Email Template System
 *
 * All emails share one consistent, beautiful design.
 * Every style is inlined (no <style> blocks) for maximum
 * email-client compatibility (Gmail, Outlook, Apple Mail, etc.)
 */

const BRAND    = 'AutoApply AI';
const YEAR     = new Date().getFullYear();
const APP_URL  = process.env.APP_URL || 'https://autoapplyai.com';
const PURPLE   = '#6c63ff';
const PURPLE2  = '#a855f7';
const SUCCESS  = '#22c55e';
const WARN     = '#f59e0b';
const DANGER   = '#ef4444';

/* ─── Colour helpers ──────────────────────────────────────────────────────── */
const scoreCol = s => s >= 85 ? SUCCESS : s >= 70 ? WARN : '#94a3b8';
const scoreLbl = s => s >= 85 ? 'Excellent Match' : s >= 70 ? 'Good Match' : 'Fair Match';

/* ─── HTML escape ─────────────────────────────────────────────────────────── */
const esc = s => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ═══════════════════════════════════════════════════════════════════════════
   BASE SHELL — every email is wrapped in this
   ════════════════════════════════════════════════════════════════════════════ */
const shell = (title, body, accentColour = PURPLE) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${esc(title)}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0a0a14;font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a14;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <!-- LOGO BAR -->
  <tr><td style="padding-bottom:28px;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 auto;">
      <tr>
        <td style="padding-right:10px;vertical-align:middle;">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${accentColour},${PURPLE2});display:inline-block;"></div>
        </td>
        <td style="vertical-align:middle;">
          <span style="font-size:18px;font-weight:800;color:#f8fafc;letter-spacing:-0.3px;">${BRAND}</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CARD -->
  <tr><td style="background-color:#111120;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 40px;">
    ${body}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:24px 0;text-align:center;">
    <p style="font-size:11px;color:#334155;margin:0 0 6px 0;line-height:1.6;">
      © ${YEAR} ${BRAND} &nbsp;·&nbsp;
      <a href="${APP_URL}/privacy-policy" style="color:#475569;text-decoration:none;">Privacy Policy</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/settings" style="color:#475569;text-decoration:none;">Notification Settings</a>
    </p>
    <p style="font-size:10px;color:#1e293b;margin:0;">You're receiving this because you have an ${BRAND} account.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

/* ─── Shared sub-parts ────────────────────────────────────────────────────── */
const heading = (text, sub = '') => `
  <h1 style="font-size:24px;font-weight:800;color:#f8fafc;margin:0 0 ${sub ? '8' : '20'}px 0;line-height:1.2;">${esc(text)}</h1>
  ${sub ? `<p style="font-size:14px;color:#94a3b8;margin:0 0 24px 0;line-height:1.6;">${esc(sub)}</p>` : ''}`;

const btn = (label, url, colour = PURPLE) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="border-radius:999px;background:linear-gradient(135deg,${colour},${PURPLE2});">
      <a href="${url}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;letter-spacing:0.2px;">${esc(label)}</a>
    </td></tr>
  </table>`;

const infoBox = (rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;margin:20px 0;">
    ${rows.map(([label, value, valueColour]) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0 0 3px 0;font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;">${esc(label)}</p>
        <p style="margin:0;font-size:14px;font-weight:600;color:${valueColour || '#f8fafc'};">${value}</p>
      </td>
    </tr>`).join('')}
  </table>`;

const divider = () => `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;"/>`;

const note = (text) => `<p style="font-size:12px;color:#475569;margin:16px 0 0 0;line-height:1.7;">${text}</p>`;

/* ═══════════════════════════════════════════════════════════════════════════
   1. EMAIL VERIFICATION
   ════════════════════════════════════════════════════════════════════════════ */
const verificationEmail = ({ name, verifyUrl }) => ({
  subject: `Verify your email address — ${BRAND}`,
  html: shell('Verify your email address',
    heading('Confirm your email', `Hi ${esc(name)}, thanks for joining ${BRAND}! Click the button below to verify your email address and unlock your account.`) +
    btn('Verify Email Address', verifyUrl) +
    divider() +
    note(`This link expires in <strong style="color:#f8fafc;">24 hours</strong>. If you didn't create an account with ${BRAND}, you can safely ignore this email — no action is needed.`) +
    note(`Or paste this link into your browser:<br/><span style="color:#6c63ff;word-break:break-all;">${esc(verifyUrl)}</span>`)
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. PASSWORD RESET
   ════════════════════════════════════════════════════════════════════════════ */
const passwordResetEmail = ({ name, resetUrl }) => ({
  subject: `Reset your password — ${BRAND}`,
  html: shell('Reset your password', DANGER,
    heading('Reset your password', `Hi ${esc(name)}, we received a request to reset your password. Click the button below to choose a new one.`) +
    btn('Reset Password', resetUrl, DANGER) +
    divider() +
    note(`This link expires in <strong style="color:#f8fafc;">1 hour</strong>. If you didn't request a password reset, please ignore this email — your password will remain unchanged.`) +
    note(`Or paste this link into your browser:<br/><span style="color:#ef4444;word-break:break-all;">${esc(resetUrl)}</span>`)
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. WELCOME EMAIL  (sent after first login / plan activation)
   ════════════════════════════════════════════════════════════════════════════ */
const welcomeEmail = ({ name, dashboardUrl }) => ({
  subject: `Welcome to ${BRAND} — let's land your next job 🚀`,
  html: shell('Welcome to AutoApply AI',
    heading(`Welcome, ${esc(name)}! 👋`, 'Your AI-powered job search co-pilot is ready. Here\'s how to get started in 3 steps:') +
    infoBox([
      ['Step 1', 'Upload or build your resume in the Resume Builder'],
      ['Step 2', 'Set up Job Alerts with your target roles and preferences'],
      ['Step 3', 'Turn on Automation — sit back while we find matches'],
    ]) +
    btn('Go to Dashboard', dashboardUrl || `${APP_URL}/dashboard`) +
    divider() +
    note('Need help? Reply to this email anytime — our team typically responds within a few hours.')
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. JOB APPLICATION CONFIRMATION
   ════════════════════════════════════════════════════════════════════════════ */
const applicationEmail = ({ name, jobTitle, company, matchScore, jobUrl, source, applicationsUrl }) => ({
  subject: `Applied ✅ ${esc(jobTitle)} at ${esc(company)}`,
  html: shell(`Application: ${jobTitle}`, SUCCESS,
    heading('Application submitted', `${BRAND} applied on your behalf. Here's a summary:`) +
    infoBox([
      ['Role',          esc(jobTitle)],
      ['Company',       esc(company)],
      ['AI Match Score',`${matchScore}%`, scoreCol(matchScore)],
      ['Source',        esc(source || 'Job Board')],
    ]) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="padding-right:10px;">${btn('View Job Posting', jobUrl, PURPLE)}</td>` +
    `<td>${btn('All Applications', applicationsUrl || `${APP_URL}/jobs`, '#1e293b')}</td>` +
    `</tr></table>` +
    divider() +
    note('If this application was sent in error, you can withdraw it from the Applications page in your dashboard.')
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. JOB ALERT  (new match found)
   ════════════════════════════════════════════════════════════════════════════ */
const jobAlertEmail = ({ emailAddress, alert, prefillCard }) => {
  const alertUrl   = `${APP_URL}/job-alerts/${alert._id}`;
  const col        = scoreCol(alert.matchScore);
  const lbl        = scoreLbl(alert.matchScore);
  const steps      = (alert.prefillFields?.applyInstructions?.steps) || [
    'Open the job link and click "Apply"',
    'Upload your tailored resume PDF',
    'Copy-paste the pre-filled form data from the app',
    'Submit — done in under 8 minutes!',
  ];

  const stepsHtml = steps.map((s, i) => `
    <tr><td style="padding:8px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="width:28px;vertical-align:top;">
          <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,${PURPLE},${PURPLE2});text-align:center;line-height:22px;font-size:11px;font-weight:800;color:#fff;">${i+1}</div>
        </td>
        <td style="padding-left:10px;font-size:13px;color:#cbd5e1;line-height:1.6;">${esc(s)}</td>
      </tr></table>
    </td></tr>`).join('');

  const reasonsHtml = (alert.matchReasons || []).map(r => `
    <tr><td style="padding:4px 0;font-size:13px;color:#cbd5e1;line-height:1.6;">
      <span style="color:${SUCCESS};font-weight:700;padding-right:8px;">✓</span>${esc(r)}
    </td></tr>`).join('');

  const body = `
    <!-- Match score banner -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:linear-gradient(135deg,rgba(108,99,255,0.15),rgba(168,85,247,0.08));border:1px solid rgba(108,99,255,0.25);border-radius:14px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;" width="80" valign="middle">
          <div style="width:64px;height:64px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;text-align:center;line-height:64px;font-size:20px;font-weight:800;color:#fff;">${alert.matchScore}%</div>
        </td>
        <td style="padding:20px 16px 20px 0;" valign="middle">
          <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#f8fafc;">${esc(alert.title)}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">${esc(alert.company)}${alert.location ? ' · ' + esc(alert.location) : ''}</p>
          <p style="margin:0;font-size:12px;font-weight:700;color:${col};">${lbl} · via ${esc((alert.source||'').toUpperCase())}</p>
        </td>
      </tr>
    </table>

    ${reasonsHtml ? `
    <p style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 10px;">Why you match</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">${reasonsHtml}</table>
    ` : ''}

    ${divider()}

    <p style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 12px;">How to apply (5–8 min)</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">${stepsHtml}</table>

    ${alert.tailoredResumePdfUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:12px 16px;font-size:13px;color:#4ade80;">
        <strong>Your tailored resume is ready →</strong>
        <a href="${esc(alert.tailoredResumePdfUrl)}" style="color:#22c55e;margin-left:8px;font-weight:700;">Download PDF</a>
      </td></tr>
    </table>` : ''}

    ${prefillCard ? `
    <p style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 8px;">Pre-filled application data preview</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#0a0a14;border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:14px 16px;font-family:monospace;font-size:11px;color:#94a3b8;white-space:pre-wrap;word-break:break-word;line-height:1.8;">${esc(String(prefillCard).slice(0,1200))}${prefillCard.length > 1200 ? '\n…(open app for full data)' : ''}</td></tr>
    </table>` : ''}

    <!-- CTAs -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:12px;">
          <a href="${esc(alert.jobUrl)}" style="display:inline-block;padding:13px 26px;background:linear-gradient(135deg,${PURPLE},${PURPLE2});color:#fff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;">Apply Now</a>
        </td>
        <td style="padding-right:12px;">
          <a href="${esc(alertUrl)}" style="display:inline-block;padding:12px 22px;background:rgba(108,99,255,0.12);color:#a78bfa;text-decoration:none;border-radius:999px;font-size:13px;font-weight:600;border:1px solid rgba(108,99,255,0.3);">Full Packet in App</a>
        </td>
        ${alert.tailoredResumePdfUrl ? `
        <td>
          <a href="${esc(alert.tailoredResumePdfUrl)}" style="display:inline-block;padding:12px 22px;background:rgba(34,197,94,0.1);color:#4ade80;text-decoration:none;border-radius:999px;font-size:13px;font-weight:600;border:1px solid rgba(34,197,94,0.25);">Resume PDF</a>
        </td>` : ''}
      </tr>
    </table>

    ${divider()}
    ${note(`${BRAND} found this match for you. <strong style="color:#f8fafc;">You stay in control</strong> — we never auto-apply without your confirmation.`)}
  `;

  return {
    subject: `${alert.matchScore}% match → ${esc(alert.title)} at ${esc(alert.company)}`,
    html: shell(`Job Alert: ${alert.title}`, body),
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   6. CRITICAL ERROR ALERT  (ops / admin)
   ════════════════════════════════════════════════════════════════════════════ */
const criticalAlertEmail = ({ err, method, url, userId, env }) => {
  const now = new Date().toISOString();
  const body = `
    <!-- Alert badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#fca5a5;">🚨 Critical Server Error</p>
        <p style="margin:0;font-size:13px;color:#94a3b8;">This requires immediate attention</p>
      </td></tr>
    </table>

    ${infoBox([
      ['Environment', (env || 'development').toUpperCase(), env === 'production' ? DANGER : WARN],
      ['Timestamp',   esc(now)],
      ['Error',       esc(err.message), '#fca5a5'],
      ...(method ? [['Request', `${esc(method)} ${esc(url || '')}`]] : []),
      ...(userId  ? [['User ID', esc(String(userId))]] : []),
    ])}

    ${err.stack ? `
    <p style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;margin:20px 0 8px;">Stack Trace</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#050508;border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
      <tr><td style="padding:14px 16px;">
        <pre style="margin:0;font-size:11px;color:#94a3b8;font-family:'Courier New',monospace;white-space:pre-wrap;word-break:break-all;line-height:1.7;">${esc(err.stack.slice(0,3000))}</pre>
      </td></tr>
    </table>` : ''}

    ${divider()}
    ${note('This alert was generated automatically. Fix the issue and verify in your logs. Duplicate alerts are suppressed for 5 minutes.')}
  `;

  return {
    subject: `🚨 [${(env || 'dev').toUpperCase()}] ${esc(err.message.slice(0, 80))}`,
    html: shell('Critical Error Alert', body, DANGER),
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   7. PLAN UPGRADE CONFIRMATION
   ════════════════════════════════════════════════════════════════════════════ */
const planUpgradeEmail = ({ name, planName, features, dashboardUrl }) => ({
  subject: `You're on ${BRAND} ${planName} 🎉`,
  html: shell(`Upgraded to ${planName}`,
    heading(`You're upgraded, ${esc(name)}! 🎉`, `Your ${esc(planName)} plan is now active. Here's what you've unlocked:`) +
    infoBox((features || []).map(f => ['', `✓ &nbsp;${esc(f)}`, SUCCESS])) +
    btn('Go to Dashboard', dashboardUrl || `${APP_URL}/dashboard`) +
    divider() +
    note('Questions about your plan? Reply to this email and our team will get back to you.')
  ),
});

module.exports = {
  shell, heading, btn, infoBox, divider, note, esc,
  verificationEmail,
  passwordResetEmail,
  welcomeEmail,
  applicationEmail,
  jobAlertEmail,
  criticalAlertEmail,
  planUpgradeEmail,
};
