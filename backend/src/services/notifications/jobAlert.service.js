/**
 * Job Alert Notification Service.
 * Sends WhatsApp + Email with:
 *  - Job title, company, match score
 *  - Direct job link
 *  - Tailored resume PDF link
 *  - Pre-filled form data card
 *  - Platform-specific apply instructions
 */

const { Resend }  = require('resend');
const twilio      = require('twilio');
const logger      = require('../../utils/logger');

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
const getWhatsappClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

/**
 * Send WhatsApp job alert.
 */
const sendWhatsAppAlert = async (phoneNumber, alert) => {
  const client = getWhatsappClient();
  if (!client || !phoneNumber) return;

  const scoreLabel = alert.matchScore >= 85 ? 'Excellent Match' : alert.matchScore >= 70 ? 'Good Match' : 'Fair Match';
  const appUrl = process.env.APP_URL || 'http://localhost:4200';

  const msg = `*New Job Match — AutoApply AI* (${scoreLabel})

*${alert.title}*
${alert.company}
${alert.location || 'Remote'}
via ${(alert.source || '').toUpperCase()}
Match: *${alert.matchScore}%*

Apply here:
${alert.jobUrl}

Your tailored resume is ready${alert.tailoredResumePdfUrl ? `:\n${alert.tailoredResumePdfUrl}` : ' in the app.'}

Pre-filled form data, cover letter & step-by-step apply guide:
${appUrl}/alerts/${alert._id}

Estimated apply time: 5-8 minutes
AutoApply AI prepared everything. You just click & paste.`;

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      to:   `whatsapp:${phoneNumber}`,
      body: msg,
    });
    logger.info(`WhatsApp alert sent to ${phoneNumber}: ${alert.title}`);
    return true;
  } catch (err) {
    logger.error(`WhatsApp alert failed: ${err.message}`);
    return false;
  }
};

// ─── Email ────────────────────────────────────────────────────────────────────
const getEmailClient = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const scoreColor = (score) => score >= 85 ? '#43e97b' : score >= 70 ? '#f8961e' : '#718096';
const scoreLabel = (score) => score >= 85 ? 'Excellent Match' : score >= 70 ? 'Good Match' : 'Fair Match';

/**
 * Send email job alert with full application packet.
 */
const sendEmailAlert = async (emailAddress, alert, prefillCard) => {
  const client = getEmailClient();
  if (!client || !emailAddress) return;

  const appUrl      = process.env.APP_URL || 'http://localhost:4200';
  const alertUrl    = `${appUrl}/job-alerts/${alert._id}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body   { font-family:'Segoe UI',Arial,sans-serif; background:#e0e5ec; margin:0; padding:20px; }
  .wrap  { max-width:600px; margin:0 auto; }
  .card  { background:#e0e5ec; box-shadow:6px 6px 14px #a3b1c6,-6px -6px 14px #fff; border-radius:20px; overflow:hidden; }
  .hdr   { background:linear-gradient(135deg,#6c63ff,#a855f7); padding:28px 30px; color:#fff; }
  .hdr-logo { font-size:22px; font-weight:800; margin-bottom:4px; }
  .hdr-sub  { font-size:13px; opacity:.85; }
  .body  { padding:28px 30px; }
  .score-row { display:flex; align-items:center; gap:20px; margin-bottom:24px; padding:18px; background:#fff; border-radius:14px; box-shadow:3px 3px 8px #a3b1c6,-3px -3px 8px #fff; }
  .score-circle { width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; color:#fff; flex-shrink:0; }
  .job-title  { font-size:20px; font-weight:800; color:#2d3748; margin-bottom:4px; }
  .job-co     { font-size:14px; color:#718096; }
  .match-lbl  { font-size:13px; font-weight:700; margin-top:4px; }
  .meta-row   { display:flex; gap:16px; margin:18px 0; flex-wrap:wrap; }
  .meta-item  { display:flex; align-items:center; gap:6px; font-size:13px; color:#4a5568; background:#fff; padding:7px 13px; border-radius:30px; box-shadow:3px 3px 6px #a3b1c6,-3px -3px 6px #fff; }
  .section    { margin:20px 0; }
  .section-t  { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#718096; margin-bottom:10px; }
  .reasons    { list-style:none; padding:0; }
  .reasons li { display:flex; gap:8px; font-size:13px; color:#2d3748; margin-bottom:8px; line-height:1.5; }
  .reasons li::before { content:"✓"; color:#43e97b; font-weight:700; flex-shrink:0; }
  .prefill-box { background:#1a1a2e; border-radius:12px; padding:18px; font-family:monospace; font-size:11px; color:#e2e8f0; white-space:pre-wrap; max-height:300px; overflow-y:auto; line-height:1.7; }
  .btn-row   { display:flex; gap:12px; margin-top:24px; flex-wrap:wrap; }
  .btn       { display:inline-block; padding:12px 22px; border-radius:30px; font-size:14px; font-weight:700; text-decoration:none; text-align:center; }
  .btn-p     { background:linear-gradient(135deg,#6c63ff,#a855f7); color:#fff; box-shadow:4px 4px 10px rgba(108,99,255,.3); }
  .btn-s     { background:#e0e5ec; color:#6c63ff; box-shadow:3px 3px 8px #a3b1c6,-3px -3px 8px #fff; }
  .step-list { counter-reset:step; padding:0; list-style:none; }
  .step-list li { counter-increment:step; display:flex; gap:10px; font-size:13px; color:#2d3748; margin-bottom:10px; }
  .step-list li::before { content:counter(step); background:linear-gradient(135deg,#6c63ff,#a855f7); color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; flex-shrink:0; }
  .tip-box   { background:rgba(108,99,255,.1); border-left:3px solid #6c63ff; padding:12px 14px; border-radius:0 8px 8px 0; font-size:12px; color:#4a5568; margin-top:14px; }
  .footer    { text-align:center; padding:18px; font-size:11px; color:#a0aec0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="hdr">
      <div class="hdr-logo">AutoApply AI</div>
      <div class="hdr-sub">New job found &amp; application packet ready — just click &amp; paste</div>
    </div>

    <div class="body">
      <!-- Score + Job -->
      <div class="score-row">
        <div class="score-circle" style="background:${scoreColor(alert.matchScore)};">
          ${alert.matchScore}%
        </div>
        <div>
          <div class="job-title">${alert.title}</div>
          <div class="job-co">${alert.company}</div>
          <div class="match-lbl" style="color:${scoreColor(alert.matchScore)};">${scoreLabel(alert.matchScore)}</div>
        </div>
      </div>

      <!-- Meta -->
      <div class="meta-row">
        <span class="meta-item">${alert.location || 'Remote'}</span>
        <span class="meta-item">${(alert.source || 'Job Board').toUpperCase()}</span>
        ${alert.salary ? `<span class="meta-item">${alert.salary}</span>` : ''}
      </div>

      <!-- Why matched -->
      ${alert.matchReasons?.length ? `
      <div class="section">
        <div class="section-t">Why You Match</div>
        <ul class="reasons">
          ${alert.matchReasons.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>` : ''}

      <!-- How to apply -->
      <div class="section">
        <div class="section-t">How to Apply (5-8 minutes)</div>
        <ol class="step-list">
          ${(alert.prefillFields?.applyInstructions?.steps || [
            'Open the job link below',
            'Upload your tailored resume PDF',
            'Copy-paste the pre-filled form data',
            'Submit — done!',
          ]).map(s => `<li>${s}</li>`).join('')}
        </ol>
        ${alert.tailoredResumePdfUrl ? `<div class="tip-box"><strong>Your tailored resume is ready:</strong> <a href="${alert.tailoredResumePdfUrl}" style="color:#6c63ff;">Download PDF</a></div>` : ''}
      </div>

      <!-- Pre-filled data preview -->
      <div class="section">
        <div class="section-t">Pre-filled Application Data (copy from app)</div>
        <div class="prefill-box">${(prefillCard || '').slice(0, 1500)}...</div>
      </div>

      <!-- CTAs -->
      <div class="btn-row">
        <a href="${alert.jobUrl}" class="btn btn-p">Apply Now</a>
        <a href="${alertUrl}" class="btn btn-s">Full Packet in App</a>
        ${alert.tailoredResumePdfUrl ? `<a href="${alert.tailoredResumePdfUrl}" class="btn btn-s">Resume PDF</a>` : ''}
      </div>
    </div>

    <div class="footer">
      AutoApply AI found this for you. No auto-apply — you stay in control.<br>
      <a href="${appUrl}/alerts" style="color:#6c63ff;">View all job alerts</a> · 
      <a href="${appUrl}/settings" style="color:#6c63ff;">Manage notifications</a>
    </div>
  </div>
</div>
</body>
</html>`;

  try {
    await client.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || 'AutoApply AI <alerts@autoapply.ai>',
      to:      emailAddress,
      subject: `${alert.matchScore}% match: ${alert.title} at ${alert.company} — Application packet ready`,
      html,
    });
    logger.info(`Email alert sent to ${emailAddress}: ${alert.title}`);
    return true;
  } catch (err) {
    logger.error(`Email alert failed: ${err.message}`);
    return false;
  }
};

/**
 * Send both WhatsApp + Email alerts for a job.
 */
const sendJobAlert = async (user, alert, prefillCard) => {
  const ns = user.notificationSettings || {};
  const results = { whatsapp: false, email: false };

  if (ns.whatsappEnabled && ns.whatsappNumber) {
    results.whatsapp = await sendWhatsAppAlert(ns.whatsappNumber, alert);
  }
  if (ns.emailEnabled && ns.emailAddress) {
    results.email = await sendEmailAlert(ns.emailAddress, alert, prefillCard);
  }

  return results;
};

module.exports = { sendJobAlert, sendWhatsAppAlert, sendEmailAlert };
