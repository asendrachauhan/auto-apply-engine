'use strict';
jest.mock('../../../src/config/stripe', () => ({
  getStripe: jest.fn(),
}));
jest.mock('../../../src/middleware/auth.middleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: { toString: () => 'user1' }, email: 'jane@example.com', referralPoints: 80 };
    next();
  },
}));
// Mock featureFlags so isPaymentsEnabled() resolves immediately without a DB round-trip.
// Without this, the Mongoose connection attempt times out after 10s and the cache
// falls back to "enabled" anyway — but only after a 10s wait that blows Jest's testTimeout.
jest.mock('../../../src/config/featureFlags.service', () => ({
  isPaymentsEnabled:  jest.fn().mockResolvedValue(true),
  isReferralsEnabled: jest.fn().mockResolvedValue(true),
  getEffectivePlanId: jest.fn(async (plan) => plan),
  getFlags: jest.fn().mockResolvedValue({ paymentsEnabled: true, referralsEnabled: true }),
}));

jest.setTimeout(35000);

const express = require('express');
const request = require('supertest');

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.APP_URL = 'https://app.autoapply.ai';
// Required: the checkout route resolves priceId from PLANS_CONFIG[plan].stripePriceId,
// which reads these env vars. Without them, priceId is null and every checkout
// returns 400 "Invalid plan" regardless of whether the plan name is valid.
process.env.STRIPE_PRICE_STARTER = 'price_dummy_starter';
process.env.STRIPE_PRICE_PRO     = 'price_dummy_pro';
process.env.STRIPE_PRICE_ELITE   = 'price_dummy_elite';

let mockCreateSession;
let mockCreateCoupon;

const buildApp = () => {
  const { getStripe } = require('../../../src/config/stripe');
  mockCreateSession = jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session_abc' });
  mockCreateCoupon  = jest.fn().mockResolvedValue({ id: 'coupon_abc' });
  getStripe.mockReturnValue({
    checkout: { sessions: { create: mockCreateSession } },
    coupons:  { create: mockCreateCoupon },
  });

  const subscriptionRoutes = require('../../../src/routes/subscription.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/subscription', subscriptionRoutes);
  return app;
};

describe('subscription.routes — POST /create-checkout', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('rejects an invalid/unknown plan before touching Stripe', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'not-a-real-plan' });
    expect(res.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test('creates a checkout session for a valid plan with no points redeemed', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe('https://checkout.stripe.com/session_abc');
    expect(mockCreateCoupon).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      customer_email: 'jane@example.com',
      metadata: { userId: 'user1', plan: 'pro', redeemedPoints: '0' },
    }));
  });

  test('rejects redeeming more points than the user actually has', async () => {
    const app = buildApp(); // req.user.referralPoints = 80
    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'pro', redeemPoints: 500 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only have 80 referral points/i);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test('creates a one-time coupon and attaches it as a discount when redeeming a valid point amount', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'pro', redeemPoints: 50 });
    expect(res.status).toBe(200);
    expect(mockCreateCoupon).toHaveBeenCalledWith(expect.objectContaining({
      amount_off: 5000, // 50 points * REFERRAL_POINT_VALUE(1) * 100
      duration: 'once',
    }));
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      discounts: [{ coupon: 'coupon_abc' }],
      metadata: expect.objectContaining({ redeemedPoints: '50' }),
    }));
  });

  test('ignores a negative redeemPoints value (treated as 0, never goes negative)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'pro', redeemPoints: -20 });
    expect(res.status).toBe(200);
    expect(mockCreateCoupon).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ redeemedPoints: '0' }),
    }));
  });

  test('floors a fractional redeemPoints value instead of rejecting it', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'pro', redeemPoints: 10.9 });
    expect(res.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ redeemedPoints: '10' }),
    }));
  });

  test('returns 500 with a clear message when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = require('../../../src/config/stripe');
    getStripe.mockReturnValue(null);
    const subscriptionRoutes = require('../../../src/routes/subscription.routes');
    const app = express();
    app.use(express.json());
    app.use('/api/subscription', subscriptionRoutes);

    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'pro' });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/payments not configured/i);
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  });

  test('a Stripe API error is passed to next() and returns a clean error, not a crash', async () => {
    const app = buildApp();
    mockCreateSession.mockRejectedValue(new Error('Stripe API down'));
    const res = await request(app).post('/api/subscription/create-checkout').send({ plan: 'pro' });
    expect(res.status).toBe(500);
  });
});
