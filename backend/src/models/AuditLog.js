const mongoose = require('mongoose');

/**
 * Audit log — an immutable record of security-relevant events: login
 * attempts (success and failure), password/account changes, and admin
 * actions taken on other users' accounts.
 *
 * This is intentionally separate from Winston's application logs
 * (utils/logger.js), which are operational/debugging output and roll off
 * with log retention. Audit entries are a compliance/security record that
 * should persist and be queryable independently of server log retention —
 * e.g. "show me every failed login for this account in the last 30 days"
 * or "what did admin X change on user Y's account and when."
 *
 * Write path: services/audit/auditLog.service.js — call `record()` from
 * there rather than creating documents directly, so every entry has a
 * consistent shape.
 */
const auditLogSchema = new mongoose.Schema({
  // The account the event happened TO (whose data/session was affected).
  // Not required — a failed login with an unrecognized email has no user
  // to attach to, but is still worth recording for brute-force visibility.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // The account that PERFORMED the action, when different from userId —
  // e.g. an admin editing another user's plan. Equal to userId for
  // self-service actions like a normal login or password change.
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  action: {
    type: String,
    required: true,
    enum: [
      'login_success', 'login_failed', 'account_locked',
      'password_changed', 'password_reset_requested', 'password_reset_completed',
      'email_verified', 'account_deletion_requested', 'logout', 'logout_all',
      'admin_user_updated', 'admin_user_viewed',
      // Session 39 — closes a gap explicitly flagged (not forgotten) in
      // Session 37: the payments/referrals toggles and coupon system are
      // real money/access-control-relevant admin actions and belong in
      // the compliance trail alongside admin_user_updated, not just a
      // logger.info line.
      'admin_payments_toggled', 'admin_referrals_toggled',
      'admin_coupon_created', 'admin_coupon_deactivated',
    ],
    index: true,
  },

  ip:        { type: String },
  userAgent: { type: String },

  // Free-form, action-specific context — e.g. { changedFields: ['plan'] }
  // for admin_user_updated. Never store passwords, tokens, or full request
  // bodies here.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound index for the primary query pattern: "this user's history,
// newest first" (used by both the user-facing account-security view and
// admin's per-user audit trail).
auditLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
