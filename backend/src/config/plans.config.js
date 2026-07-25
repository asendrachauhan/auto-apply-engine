/**
 * Plan catalog — single source of truth for pricing, limits, and feature
 * copy, all driven from environment variables so plans can be changed
 * (price, features, limits, trial length) without touching code.
 *
 * Every PLAN_* var below has a sensible default, so the app runs out of the
 * box; override any of them in .env to reconfigure without a deploy.
 */

const num  = (v, fallback) => (v !== undefined && v !== '' && !isNaN(Number(v))) ? Number(v) : fallback;
const bool = (v, fallback) => (v === undefined || v === '') ? fallback : v === 'true';
const list = (v, fallback) => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : fallback);

/**
 * Feature bullet lists are JSON arrays in the env (e.g.
 * PLAN_PRO_FEATURES=["50 applications/day","Real-time job detection"]).
 * Falls back to a sensible default list if unset or malformed.
 */
const features = (v, fallback) => {
  if (!v) return fallback;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const CURRENCY = process.env.PLAN_CURRENCY || 'INR';
const CURRENCY_SYMBOL = process.env.PLAN_CURRENCY_SYMBOL || '₹';

const PLANS_CONFIG = Object.freeze({
  free: {
    id: 'free', name: process.env.PLAN_FREE_NAME || 'Free',
    price: num(process.env.PLAN_FREE_PRICE, 0), period: 'forever', popular: false,
    dailyApply: num(process.env.PLAN_FREE_DAILY_LIMIT, 3),
    sources: list(process.env.PLAN_FREE_SOURCES, ['remotive', 'himalayas']),
    realtime: bool(process.env.PLAN_FREE_REALTIME, false),
    trialDays: 0,
    features: features(process.env.PLAN_FREE_FEATURES, [
      `${num(process.env.PLAN_FREE_DAILY_LIMIT, 3)} applications/day`,
      'Remotive + Himalayas',
      'Basic AI resume parsing',
      'Email notifications',
    ]),
    cta: process.env.PLAN_FREE_CTA || 'Get Started Free',
  },
  starter: {
    id: 'starter', name: process.env.PLAN_STARTER_NAME || 'Starter',
    price: num(process.env.PLAN_STARTER_PRICE, 299), period: 'month', popular: false,
    dailyApply: num(process.env.PLAN_STARTER_DAILY_LIMIT, 15),
    sources: list(process.env.PLAN_STARTER_SOURCES, ['remotive', 'himalayas', 'adzuna']),
    realtime: bool(process.env.PLAN_STARTER_REALTIME, false),
    trialDays: num(process.env.PLAN_STARTER_TRIAL_DAYS, 7),
    features: features(process.env.PLAN_STARTER_FEATURES, [
      `${num(process.env.PLAN_STARTER_DAILY_LIMIT, 15)} applications/day`,
      'Remotive + Himalayas + Adzuna',
      'AI resume tailoring per job',
      'Email + WhatsApp alerts',
      `${num(process.env.PLAN_STARTER_TRIAL_DAYS, 7)}-day free trial`,
    ]),
    cta: process.env.PLAN_STARTER_CTA || 'Start Free Trial',
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
  },
  pro: {
    id: 'pro', name: process.env.PLAN_PRO_NAME || 'Pro',
    price: num(process.env.PLAN_PRO_PRICE, 699), period: 'month', popular: bool(process.env.PLAN_PRO_POPULAR, true),
    dailyApply: num(process.env.PLAN_PRO_DAILY_LIMIT, 50),
    sources: list(process.env.PLAN_PRO_SOURCES, ['remotive', 'himalayas', 'adzuna', 'arbeitnow']),
    realtime: bool(process.env.PLAN_PRO_REALTIME, true),
    realtimeIntervalSeconds: num(process.env.PLAN_PRO_REALTIME_INTERVAL, 120),
    trialDays: num(process.env.PLAN_PRO_TRIAL_DAYS, 7),
    features: features(process.env.PLAN_PRO_FEATURES, [
      `${num(process.env.PLAN_PRO_DAILY_LIMIT, 50)} applications/day`,
      'All legal job boards incl. Arbeitnow',
      `Real-time job detection (${Math.round(num(process.env.PLAN_PRO_REALTIME_INTERVAL, 120) / 60)} min)`,
      'AI resume tailoring per job',
      'Full notifications',
      `${num(process.env.PLAN_PRO_TRIAL_DAYS, 7)}-day free trial`,
    ]),
    cta: process.env.PLAN_PRO_CTA || 'Go Pro',
    stripePriceId: process.env.STRIPE_PRICE_PRO || null,
  },
  elite: {
    id: 'elite', name: process.env.PLAN_ELITE_NAME || 'Elite',
    price: num(process.env.PLAN_ELITE_PRICE, 1499), period: 'month', popular: false,
    dailyApply: num(process.env.PLAN_ELITE_DAILY_LIMIT, 200),
    sources: list(process.env.PLAN_ELITE_SOURCES, ['remotive', 'himalayas', 'adzuna', 'arbeitnow']),
    realtime: bool(process.env.PLAN_ELITE_REALTIME, true),
    realtimeIntervalSeconds: num(process.env.PLAN_ELITE_REALTIME_INTERVAL, 60),
    trialDays: num(process.env.PLAN_ELITE_TRIAL_DAYS, 7),
    features: features(process.env.PLAN_ELITE_FEATURES, [
      `${num(process.env.PLAN_ELITE_DAILY_LIMIT, 200)} applications/day`,
      `Real-time detection (${Math.round(num(process.env.PLAN_ELITE_REALTIME_INTERVAL, 60) / 60)} min)`,
      'Priority apply queue',
      'Advanced analytics',
      'Priority support',
      `${num(process.env.PLAN_ELITE_TRIAL_DAYS, 7)}-day free trial`,
    ]),
    cta: process.env.PLAN_ELITE_CTA || 'Go Elite',
    stripePriceId: process.env.STRIPE_PRICE_ELITE || null,
  },
});

/** Public catalog for the frontend — pricing, features, limits. No secrets. */
const getPublicPlansConfig = () => ({
  currency: CURRENCY,
  currencySymbol: CURRENCY_SYMBOL,
  plans: Object.values(PLANS_CONFIG).map(p => ({
    id: p.id, name: p.name, price: p.price, period: p.period, popular: p.popular,
    features: p.features, cta: p.cta, trialDays: p.trialDays,
  })),
});

/** Internal limits lookup — same shape the old hardcoded PLAN_LIMITS had. */
const getPlanLimits = (planId) => {
  const p = PLANS_CONFIG[planId] || PLANS_CONFIG.free;
  return { dailyApply: p.dailyApply, sources: p.sources, realtime: p.realtime };
};

/** Real-time watcher poll interval for a plan, in seconds. */
const getRealtimeInterval = (planId) => {
  const p = PLANS_CONFIG[planId];
  return p?.realtimeIntervalSeconds || 120;
};

module.exports = { PLANS_CONFIG, getPublicPlansConfig, getPlanLimits, getRealtimeInterval };
