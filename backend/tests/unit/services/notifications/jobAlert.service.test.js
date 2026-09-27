'use strict';

const mockResendSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}));

const mockNodemailerSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: mockNodemailerSendMail,
  })),
}));

const mockTwilioCreate = jest.fn();
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: mockTwilioCreate,
    },
  }));
});

describe('jobAlert.service', () => {
  const originalEnv = process.env;
  let jobAlertService;

  const sampleAlert = {
    _id: 'alert-123',
    title: 'Senior Frontend Developer',
    company: 'Stripe',
    location: 'Remote',
    source: 'remoteok',
    matchScore: 88,
    jobUrl: 'https://example.com/apply/123',
    tailoredResumePdfUrl: 'https://res.cloudinary.com/demo/resume.pdf',
    matchReasons: ['Strong Angular proficiency', '5+ years frontend experience'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: 'mock-resend-key',
      TWILIO_ACCOUNT_SID: 'mock-twilio-sid',
      TWILIO_AUTH_TOKEN: 'mock-twilio-token',
      TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
      APP_URL: 'http://localhost:4200',
    };
    jest.isolateModules(() => {
      jobAlertService = require('../../../../src/services/notifications/jobAlert.service');
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('sendEmailAlert', () => {
    test('sends email successfully when API key is present', async () => {
      mockResendSend.mockResolvedValue({ data: { id: 'email-id-123' }, error: null });

      const result = await jobAlertService.sendEmailAlert('user@example.com', sampleAlert, 'Full Name: Jane Doe');
      expect(result).toBe(true);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringMatching(/88%\s*match/i),
          html: expect.stringContaining('Senior Frontend Developer'),
        })
      );
    });

    test('handles Resend error response without throwing', async () => {
      mockResendSend.mockResolvedValue({ data: null, error: { message: 'Invalid recipient email' } });

      const result = await jobAlertService.sendEmailAlert('invalid@example.com', sampleAlert);
      expect(result).toBe(false);
    });

    test('handles client exception without throwing', async () => {
      mockResendSend.mockRejectedValue(new Error('Network timeout'));

      const result = await jobAlertService.sendEmailAlert('user@example.com', sampleAlert);
      expect(result).toBe(false);
    });

    test('returns false if emailAddress is missing', async () => {
      const result = await jobAlertService.sendEmailAlert('', sampleAlert);
      expect(result).toBe(false);
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    test('falls back to SMTP when Resend fails and SMTP is configured', async () => {
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_USER = 'user@gmail.com';
      process.env.SMTP_PASS = 'pass123';
      mockResendSend.mockRejectedValue(new Error('Resend rate limit exceeded'));
      mockNodemailerSendMail.mockResolvedValue({ messageId: 'smtp-job-alert-fallback' });

      const result = await jobAlertService.sendEmailAlert('candidate@example.com', sampleAlert);
      expect(result).toBe(true);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockNodemailerSendMail).toHaveBeenCalledTimes(1);
      expect(mockNodemailerSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'candidate@example.com',
          subject: expect.stringMatching(/88%\s*match/i),
          html: expect.stringContaining('Senior Frontend Developer'),
        })
      );
    });
  });

  describe('sendWhatsAppAlert', () => {
    test('sends WhatsApp alert via Twilio client', async () => {
      mockTwilioCreate.mockResolvedValue({ sid: 'SM123456' });

      const result = await jobAlertService.sendWhatsAppAlert('+919876543210', sampleAlert);
      expect(result).toBe(true);
      expect(mockTwilioCreate).toHaveBeenCalledTimes(1);
      expect(mockTwilioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'whatsapp:+14155238886',
          to: 'whatsapp:+919876543210',
          body: expect.stringContaining('Senior Frontend Developer'),
        })
      );
    });

    test('handles Twilio error without throwing', async () => {
      mockTwilioCreate.mockRejectedValue(new Error('Twilio WhatsApp quota exceeded'));

      const result = await jobAlertService.sendWhatsAppAlert('+919876543210', sampleAlert);
      expect(result).toBe(false);
    });

    test('returns false if phoneNumber is missing', async () => {
      const result = await jobAlertService.sendWhatsAppAlert('', sampleAlert);
      expect(result).toBe(false);
      expect(mockTwilioCreate).not.toHaveBeenCalled();
    });
  });

  describe('sendJobAlert (combined dispatch)', () => {
    test('dispatches both email and whatsapp when user has both configured', async () => {
      mockResendSend.mockResolvedValue({ data: { id: 'email-id-123' }, error: null });
      mockTwilioCreate.mockResolvedValue({ sid: 'SM123456' });

      const user = {
        email: 'user@example.com',
        notificationSettings: {
          emailEnabled: true,
          emailAddress: 'user@example.com',
          whatsappEnabled: true,
          whatsappNumber: '+919876543210',
        },
      };

      const result = await jobAlertService.sendJobAlert(user, sampleAlert, 'Prefill Info');
      expect(result).toEqual({ email: true, whatsapp: true });
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockTwilioCreate).toHaveBeenCalledTimes(1);
    });

    test('skips email when emailEnabled is explicitly false', async () => {
      mockTwilioCreate.mockResolvedValue({ sid: 'SM123456' });

      const user = {
        email: 'user@example.com',
        notificationSettings: {
          emailEnabled: false,
          whatsappEnabled: true,
          whatsappNumber: '+919876543210',
        },
      };

      const result = await jobAlertService.sendJobAlert(user, sampleAlert);
      expect(result).toEqual({ email: false, whatsapp: true });
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockTwilioCreate).toHaveBeenCalledTimes(1);
    });

    test('falls back to user.email when notificationSettings.emailAddress is empty', async () => {
      mockResendSend.mockResolvedValue({ data: { id: 'email-id-123' }, error: null });

      const user = {
        email: 'fallback@example.com',
        notificationSettings: {
          emailEnabled: true,
        },
      };

      const result = await jobAlertService.sendJobAlert(user, sampleAlert);
      expect(result.email).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'fallback@example.com' })
      );
    });
  });
});
