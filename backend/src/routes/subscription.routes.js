'use strict';
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User           = require('../models/User');
const ReferralReward = require('../models/ReferralReward');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP, PLAN, PLAN_LIMITS } = require('../utils/constants');
const { PLANS_CONFIG } = require('../config/plans.config');
const { notify: notifyInApp } = require('../services/notifications/notification.service');
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

// How many points a successful "first paid plan" referral is worth, and
// what one point is worth in the plan currency when redeemed at checkout.
const REFERRAL_POINTS_PER_CONVERSION = Number(process.env.REFERRAL_POINTS_PER_REFERRAL || 100);
const REFERRAL_POINT_VALUE           = Number(process.env.REFERRAL_POINT_VALUE || 1);

// POST /api/subscription/create-checkout
router.post('/create-checkout', protect, async (req, res, next) => {
  try {
    const { plan, redeemPoints = 0 } = req.body;
    const priceId = PRICE_MAP[plan];
    if (!priceId) return sendError(res, HTTP.BAD_REQUEST, 'Invalid plan');
    const s = getStripe();
    if (!s) return sendError(res, HTTP.SERVER_ERROR, 'Payments not configured');

    // Optional referral-point redemption — validated against the user's
    // real balance, applied as a one-time Stripe coupon on this session
    // only. Points aren't deducted here; the webhook deducts them only
    // after payment actually succeeds, so an abandoned checkout costs
    // the user nothing.
    let discounts;
    const pointsToRedeem = Math.max(0, Math.floor(Number(redeemPoints) || 0));
    if (pointsToRedeem > 0) {
      if (pointsToRedeem > req.user.referralPoints) {
        return sendError(res, HTTP.BAD_REQUEST, `You only have ${req.user.referralPoints} referral points available.`);
      }
      const amountOff = Math.round(pointsToRedeem * REFERRAL_POINT_VALUE * 100); // smallest currency unit
      if (amountOff > 0) {
        const coupon = await s.coupons.create({
          amount_off: amountOff,
          currency:   (process.env.PLAN_CURRENCY || 'INR').toLowerCase(),
          duration:   'once',
          name:       `Referral redemption (${pointsToRedeem} pts)`,
        });
        discounts = [{ coupon: coupon.id }];
      }
    }

    const session = await s.checkout.sessions.create({
      mode:                'subscription',
      payment_method_types:['card'],
      customer_email:      req.user.email,
      line_items:          [{ price: priceId, quantity: 1 }],
      ...(discounts ? { discounts } : {}),
      success_url:         `${process.env.APP_URL}/plans?success=true`,
      cancel_url:          `${process.env.APP_URL}/plans?cancelled=true`,
      metadata:            { userId: req.user._id.toString(), plan, redeemedPoints: String(pointsToRedeem) },
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
    const { userId, plan, redeemedPoints } = event.data.object.metadata || {};
    if (userId && plan) {
      const customerId = event.data.object.customer;
      const user = await User.findByIdAndUpdate(userId, {
        plan,
        dailyApplyLimit: PLAN_LIMITS[plan]?.dailyApply || PLAN_LIMITS[PLAN.FREE].dailyApply,
        stripeCustomerId: customerId,
      }, { new: true });
      logger.info(`Plan upgraded: ${userId} → ${plan}`);

      notifyInApp({
        userId, type: 'billing',
        title: `You're now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`,
        message: `Your payment went through and your account has been upgraded to ${plan}.`,
        channels: ['in-app'], link: '/plans',
      }).catch(() => {});

      // Debit any redeemed referral points now that payment has actually
      // succeeded — never before this point (see create-checkout above).
      const pointsSpent = Math.max(0, parseInt(redeemedPoints, 10) || 0);
      if (pointsSpent > 0 && user) {
        await User.findByIdAndUpdate(userId, { $inc: { referralPoints: -pointsSpent } });
        await ReferralReward.create({
          referrerId: userId, referredUserId: null,
          points: -pointsSpent, reason: 'redeemed_at_checkout', plan, status: 'redeemed',
          notes: `Redeemed at checkout for ${plan} plan`,
        });
      }

      // Credit the referrer, but only the very first time this user ever
      // converts to a paid plan — checked via the ledger itself so it's
      // safe even across repeat upgrades/downgrades/re-upgrades.
      if (user?.referredBy) {
        const alreadyCredited = await ReferralReward.exists({
          referrerId: user.referredBy, referredUserId: user._id, reason: 'first_paid_plan',
        });
        if (!alreadyCredited) {
          await User.findByIdAndUpdate(user.referredBy, { $inc: { referralPoints: REFERRAL_POINTS_PER_CONVERSION } });
          await ReferralReward.create({
            referrerId: user.referredBy, referredUserId: user._id,
            points: REFERRAL_POINTS_PER_CONVERSION, reason: 'first_paid_plan', plan, status: 'credited',
          });
          logger.info(`Referral credited: ${user.referredBy} earned ${REFERRAL_POINTS_PER_CONVERSION} pts for ${user._id}'s ${plan} purchase`);

          notifyInApp({
            userId: user.referredBy.toString(), type: 'referral',
            title: `You earned ${REFERRAL_POINTS_PER_CONVERSION} referral points`,
            message: `${user.name} upgraded to ${plan} using your referral link.`,
            channels: ['in-app'], link: '/referral',
          }).catch(() => {});
        }
      }
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    const customerId = event.data.object.customer;
    const user = await User.findOneAndUpdate(
      { stripeCustomerId: customerId },
      { plan: PLAN.FREE, dailyApplyLimit: PLAN_LIMITS[PLAN.FREE].dailyApply }
    );
    logger.info(`Subscription cancelled: ${customerId}`);
    if (user) {
      notifyInApp({
        userId: user._id.toString(), type: 'billing',
        title: 'Subscription cancelled',
        message: "Your plan has been moved to Free. You can resubscribe any time from the Plans page.",
        channels: ['in-app'], link: '/plans',
      }).catch(() => {});
    }
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
