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

const { generateReferralCode } = require('../utils/referral');

const pointValue = () => Number(process.env.REFERRAL_POINT_VALUE || 1); // currency units per point

/** GET /api/referral/me — code, shareable link, and running totals */
const getMyReferral = async (req, res, next) => {
  try {
    let referralCode = req.user.referralCode;
    if (!referralCode) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateReferralCode(req.user.name);
        const exists = await User.exists({ referralCode: candidate });
        if (!exists) {
          referralCode = candidate;
          req.user.referralCode = candidate;
          await User.updateOne({ _id: req.user._id }, { $set: { referralCode: candidate } }).catch(() => {});
          break;
        }
      }
    }

    const [referredCount, lifetimeEarned] = await Promise.all([
      User.countDocuments({ referredBy: req.user._id }),
      ReferralReward.aggregate([
        { $match: { referrerId: req.user._id, points: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
    ]);

    const appUrl = (process.env.APP_URL || 'http://localhost:4200').replace(/\/+$/, '');
    return sendSuccess(res, HTTP.OK, 'Referral summary', {
      code: referralCode,
      link: `${appUrl}/auth/register?ref=${referralCode || ''}`,
      pointsAvailable: req.user.referralPoints || 0,
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
