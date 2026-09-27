/**
 * Quick Email Sender Verification Script
 * Tests whether Resend and/or Nodemailer SMTP are working properly.
 *
 * Usage:
 *   node scripts/test_email.js [recipient@example.com]
 */
'use strict';
require('dotenv').config();
const { sendWithFallback, isEmailConfigured, isResendConfigured, isSmtpConfigured } = require('../src/services/notifications/emailTransport');

async function testEmail() {
  const targetEmail = process.argv[2] || process.env.ALERT_EMAIL || 'asendrachauhan176@gmail.com';

  console.log('====================================================');
  console.log(' AutoApply AI — Email Transport Verification');
  console.log('====================================================');
  console.log(`Target Recipient : ${targetEmail}`);
  console.log(`Resend Configured: ${isResendConfigured() ? 'YES (RESEND_API_KEY set)' : 'NO'}`);
  console.log(`SMTP Configured  : ${isSmtpConfigured() ? 'YES' : 'NO'}`);
  if (isSmtpConfigured()) {
    console.log(`SMTP Service     : ${process.env.SMTP_SERVICE || 'custom'}`);
    console.log(`SMTP Host        : ${process.env.SMTP_HOST || '(using service)'}`);
    console.log(`SMTP User        : ${process.env.SMTP_USER || '(none)'}`);
  }
  console.log(`Provider Mode    : ${process.env.EMAIL_PROVIDER || 'auto'}`);
  console.log('----------------------------------------------------');

  if (!isEmailConfigured()) {
    console.error('❌ Error: Neither Resend nor SMTP is configured in backend/.env!');
    console.error('   Please add SMTP_USER and SMTP_PASS (e.g. Gmail App Password) to backend/.env.');
    process.exit(1);
  }

  console.log(`Dispatching test email to ${targetEmail}...`);

  try {
    const result = await sendWithFallback({
      to: targetEmail,
      subject: 'Test Email — AutoApply AI Email Transport',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #087CF5; margin-top: 0;">AutoApply AI Email Delivery Test</h2>
          <p>This is a verification test from your AutoApply AI server.</p>
          <div style="background-color: #f8fafc; padding: 12px 16px; border-radius: 8px; font-family: monospace;">
            Timestamp: ${new Date().toISOString()}
          </div>
          <p style="color: #10b981; font-weight: bold; margin-top: 20px;">
            Success: Your email delivery system is working without any domain requirement!
          </p>
        </div>
      `,
    });

    console.log('----------------------------------------------------');
    console.log(' SUCCESS! Email dispatched successfully.');
    console.log(` Provider used : ${result?.provider?.toUpperCase()}`);
    console.log(` Message / ID  : ${result?.id}`);
    console.log('====================================================');
  } catch (err) {
    console.error('----------------------------------------------------');
    console.error(`❌ Delivery Failed: ${err.message}`);
    console.log('====================================================');
    process.exit(1);
  }
}

testEmail();
