'use strict';

/**
 * Feature flags — real, enforced toggles, not just display config.
 *
 * Session 37: the person running this app asked for a real production
 * control panel where disabling payments actually hides the paid UI AND
 * makes the backend enforce free access, not just change what a settings
 * screen displays. The existing SystemSetting DB-override layer
 * (config/systemSettings.service.js) already had exactly this gap
 * documented in its own header comment: DB overrides only affected the
 * public plan catalog display, not real enforcement, which stayed
 * env/boot-time driven. This module closes that gap for two specific
 * flags by being read live, at request time, at every real enforcement
 * choke point (job-source gating, daily-apply-limit gating, real-time
 * watcher access, checkout/billing-portal access, referral-code
 * application at registration) — see each call site for where.
 *
 * Keys (via SystemSetting, category 'features'):
 *   feature.payments.enabled  — boolean, default true
 *   feature.referrals.enabled — boolean, default true
 *
 * PAYMENTS DISABLED means: the whole product becomes free — every plan
 * limit check treats every user as if on the top tier (elite), checkout
 * and the billing portal are blocked with a clear message, and the
 * paid-plan UI hides itself on the frontend. It does NOT mean stored
 * `user.plan` values are mutated — this is a live override layer, fully
 * reversible by flipping the toggle back, not a destructive bulk write.
 *
 * REFERRALS DISABLED means: no new referral code is applied at
 * registration (existing referredBy relationships and past reward
 * history are untouched — this only affects new activity), and the
 * frontend hides the referral program's UI.
 *
 * Caching: an in-memory cache with a short TTL (default 30s, tunable via
 * FEATURE_FLAG_CACHE_TTL_SECONDS) avoids a DB round-trip on every single
 * request through these very hot call sites. Writes THROUGH setSetting()
 * below invalidate the cache immediately, so an admin toggle takes effect
 * on the very next request — the 30s window only matters for staleness
 * from writes made some other way (direct DB edit), which isn't the
 * expected path.
 */
const { getSetting, setSetting } = require('./systemSettings.service');
const { PLAN } = require('../utils/constants');
const logger = require('../utils/logger');

const CACHE_TTL_MS = (Number(process.env.FEATURE_FLAG_CACHE_TTL_SECONDS) || 30) * 1000;
const PAYMENTS_KEY  = 'feature.payments.enabled';
const REFERRALS_KEY = 'feature.referrals.enabled';

let cache = { paymentsEnabled: null, referralsEnabled: null, fetchedAt: 0 };

const refresh = async () => {
  try {
    const [paymentsVal, referralsVal] = await Promise.all([
      getSetting(PAYMENTS_KEY, true),
      getSetting(REFERRALS_KEY, true),
    ]);
    cache = {
      paymentsEnabled:  paymentsVal !== false, // anything but explicit false stays enabled
      referralsEnabled: referralsVal !== false,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    // Fail open to "enabled" (the pre-Session-37 behavior) rather than
    // accidentally locking payments/referrals off for everyone because of
    // a transient DB error — a feature-flag read failure shouldn't be
    // able to take down checkout.
    logger.error(`[FeatureFlags] refresh failed, defaulting to enabled: ${err.message}`);
    cache = { paymentsEnabled: true, referralsEnabled: true, fetchedAt: Date.now() };
  }
};

const getFlags = async () => {
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) await refresh();
  return { paymentsEnabled: cache.paymentsEnabled, referralsEnabled: cache.referralsEnabled };
};

const isPaymentsEnabled  = async () => (await getFlags()).paymentsEnabled;
const isReferralsEnabled = async () => (await getFlags()).referralsEnabled;

/**
 * The plan ID to use for every limit-gating decision. When payments are
 * disabled, everyone is treated as 'elite' (top tier, unlocks everything)
 * regardless of their stored `user.plan` — this is the actual "make it
 * free" behavior, computed live rather than by mutating stored data.
 */
const getEffectivePlanId = async (userPlanId) => {
  return (await isPaymentsEnabled()) ? userPlanId : PLAN.ELITE;
};

/** Admin-panel write path — goes through here (not setSetting directly) so the cache invalidates immediately instead of waiting out the TTL. */
const setPaymentsEnabled = async (enabled, updatedBy = null) => {
  await setSetting(PAYMENTS_KEY, Boolean(enabled), 'features', updatedBy);
  cache.fetchedAt = 0; // force a refresh on next read
};

const setReferralsEnabled = async (enabled, updatedBy = null) => {
  await setSetting(REFERRALS_KEY, Boolean(enabled), 'features', updatedBy);
  cache.fetchedAt = 0;
};

module.exports = {
  isPaymentsEnabled, isReferralsEnabled, getEffectivePlanId,
  setPaymentsEnabled, setReferralsEnabled, getFlags,
  PAYMENTS_KEY, REFERRALS_KEY,
};
