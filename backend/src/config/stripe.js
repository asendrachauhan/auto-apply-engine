'use strict';

/**
 * Shared Stripe client — lazy singleton so the app boots fine without
 * STRIPE_SECRET_KEY set (payments/coupons just won't work until it is).
 * Extracted from subscription.routes.js's original inline pattern
 * (Session 37) so the admin coupon endpoints can reuse the same client
 * instead of re-implementing the lazy-init check.
 */
let stripe = null;
const isConfiguredKey = (k) => Boolean(k && !k.includes('xxxx') && !k.includes('your_') && k.startsWith('sk_'));

const getStripe = () => {
  if (!stripe && isConfiguredKey(process.env.STRIPE_SECRET_KEY)) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

module.exports = { getStripe };
