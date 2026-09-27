const mongoose = require('mongoose');

/**
 * Tracks Stripe webhook event IDs that have already been processed.
 * Stripe explicitly documents that the same event can be delivered more
 * than once (e.g. if the server times out before Stripe receives the 200
 * OK, even though processing actually succeeded) and recommends
 * deduplicating on `event.id` before acting on it.
 *
 * Without this, a redelivered `checkout.session.completed` would
 * double-debit a user's redeemed referral points (see
 * routes/subscription.routes.js's webhook handler) and create a duplicate
 * ReferralReward ledger entry — the referrer-credit side of that same
 * handler already guards itself via its own ledger check, but the
 * redemption-debit side did not.
 */
const processedWebhookEventSchema = new mongoose.Schema({
  stripeEventId: { type: String, required: true, unique: true },
  eventType:     { type: String, required: true },
  processedAt:   { type: Date, default: Date.now },
});

// TTL index — auto-expire records after 30 days. Stripe doesn't redeliver
// events indefinitely, so there's no need to keep this collection growing
// forever; the actual business-effect records (User, ReferralReward) are
// what persist long-term.
processedWebhookEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('ProcessedWebhookEvent', processedWebhookEventSchema);
