/**
 * AutoApply AI — Unified Email Template System
 *
 * All emails share one consistent, beautiful design.
 * Every style is inlined (no <style> blocks) for maximum
 * email-client compatibility (Gmail, Outlook, Apple Mail, etc.)
 */

const BRAND    = 'AutoApply AI';
const YEAR     = new Date().getFullYear();
const APP_URL  = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:4200';
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
   BASE SHELL — every email is wrapped in this (Modern Clean Light Standard)
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
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <!-- LOGO BAR (Crisp Clean Brand Header) -->
  <tr><td style="padding-bottom:24px;text-align:center;">
    <a href="${APP_URL}" target="_blank" style="text-decoration:none;display:inline-block;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <!-- Brand Icon Mark -->
          <td style="vertical-align:middle;padding-right:12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:40px;height:40px;background:linear-gradient(135deg,#22E6F2 0%,#087CF5 55%,#D43DFF 100%);border-radius:10px;text-align:center;box-shadow:0 3px 10px rgba(8,124,245,0.2);">
              <tr>
                <td style="vertical-align:middle;text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-weight:900;font-size:20px;color:#071433;line-height:40px;">
                  A
                </td>
              </tr>
            </table>
          </td>
          <!-- Brand Wordmark & Tagline -->
          <td style="vertical-align:middle;text-align:left;">
            <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;line-height:1.15;">
              AutoApply<span style="color:#087CF5;"> AI</span>
            </div>
            <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:8.5px;font-weight:700;letter-spacing:1.8px;color:#64748b;text-transform:uppercase;margin-top:2px;">
              Apply Smarter. Not More.
            </div>
          </td>
        </tr>
      </table>
    </a>
  </td></tr>

  <!-- CARD -->
  <tr><td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 40px;box-shadow:0 4px 20px rgba(15,23,42,0.05);">
    ${body}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding-top:24px;text-align:center;">
    <div style="margin-bottom:12px;">
      <a href="${APP_URL}" target="_blank" style="text-decoration:none;display:inline-block;">
        <span style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.5px;color:#475569;">
          AutoApply<span style="color:#087CF5;"> AI</span>
        </span>
        <span style="display:block;font-size:9px;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">
          Autonomous Job Search &amp; Intelligence
        </span>
      </a>
    </div>
    <p style="font-size:11px;color:#64748b;margin:0 0 6px 0;">
      © ${YEAR} ${BRAND} &nbsp;·&nbsp;
      <a href="${APP_URL}/privacy" style="color:#64748b;text-decoration:underline;">Privacy Policy</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/settings" style="color:#64748b;text-decoration:underline;">Notification Settings</a>
    </p>
    <p style="font-size:10px;color:#94a3b8;margin:0;">You're receiving this because you have an ${BRAND} account.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

/* ─── Shared sub-parts (Light Theme) ────────────────────────────────────────── */
const heading = (text, sub = '') => `
  <h1 style="font-size:23px;font-weight:800;color:#0f172a;margin:0 0 ${sub ? '8' : '20'}px 0;line-height:1.25;">${esc(text)}</h1>
  ${sub ? `<p style="font-size:14px;color:#475569;margin:0 0 24px 0;line-height:1.6;">${esc(sub)}</p>` : ''}`;

const btn = (label, url, colour = PURPLE) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="border-radius:999px;background:linear-gradient(135deg,${colour},${PURPLE2});box-shadow:0 3px 12px rgba(108,99,255,0.25);">
      <a href="${url}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;letter-spacing:0.2px;">${esc(label)}</a>
    </td></tr>
  </table>`;

const infoBox = (rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:20px 0;">
    ${rows.map(([label, value, valueColour], idx) => `
    <tr>
      <td style="padding:12px 16px;${idx < rows.length - 1 ? 'border-bottom:1px solid #edf2f7;' : ''}">
        ${label ? `<p style="margin:0 0 3px 0;font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;">${esc(label)}</p>` : ''}
        <p style="margin:0;font-size:14px;font-weight:600;color:${valueColour || '#0f172a'};">${value}</p>
      </td>
    </tr>`).join('')}
  </table>`;

const divider = () => `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>`;

const note = (text) => `<p style="font-size:12px;color:#64748b;margin:16px 0 0 0;line-height:1.7;">${text}</p>`;

/* ═══════════════════════════════════════════════════════════════════════════
   1. EMAIL VERIFICATION
   ════════════════════════════════════════════════════════════════════════════ */
const verificationEmail = ({ name, verifyUrl }) => ({
  subject: `Verify your email address — ${BRAND}`,
  html: shell('Verify your email address',
    heading('Confirm your email', `Hi ${esc(name)}, thanks for joining ${BRAND}! Click the button below to verify your email address and unlock your account.`) +
    btn('Verify Email Address', verifyUrl) +
    divider() +
    note(`This link expires in <strong style="color:#0f172a;">24 hours</strong>. If you didn't create an account with ${BRAND}, you can safely ignore this email — no action is needed.`) +
    note(`Or paste this link into your browser:<br/><span style="color:#087cf5;word-break:break-all;">${esc(verifyUrl)}</span>`)
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. PASSWORD RESET
   ════════════════════════════════════════════════════════════════════════════ */
const passwordResetEmail = ({ name, resetUrl }) => ({
  subject: `Reset your password — ${BRAND}`,
  html: shell('Reset your password',
    heading('Reset your password', `Hi ${esc(name)}, we received a request to reset your password. Click the button below to choose a new one.`) +
    btn('Reset Password', resetUrl, DANGER) +
    divider() +
    note(`This link expires in <strong style="color:#0f172a;">1 hour</strong>. If you didn't request a password reset, please ignore this email — your password will remain unchanged.`) +
    note(`Or paste this link into your browser:<br/><span style="color:#ef4444;word-break:break-all;">${esc(resetUrl)}</span>`),
    DANGER
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. WELCOME EMAIL  (sent after first login / plan activation)
   ════════════════════════════════════════════════════════════════════════════ */
const welcomeEmail = ({ name, dashboardUrl }) => ({
  subject: `Welcome to ${BRAND} — let's land your next job`,
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
  subject: `Applied — ${esc(jobTitle)} at ${esc(company)}`,
  html: shell(`Application: ${jobTitle}`,
    heading('Application submitted', `${BRAND} applied on your behalf. Here's a summary:`) +
    infoBox([
      ['Role',          esc(jobTitle)],
      ['Company',       esc(company)],
      ['AI Match Score',`${matchScore}%`, scoreCol(matchScore)],
      ['Source',        esc(source || 'Job Board')],
    ]) +
    (jobUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="padding-right:10px;">${btn('View Job Posting', jobUrl, PURPLE)}</td>` +
    `<td>${btn('All Applications', applicationsUrl || `${APP_URL}/jobs`, '#475569')}</td>` +
    `</tr></table>` : btn('All Applications', applicationsUrl || `${APP_URL}/jobs`, PURPLE)) +
    divider() +
    note('If this application was sent in error, you can withdraw it from the Applications page in your dashboard.'),
    SUCCESS
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. JOB ALERT  (new match found)
   ════════════════════════════════════════════════════════════════════════════ */
const jobAlertEmail = ({ emailAddress, alert, prefillCard }) => {
  const alertUrl   = `${APP_URL}/alerts`;
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
        <td style="padding-left:10px;font-size:13px;color:#334155;line-height:1.6;">${esc(s)}</td>
      </tr></table>
    </td></tr>`).join('');

  const reasonsHtml = (alert.matchReasons || []).map(r => `
    <tr><td style="padding:4px 0;font-size:13px;color:#334155;line-height:1.6;">
      <span style="color:${SUCCESS};font-weight:700;padding-right:8px;">✓</span>${esc(r)}
    </td></tr>`).join('');

  const body = `
    <!-- Match score banner -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:linear-gradient(135deg,rgba(108,99,255,0.08),rgba(168,85,247,0.04));border:1px solid rgba(108,99,255,0.2);border-radius:14px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;" width="80" valign="middle">
          <div style="width:64px;height:64px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;text-align:center;line-height:64px;font-size:20px;font-weight:800;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,0.15);">${alert.matchScore}%</div>
        </td>
        <td style="padding:20px 16px 20px 0;" valign="middle">
          <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#0f172a;">${esc(alert.title)}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#64748b;">${esc(alert.company)}${alert.location ? ' · ' + esc(alert.location) : ''}</p>
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
      style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:12px 16px;font-size:13px;color:#166534;">
        <strong>Your tailored resume is ready →</strong>
        <a href="${esc(alert.tailoredResumePdfUrl)}" style="color:#15803d;margin-left:8px;font-weight:700;text-decoration:underline;">Download PDF</a>
      </td></tr>
    </table>` : ''}

    ${prefillCard ? `
    <p style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 8px;">Pre-filled application data preview</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:14px 16px;font-family:monospace;font-size:11px;color:#334155;white-space:pre-wrap;word-break:break-word;line-height:1.8;">${esc(String(prefillCard).slice(0,1200))}${prefillCard.length > 1200 ? '\n…(open app for full data)' : ''}</td></tr>
    </table>` : ''}

    <!-- CTAs -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:12px;">
          <a href="${esc(alert.jobUrl)}" style="display:inline-block;padding:13px 26px;background:linear-gradient(135deg,${PURPLE},${PURPLE2});color:#fff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;box-shadow:0 3px 10px rgba(108,99,255,0.25);">Apply Now</a>
        </td>
        <td style="padding-right:12px;">
          <a href="${esc(alertUrl)}" style="display:inline-block;padding:12px 22px;background:#f1f5f9;color:#4f46e5;text-decoration:none;border-radius:999px;font-size:13px;font-weight:600;border:1px solid #c7d2fe;">Full Packet in App</a>
        </td>
        ${alert.tailoredResumePdfUrl ? `
        <td>
          <a href="${esc(alert.tailoredResumePdfUrl)}" style="display:inline-block;padding:12px 22px;background:#f0fdf4;color:#15803d;text-decoration:none;border-radius:999px;font-size:13px;font-weight:600;border:1px solid #bbf7d0;">Resume PDF</a>
        </td>` : ''}
      </tr>
    </table>

    ${divider()}
    ${note(`${BRAND} found this match for you. <strong style="color:#0f172a;">You stay in control</strong> — we never auto-apply without your confirmation.`)}
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

  const cleanMsg = String(err?.message || 'Unknown Server Error').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return {
    subject: `🚨 [${(env || 'dev').toUpperCase()}] ${cleanMsg}`,
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
