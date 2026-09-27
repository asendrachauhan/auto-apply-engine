const mongoose = require('mongoose');

/**
 * Audit ledger for the referral program. One row per point-affecting event
 * — a credit when a referred user makes their first paid plan purchase, or
 * a debit when the referrer redeems points toward a purchase of their own.
 *
 * Points are only ever credited on a REAL paid conversion (see the
 * 'checkout.session.completed' handler in routes/subscription.routes.js),
 * never on signup alone — this is a deliberate anti-abuse measure agreed
 * in the original feature spec.
 */
const referralRewardSchema = new mongoose.Schema({
  referrerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Positive for a credit, negative for a redemption/debit.
  points: { type: Number, required: true },

  reason: {
    type: String,
    required: true,
    enum: ['first_paid_plan', 'redeemed_at_checkout', 'manual_adjustment'],
  },

  // Context for 'first_paid_plan' credits.
  plan: { type: String, default: null },

  status: { type: String, default: 'credited', enum: ['credited', 'redeemed'] },

  notes: { type: String, default: '' },
}, { timestamps: true });

referralRewardSchema.index({ referrerId: 1, createdAt: -1 });

module.exports = mongoose.model('ReferralReward', referralRewardSchema);
