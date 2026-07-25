/**
 * Referral Controller.
 * Points are credited by routes/subscription.routes.js's Stripe webhook
 * handler (on the referred user's first paid plan purchase only — see
 * models/ReferralReward.js for the anti-abuse rationale), and spent via
 * POST /api/subscription/create-checkout's `redeemPoints` param. This
 * controller is read-only: the code/link, running totals, and history.
 */
'use strict';
const User            = require('../models/User');
const ReferralReward  = require('../models/ReferralReward');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');
const { HTTP } = require('../utils/constants');

const pointValue = () => Number(process.env.REFERRAL_POINT_VALUE || 1); // currency units per point

/** GET /api/referral/me — code, shareable link, and running totals */
const getMyReferral = async (req, res, next) => {
  try {
    const [referredCount, lifetimeEarned] = await Promise.all([
      User.countDocuments({ referredBy: req.user._id }),
      ReferralReward.aggregate([
        { $match: { referrerId: req.user._id, points: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
    ]);

    const appUrl = process.env.APP_URL || 'http://localhost:4200';
    return sendSuccess(res, HTTP.OK, 'Referral summary', {
      code: req.user.referralCode,
      link: `${appUrl}/auth/register?ref=${req.user.referralCode}`,
      pointsAvailable: req.user.referralPoints,
      pointsLifetimeEarned: lifetimeEarned[0]?.total || 0,
      referredCount,
      pointValue: pointValue(),
      currency: process.env.PLAN_CURRENCY || 'INR',
    });
  } catch (err) { next(err); }
};

/** GET /api/referral/history — paginated reward ledger */
const getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = { referrerId: req.user._id };
    const [history, total] = await Promise.all([
      ReferralReward.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('referredUserId', 'name email')
        .lean(),
      ReferralReward.countDocuments(filter),
    ]);
    return sendPaginated(res, history, page, limit, total);
  } catch (err) { next(err); }
};

module.exports = { getMyReferral, getHistory };
