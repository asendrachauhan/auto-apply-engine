'use strict';
jest.mock('../../../src/config/stripe');
jest.mock('../../../src/config/featureFlags.service');
jest.mock('../../../src/services/audit/auditLog.service', () => ({ record: jest.fn().mockResolvedValue(undefined) }));

const { getStripe } = require('../../../src/config/stripe');
const featureFlags = require('../../../src/config/featureFlags.service');
const audit = require('../../../src/services/audit/auditLog.service');
const {
  getFeatureFlagsAdmin, putFeatureFlags, listCoupons, createCoupon, deactivateCoupon,
} = require('../../../src/controllers/admin.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockReq = (overrides = {}) => ({ body: {}, params: {}, user: { _id: 'admin1', email: 'admin@x.com' }, ...overrides });

describe('admin.controller — feature flags (Session 37)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getFeatureFlagsAdmin returns the current real state', async () => {
    featureFlags.getFlags.mockResolvedValue({ paymentsEnabled: true, referralsEnabled: false });
    const req = mockReq(); const res = mockRes();
    await getFeatureFlagsAdmin(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toEqual({ paymentsEnabled: true, referralsEnabled: false });
  });

  test('putFeatureFlags rejects an empty body — nothing to update', async () => {
    const req = mockReq({ body: {} }); const res = mockRes();
    await putFeatureFlags(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(featureFlags.setPaymentsEnabled).not.toHaveBeenCalled();
  });

  test('putFeatureFlags(paymentsEnabled: false) calls the real setter, not the generic settings path', async () => {
    featureFlags.setPaymentsEnabled.mockResolvedValue();
    featureFlags.getFlags.mockResolvedValue({ paymentsEnabled: false, referralsEnabled: true });
    const req = mockReq({ body: { paymentsEnabled: false } }); const res = mockRes();
    await putFeatureFlags(req, res, jest.fn());
    expect(featureFlags.setPaymentsEnabled).toHaveBeenCalledWith(false, 'admin1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('regression (Session 39): toggling payments writes a real audit trail entry — this used to be a logger.info line only', async () => {
    featureFlags.setPaymentsEnabled.mockResolvedValue();
    featureFlags.getFlags.mockResolvedValue({ paymentsEnabled: false, referralsEnabled: true });
    const req = mockReq({ body: { paymentsEnabled: false } }); const res = mockRes();
    await putFeatureFlags(req, res, jest.fn());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin_payments_toggled', actorId: 'admin1', metadata: { enabled: false },
    }));
  });

  test('regression (Session 39): toggling referrals writes its own distinct audit action', async () => {
    featureFlags.setReferralsEnabled.mockResolvedValue();
    featureFlags.getFlags.mockResolvedValue({ paymentsEnabled: true, referralsEnabled: false });
    const req = mockReq({ body: { referralsEnabled: false } }); const res = mockRes();
    await putFeatureFlags(req, res, jest.fn());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin_referrals_toggled', actorId: 'admin1', metadata: { enabled: false },
    }));
    expect(audit.record).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_payments_toggled' }));
  });

  test('putFeatureFlags can update both flags in one call', async () => {
    featureFlags.setPaymentsEnabled.mockResolvedValue();
    featureFlags.setReferralsEnabled.mockResolvedValue();
    featureFlags.getFlags.mockResolvedValue({ paymentsEnabled: false, referralsEnabled: false });
    const req = mockReq({ body: { paymentsEnabled: false, referralsEnabled: false } }); const res = mockRes();
    await putFeatureFlags(req, res, jest.fn());
    expect(featureFlags.setPaymentsEnabled).toHaveBeenCalledWith(false, 'admin1');
    expect(featureFlags.setReferralsEnabled).toHaveBeenCalledWith(false, 'admin1');
  });
});

describe('admin.controller — coupons (Session 37)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a clear error, not a crash, when Stripe is not configured', async () => {
    getStripe.mockReturnValue(null);
    const req = mockReq({ body: { code: 'TEST20', percentOff: 20 } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('rejects a missing/invalid code before ever calling Stripe', async () => {
    const s = { coupons: { create: jest.fn() } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { percentOff: 20 } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(s.coupons.create).not.toHaveBeenCalled();
  });

  test('rejects a code with disallowed characters', async () => {
    const s = { coupons: { create: jest.fn() } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'bad code!', percentOff: 20 } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(s.coupons.create).not.toHaveBeenCalled();
  });

  test('rejects providing both percentOff and amountOff', async () => {
    const s = { coupons: { create: jest.fn() } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'TEST20', percentOff: 20, amountOff: 100 } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(s.coupons.create).not.toHaveBeenCalled();
  });

  test('rejects providing neither percentOff nor amountOff', async () => {
    const s = { coupons: { create: jest.fn() } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'TEST20' } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects percentOff outside 1-100', async () => {
    const s = { coupons: { create: jest.fn() } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'TEST', percentOff: 150 } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects duration=repeating without durationInMonths', async () => {
    const s = { coupons: { create: jest.fn() } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'TEST20', percentOff: 20, duration: 'repeating' } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(s.coupons.create).not.toHaveBeenCalled();
  });

  test('happy path: creates both a coupon and a promotion code, amountOff converted to smallest currency unit', async () => {
    const s = {
      coupons: { create: jest.fn().mockResolvedValue({ id: 'coupon_1' }) },
      promotionCodes: { create: jest.fn().mockResolvedValue({ id: 'promo_1', code: 'SAVE100' }) },
    };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'save100', amountOff: 100, duration: 'once' } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());

    expect(s.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ amount_off: 10000, duration: 'once' }));
    expect(s.promotionCodes.create).toHaveBeenCalledWith(expect.objectContaining({ coupon: 'coupon_1', code: 'SAVE100' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('regression (Session 39): a successful coupon creation writes an audit trail entry with the code and discount', async () => {
    const s = {
      coupons: { create: jest.fn().mockResolvedValue({ id: 'coupon_1' }) },
      promotionCodes: { create: jest.fn().mockResolvedValue({ id: 'promo_1', code: 'SAVE20' }) },
    };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'save20', percentOff: 20, duration: 'once' } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin_coupon_created', actorId: 'admin1',
      metadata: { code: 'SAVE20', discount: '20%', duration: 'once' },
    }));
  });

  test('regression (Session 39): a rejected coupon creation (validation failure) does NOT write an audit entry', async () => {
    const s = { coupons: { create: jest.fn() } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'TEST20', percentOff: 20, amountOff: 100 } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(audit.record).not.toHaveBeenCalled();
  });

  test('a Stripe-thrown error (e.g. duplicate code) surfaces its real message, not a generic 500', async () => {
    const stripeErr = new Error('A coupon with this code already exists');
    stripeErr.type = 'StripeInvalidRequestError';
    const s = { coupons: { create: jest.fn() }, promotionCodes: { create: jest.fn().mockRejectedValue(stripeErr) } };
    s.coupons.create.mockResolvedValue({ id: 'coupon_1' });
    getStripe.mockReturnValue(s);
    const req = mockReq({ body: { code: 'DUP', percentOff: 10 } }); const res = mockRes();
    await createCoupon(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('A coupon with this code already exists');
  });

  test('listCoupons maps Stripe promotion codes into the expected shape', async () => {
    const s = {
      promotionCodes: {
        list: jest.fn().mockResolvedValue({
          data: [{
            id: 'promo_1', code: 'SAVE20', active: true, times_redeemed: 3, max_redemptions: 10,
            expires_at: null, created: 1755700000,
            coupon: { percent_off: 20, amount_off: null, currency: null, duration: 'once', duration_in_months: null },
          }],
        }),
      },
    };
    getStripe.mockReturnValue(s);
    const req = mockReq(); const res = mockRes();
    await listCoupons(req, res, jest.fn());
    expect(res.json.mock.calls[0][0].data[0]).toEqual(expect.objectContaining({ code: 'SAVE20', percentOff: 20, timesRedeemed: 3 }));
  });

  test('deactivateCoupon sets active:false via Stripe, does not delete', async () => {
    const s = { promotionCodes: { update: jest.fn().mockResolvedValue({ id: 'promo_1', code: 'SAVE20' }) } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ params: { id: 'promo_1' } }); const res = mockRes();
    await deactivateCoupon(req, res, jest.fn());
    expect(s.promotionCodes.update).toHaveBeenCalledWith('promo_1', { active: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('regression (Session 39): deactivating a coupon writes an audit trail entry', async () => {
    const s = { promotionCodes: { update: jest.fn().mockResolvedValue({ id: 'promo_1', code: 'SAVE20' }) } };
    getStripe.mockReturnValue(s);
    const req = mockReq({ params: { id: 'promo_1' } }); const res = mockRes();
    await deactivateCoupon(req, res, jest.fn());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin_coupon_deactivated', actorId: 'admin1', metadata: { code: 'SAVE20' },
    }));
  });
});
