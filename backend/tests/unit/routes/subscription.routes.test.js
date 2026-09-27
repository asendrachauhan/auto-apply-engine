'use strict';
jest.mock('../../../src/config/stripe', () => ({
  getStripe: jest.fn(),
}));
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/ReferralReward');
jest.mock('../../../src/models/ProcessedWebhookEvent');
jest.mock('../../../src/services/notifications/notification.service', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
// Prevent Mongoose buffering timeouts on featureFlags reads that happen during module load.
jest.mock('../../../src/config/featureFlags.service', () => ({
  isPaymentsEnabled:  jest.fn().mockResolvedValue(true),
  isReferralsEnabled: jest.fn().mockResolvedValue(true),
  getEffectivePlanId: jest.fn(async (plan) => plan),
  getFlags: jest.fn().mockResolvedValue({ paymentsEnabled: true, referralsEnabled: true }),
}));

const express = require('express');
const request = require('supertest');
let User;
let ReferralReward;
let ProcessedWebhookEvent;

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

let mockConstructEvent;

const buildApp = () => {
  const { getStripe } = require('../../../src/config/stripe');
  User = require('../../../src/models/User');
  ReferralReward = require('../../../src/models/ReferralReward');
  ProcessedWebhookEvent = require('../../../src/models/ProcessedWebhookEvent');

  mockConstructEvent = jest.fn();
  getStripe.mockReturnValue({ webhooks: { constructEvent: mockConstructEvent } });

  ProcessedWebhookEvent.create = jest.fn().mockResolvedValue({});
  ProcessedWebhookEvent.deleteOne = jest.fn().mockResolvedValue({});

  const subscriptionRoutes = require('../../../src/routes/subscription.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/subscription', subscriptionRoutes);
  return app;
};

describe('subscription.routes — POST /webhook', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('returns 400 when Stripe signature verification fails', async () => {
    const app = buildApp();
    mockConstructEvent.mockImplementation(() => { throw new Error('bad signature'); });

    const res = await request(app)
      .post('/api/subscription/webhook')
      .set('stripe-signature', 'invalid')
      .send({ any: 'thing' });

    expect(res.status).toBe(400);
  }, 45_000);

  test('regression: checkout.session.completed saves stripeCustomerId onto the user (previously never persisted)', async () => {
    const app = buildApp();
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {
        customer: 'cus_abc123',
        metadata: { userId: 'user1', plan: 'pro', redeemedPoints: '0' },
      } },
    });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: 'user1', referredBy: null });

    const res = await request(app).post('/api/subscription/webhook').send({});
    expect(res.status).toBe(200);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ plan: 'pro', stripeCustomerId: 'cus_abc123' }),
      { new: true }
    );
  });

  test('debits redeemed referral points only after payment succeeds', async () => {
    const app = buildApp();
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {
        customer: 'cus_abc123',
        metadata: { userId: 'user1', plan: 'pro', redeemedPoints: '50' },
      } },
    });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: 'user1', referredBy: null });
    ReferralReward.create = jest.fn().mockResolvedValue({});

    await request(app).post('/api/subscription/webhook').send({});
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user1', { $inc: { referralPoints: -50 } });
    expect(ReferralReward.create).toHaveBeenCalledWith(
      expect.objectContaining({ points: -50, reason: 'redeemed_at_checkout' })
    );
  });

  test('credits the referrer only on the very first paid conversion (not repeat upgrades)', async () => {
    const app = buildApp();
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {
        customer: 'cus_abc123',
        metadata: { userId: 'user1', plan: 'pro', redeemedPoints: '0' },
      } },
    });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: 'user1', referredBy: 'referrer1', name: 'Test' });
    ReferralReward.exists = jest.fn().mockResolvedValue(true); // already credited before
    ReferralReward.create = jest.fn();

    await request(app).post('/api/subscription/webhook').send({});
    expect(ReferralReward.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'first_paid_plan' })
    );
  });

  test('downgrades user to free plan on customer.subscription.deleted', async () => {
    const app = buildApp();
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_abc123' } },
    });
    User.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: 'user1' });

    const res = await request(app).post('/api/subscription/webhook').send({});
    expect(res.status).toBe(200);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { stripeCustomerId: 'cus_abc123' },
      expect.objectContaining({ plan: 'free' })
    );
  });

  test('returns 200 without processing when Stripe is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const app = buildApp();
    const res = await request(app).post('/api/subscription/webhook').send({});
    expect(res.status).toBe(200);
    expect(mockConstructEvent).not.toHaveBeenCalled();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';
  });

  describe('idempotency (regression: redelivered events previously double-processed)', () => {
    test('a redelivered event (duplicate event.id) is skipped without reprocessing', async () => {
      const app = buildApp();
      mockConstructEvent.mockReturnValue({
        id: 'evt_123', type: 'checkout.session.completed',
        data: { object: { customer: 'cus_abc', metadata: { userId: 'user1', plan: 'pro', redeemedPoints: '0' } } },
      });
      const dupError = new Error('duplicate key'); dupError.code = 11000;
      ProcessedWebhookEvent.create.mockRejectedValue(dupError);

      const res = await request(app).post('/api/subscription/webhook').send({});
      expect(res.status).toBe(200);
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled(); // business logic never ran
    });

    test('regression: a genuinely new delivery of the SAME event twice in a row only processes once', async () => {
      const app = buildApp();
      mockConstructEvent.mockReturnValue({
        id: 'evt_456', type: 'checkout.session.completed',
        data: { object: { customer: 'cus_abc', metadata: { userId: 'user1', plan: 'pro', redeemedPoints: '50' } } },
      });
      User.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: 'user1', referredBy: null });
      ReferralReward.create = jest.fn().mockResolvedValue({});

      // First delivery: genuinely new
      await request(app).post('/api/subscription/webhook').send({});
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user1', { $inc: { referralPoints: -50 } });

      // Second delivery of the SAME event: now a duplicate
      const dupError = new Error('duplicate key'); dupError.code = 11000;
      ProcessedWebhookEvent.create.mockRejectedValue(dupError);
      User.findByIdAndUpdate.mockClear();

      const res2 = await request(app).post('/api/subscription/webhook').send({});
      expect(res2.status).toBe(200);
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled(); // no double-debit on redelivery
    });

    test('an unexpected error during business logic removes the idempotency marker so a real Stripe retry can still succeed later', async () => {
      const app = buildApp();
      mockConstructEvent.mockReturnValue({
        id: 'evt_789', type: 'checkout.session.completed',
        data: { object: { customer: 'cus_abc', metadata: { userId: 'user1', plan: 'pro', redeemedPoints: '0' } } },
      });
      User.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app).post('/api/subscription/webhook').send({});
      expect(res.status).toBe(500); // Stripe will retry
      expect(ProcessedWebhookEvent.deleteOne).toHaveBeenCalledWith({ stripeEventId: 'evt_789' });
    });

    test('a failure recording the idempotency marker itself (not a duplicate) returns 500 without running business logic', async () => {
      const app = buildApp();
      mockConstructEvent.mockReturnValue({ id: 'evt_999', type: 'checkout.session.completed', data: { object: {} } });
      ProcessedWebhookEvent.create.mockRejectedValue(new Error('Mongo unavailable'));

      const res = await request(app).post('/api/subscription/webhook').send({});
      expect(res.status).toBe(500);
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
