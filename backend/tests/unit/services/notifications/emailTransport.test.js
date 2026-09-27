'use strict';

const mockResendSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}));

const mockSmtpSendMail = jest.fn();
const mockSmtpVerify = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: mockSmtpSendMail,
    verify: mockSmtpVerify,
  })),
}));

describe('emailTransport & email.service', () => {
  const originalEnv = process.env;
  let emailTransport;
  let emailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_SERVICE;
    delete process.env.EMAIL_PROVIDER;

    jest.isolateModules(() => {
      emailTransport = require('../../../../src/services/notifications/emailTransport');
      emailService = require('../../../../src/services/notifications/email.service');
      emailTransport._resetClientsForTesting();
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Configuration checks', () => {
    test('reports false when neither Resend nor SMTP is configured', () => {
      expect(emailTransport.isResendConfigured()).toBe(false);
      expect(emailTransport.isSmtpConfigured()).toBe(false);
      expect(emailTransport.isEmailConfigured()).toBe(false);
    });

    test('detects Resend when RESEND_API_KEY is present', () => {
      process.env.RESEND_API_KEY = 're_test_key';
      expect(emailTransport.isResendConfigured()).toBe(true);
      expect(emailTransport.isEmailConfigured()).toBe(true);
    });

    test('detects SMTP when host, user, and pass are present', () => {
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_USER = 'user@gmail.com';
      process.env.SMTP_PASS = 'secretpass';
      expect(emailTransport.isSmtpConfigured()).toBe(true);
      expect(emailTransport.isEmailConfigured()).toBe(true);
    });

    test('detects SMTP when service is present with credentials', () => {
      process.env.SMTP_SERVICE = 'gmail';
      process.env.SMTP_USER = 'user@gmail.com';
      process.env.SMTP_PASS = 'secretpass';
      expect(emailTransport.isSmtpConfigured()).toBe(true);
    });
  });

  describe('sendWithFallback behavior', () => {
    test('returns null when recipient or subject is missing', async () => {
      process.env.RESEND_API_KEY = 're_123';
      const result = await emailTransport.sendWithFallback({ to: '', subject: 'Hi' });
      expect(result).toBeNull();
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    test('returns null when no provider is configured', async () => {
      const result = await emailTransport.sendWithFallback({ to: 'candidate@test.com', subject: 'Hi' });
      expect(result).toBeNull();
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockSmtpSendMail).not.toHaveBeenCalled();
    });

    test('sends via Resend when Resend is configured and healthy', async () => {
      process.env.RESEND_API_KEY = 're_123';
      mockResendSend.mockResolvedValue({ data: { id: 'resend-msg-99' }, error: null });

      const result = await emailTransport.sendWithFallback({
        to: 'candidate@test.com',
        subject: 'Job Match',
        html: '<p>You matched!</p>',
      });

      expect(result).toEqual({ success: true, provider: 'resend', id: 'resend-msg-99' });
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockSmtpSendMail).not.toHaveBeenCalled();
    });

    test('falls back to SMTP when Resend returns an API error', async () => {
      process.env.RESEND_API_KEY = 're_123';
      process.env.SMTP_HOST = 'smtp-relay.brevo.com';
      process.env.SMTP_USER = 'brevo@test.com';
      process.env.SMTP_PASS = 'brevo-pass';

      mockResendSend.mockResolvedValue({
        data: null,
        error: { message: 'You can only send testing emails to your own email address' },
      });
      mockSmtpSendMail.mockResolvedValue({ messageId: 'smtp-fallback-001', response: '250 OK' });

      const result = await emailTransport.sendWithFallback({
        to: 'external-candidate@domain.com',
        subject: 'Welcome to AutoApply',
        html: '<p>Welcome!</p>',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('smtp');
      expect(result.id).toBe('smtp-fallback-001');
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockSmtpSendMail).toHaveBeenCalledTimes(1);
      expect(mockSmtpSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'external-candidate@domain.com',
          subject: 'Welcome to AutoApply',
        })
      );
    });

    test('falls back to SMTP when Resend throws network exception', async () => {
      process.env.RESEND_API_KEY = 're_123';
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_USER = 'mygmail@gmail.com';
      process.env.SMTP_PASS = 'app-password';

      mockResendSend.mockRejectedValue(new Error('ETIMEDOUT connecting to api.resend.com'));
      mockSmtpSendMail.mockResolvedValue({ messageId: 'gmail-fallback-002', response: '250 OK' });

      const result = await emailTransport.sendWithFallback({
        to: 'applicant@test.com',
        subject: 'Application Submitted',
        html: '<p>Submitted</p>',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('smtp');
      expect(result.id).toBe('gmail-fallback-002');
    });

    test('dispatches directly via SMTP when RESEND_API_KEY is unset but SMTP is configured', async () => {
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_USER = 'user@gmail.com';
      process.env.SMTP_PASS = 'pwd';
      mockSmtpSendMail.mockResolvedValue({ messageId: 'direct-smtp-003' });

      const result = await emailTransport.sendWithFallback({
        to: 'user@test.com',
        subject: 'Direct SMTP test',
        html: '<b>Hello</b>',
      });

      expect(result.provider).toBe('smtp');
      expect(result.id).toBe('direct-smtp-003');
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockSmtpSendMail).toHaveBeenCalledTimes(1);
    });

    test('throws when both Resend and SMTP fallback fail', async () => {
      process.env.RESEND_API_KEY = 're_123';
      process.env.SMTP_HOST = 'smtp.badhost.com';
      process.env.SMTP_USER = 'u';
      process.env.SMTP_PASS = 'p';

      mockResendSend.mockRejectedValue(new Error('Resend 500'));
      mockSmtpSendMail.mockRejectedValue(new Error('SMTP Auth Failed'));

      await expect(
        emailTransport.sendWithFallback({
          to: 'user@test.com',
          subject: 'Double Fail',
          html: 'test',
        })
      ).rejects.toThrow(/Email failed \(Resend: Resend 500 \| SMTP fallback: SMTP Auth Failed\)/);
    });

    test('respects EMAIL_PROVIDER=smtp override directly', async () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.RESEND_API_KEY = 're_123';
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_USER = 'user@gmail.com';
      process.env.SMTP_PASS = 'pass';
      mockSmtpSendMail.mockResolvedValue({ messageId: 'forced-smtp-004' });

      const result = await emailTransport.sendWithFallback({
        to: 'user@test.com',
        subject: 'Forced SMTP',
        html: 'test',
      });

      expect(result.provider).toBe('smtp');
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockSmtpSendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('email.service template helper methods', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 're_123';
      mockResendSend.mockResolvedValue({ data: { id: 'template-send-id' }, error: null });
    });

    test('sendVerificationEmail dispatches with verification token link', async () => {
      const res = await emailService.sendVerificationEmail('jane@domain.com', 'Jane', 'https://example.com/verify?token=123');
      expect(res.id).toBe('template-send-id');
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@domain.com',
          subject: expect.stringMatching(/verify/i),
          html: expect.stringContaining('https://example.com/verify?token=123'),
        })
      );
    });

    test('sendPasswordResetEmail dispatches with reset token link', async () => {
      const res = await emailService.sendPasswordResetEmail('jane@domain.com', 'Jane', 'https://example.com/reset?token=xyz');
      expect(res.id).toBe('template-send-id');
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@domain.com',
          subject: expect.stringMatching(/reset/i),
          html: expect.stringContaining('https://example.com/reset?token=xyz'),
        })
      );
    });

    test('sendApplicationEmail dispatches with job application details', async () => {
      const res = await emailService.sendApplicationEmail('jane@domain.com', 'Jane', {
        jobTitle: 'Senior Full Stack Engineer',
        company: 'Stripe',
        matchScore: 92,
        jobUrl: 'https://stripe.com/jobs/1',
      });
      expect(res.id).toBe('template-send-id');
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@domain.com',
          subject: expect.stringMatching(/applied|application/i),
          html: expect.stringContaining('Senior Full Stack Engineer'),
        })
      );
    });

    test('sendWelcomeEmail dispatches with dashboard link', async () => {
      const res = await emailService.sendWelcomeEmail('jane@domain.com', 'Jane', 'https://example.com/dashboard');
      expect(res.id).toBe('template-send-id');
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@domain.com',
          subject: expect.stringMatching(/welcome/i),
        })
      );
    });

    test('sendPlanUpgradeEmail dispatches with plan details', async () => {
      const res = await emailService.sendPlanUpgradeEmail('jane@domain.com', 'Jane', {
        planName: 'Pro',
        interval: 'month',
        amount: 499,
        currency: 'inr',
      });
      expect(res.id).toBe('template-send-id');
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@domain.com',
          subject: expect.stringMatching(/pro|plan|upgrade|subscription/i),
        })
      );
    });
  });
});
