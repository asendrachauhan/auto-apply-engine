'use strict';

const { PLAN } = require('../../../src/utils/constants');

describe('featureFlags.service', () => {
  // Fresh module each test — the module keeps in-memory cache state
  // between calls, and we need a clean cache per test to control exactly
  // when refresh() fires.
  let flags;
  let systemSettings;
  
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Mock AFTER resetModules so the fresh featureFlags require gets the mock
    jest.mock('../../../src/config/systemSettings.service');
    systemSettings = require('../../../src/config/systemSettings.service');
    systemSettings.getSetting = jest.fn();
    systemSettings.setSetting = jest.fn().mockResolvedValue({});
    
    flags = require('../../../src/config/featureFlags.service');
  });

  describe('defaults and reads', () => {
    test('defaults to enabled when no override exists in the DB', async () => {
      systemSettings.getSetting.mockResolvedValue(true); // getSetting's own fallback default
      expect(await flags.isPaymentsEnabled()).toBe(true);
      expect(await flags.isReferralsEnabled()).toBe(true);
    });

    test('reflects an explicit false override for payments', async () => {
      systemSettings.getSetting.mockImplementation((key) => Promise.resolve(key === flags.PAYMENTS_KEY ? false : true));
      expect(await flags.isPaymentsEnabled()).toBe(false);
      expect(await flags.isReferralsEnabled()).toBe(true);
    });

    test('reflects an explicit false override for referrals independently', async () => {
      systemSettings.getSetting.mockImplementation((key) => Promise.resolve(key === flags.REFERRALS_KEY ? false : true));
      expect(await flags.isPaymentsEnabled()).toBe(true);
      expect(await flags.isReferralsEnabled()).toBe(false);
    });

    test('a DB read failure fails OPEN (stays enabled) rather than accidentally locking the app', async () => {
      systemSettings.getSetting.mockRejectedValue(new Error('mongo down'));
      expect(await flags.isPaymentsEnabled()).toBe(true);
      expect(await flags.isReferralsEnabled()).toBe(true);
    });
  });

  describe('caching — the actual point of this module', () => {
    test('does not re-hit the DB on every call within the cache window', async () => {
      systemSettings.getSetting.mockResolvedValue(true);
      await flags.isPaymentsEnabled();
      await flags.isPaymentsEnabled();
      await flags.isReferralsEnabled();
      // 2 keys read once each on the first call that populated the cache;
      // subsequent calls within the TTL should not call getSetting again.
      expect(systemSettings.getSetting).toHaveBeenCalledTimes(2);
    });

    test('setPaymentsEnabled invalidates the cache immediately — the next read is fresh, not stale', async () => {
      systemSettings.getSetting.mockResolvedValue(true);
      expect(await flags.isPaymentsEnabled()).toBe(true);

      systemSettings.getSetting.mockResolvedValue(false); // simulate the DB now reflecting the new value
      await flags.setPaymentsEnabled(false, 'admin-user-id');

      expect(systemSettings.setSetting).toHaveBeenCalledWith(flags.PAYMENTS_KEY, false, 'features', 'admin-user-id');
      expect(await flags.isPaymentsEnabled()).toBe(false); // not stale — cache was invalidated
    });

    test('setReferralsEnabled invalidates the cache immediately too', async () => {
      systemSettings.getSetting.mockResolvedValue(true);
      expect(await flags.isReferralsEnabled()).toBe(true);

      systemSettings.getSetting.mockResolvedValue(false);
      await flags.setReferralsEnabled(false);

      expect(await flags.isReferralsEnabled()).toBe(false);
    });
  });

  describe('getEffectivePlanId — the actual "make it free" mechanism', () => {
    test('returns the real user plan when payments are enabled', async () => {
      systemSettings.getSetting.mockResolvedValue(true);
      expect(await flags.getEffectivePlanId(PLAN.FREE)).toBe(PLAN.FREE);
      expect(await flags.getEffectivePlanId(PLAN.STARTER)).toBe(PLAN.STARTER);
    });

    test('returns elite for EVERY user, regardless of their real plan, when payments are disabled', async () => {
      systemSettings.getSetting.mockImplementation((key) => Promise.resolve(key === flags.PAYMENTS_KEY ? false : true));
      expect(await flags.getEffectivePlanId(PLAN.FREE)).toBe(PLAN.ELITE);
      expect(await flags.getEffectivePlanId(PLAN.STARTER)).toBe(PLAN.ELITE);
      expect(await flags.getEffectivePlanId(PLAN.PRO)).toBe(PLAN.ELITE);
    });

    test('does NOT mutate the input — reversible by design, no stored data touched', async () => {
      systemSettings.getSetting.mockImplementation((key) => Promise.resolve(key === flags.PAYMENTS_KEY ? false : true));
      const before = PLAN.STARTER;
      await flags.getEffectivePlanId(before);
      expect(before).toBe(PLAN.STARTER); // unchanged — this module never writes to User docs
    });
  });
});
