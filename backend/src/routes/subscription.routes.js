'use strict';
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User    = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP, PLAN, PLAN_LIMITS } = require('../utils/constants');
const { PLANS_CONFIG } = require('../config/plans.config');
const logger  = require('../utils/logger');

let stripe = null;
const getStripe = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripe;
};

const PRICE_MAP = {
  [PLAN.STARTER]: PLANS_CONFIG.starter.stripePriceId,
  [PLAN.PRO]:     PLANS_CONFIG.pro.stripePriceId,
  [PLAN.ELITE]:   PLANS_CONFIG.elite.stripePriceId,
};

// POST /api/subscription/create-checkout
router.post('/create-checkout', protect, async (req, res, next) => {
  try {
    const { plan } = req.body;
    const priceId = PRICE_MAP[plan];
    if (!priceId) return sendError(res, HTTP.BAD_REQUEST, 'Invalid plan');
    const s = getStripe();
    if (!s) return sendError(res, HTTP.SERVER_ERROR, 'Payments not configured');
    const session = await s.checkout.sessions.create({
      mode:                'subscription',
      payment_method_types:['card'],
      customer_email:      req.user.email,
      line_items:          [{ price: priceId, quantity: 1 }],
      success_url:         `${process.env.APP_URL}/plans?success=true`,
      cancel_url:          `${process.env.APP_URL}/plans?cancelled=true`,
      metadata:            { userId: req.user._id.toString(), plan },
    });
    return sendSuccess(res, HTTP.OK, 'Checkout session created', { url: session.url });
  } catch (err) { next(err); }
});

// POST /api/subscription/webhook (raw body — mounted before json parser in app.js)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const s = getStripe();
  if (!s || !process.env.STRIPE_WEBHOOK_SECRET) return res.sendStatus(200);
  let event;
  try { event = s.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (e) { logger.error(`Stripe webhook sig failed: ${e.message}`); return res.sendStatus(400); }

  if (event.type === 'checkout.session.completed') {
    const { userId, plan } = event.data.object.metadata;
    if (userId && plan) {
      const customerId = event.data.object.customer;
      await User.findByIdAndUpdate(userId, {
        plan,
        dailyApplyLimit: PLAN_LIMITS[plan]?.dailyApply || PLAN_LIMITS[PLAN.FREE].dailyApply,
        stripeCustomerId: customerId,
      });
      logger.info(`Plan upgraded: ${userId} → ${plan}`);
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    const customerId = event.data.object.customer;
    await User.findOneAndUpdate(
      { stripeCustomerId: customerId },
      { plan: PLAN.FREE, dailyApplyLimit: PLAN_LIMITS[PLAN.FREE].dailyApply }
    );
    logger.info(`Subscription cancelled: ${customerId}`);
  }
  res.sendStatus(200);
});

// GET /api/subscription/portal
router.get('/portal', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+stripeCustomerId');
    if (!user?.stripeCustomerId) return sendError(res, HTTP.BAD_REQUEST, 'No active subscription found');
    const s = getStripe();
    const session = await s.billingPortal.sessions.create({
      customer:   user.stripeCustomerId,
      return_url: `${process.env.APP_URL}/plans`,
    });
    return sendSuccess(res, HTTP.OK, 'Portal session', { url: session.url });
  } catch (err) { next(err); }
});

module.exports = router;
