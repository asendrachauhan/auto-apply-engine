const mongoose = require('mongoose');

/**
 * In-app notification — a record of everything the app has emailed,
 * WhatsApp'd, or otherwise notified the user about, surfaced in the
 * Notifications Center (bell + /notifications page).
 *
 * These are created alongside (not instead of) the actual email/WhatsApp
 * send — see services/notifications/notification.service.js for the single
 * entry point every part of the codebase should call.
 */
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  type: {
    type: String,
    required: true,
    enum: ['job_alert', 'application', 'automation', 'billing', 'referral', 'system'],
  },

  title:   { type: String, required: true, maxlength: 200 },
  message: { type: String, required: true, maxlength: 1000 },

  // Which channel(s) this notification accompanied — purely informational,
  // doesn't affect in-app delivery (that always happens).
  channels: { type: [String], default: ['in-app'], enum: ['in-app', 'email', 'whatsapp'] },

  // Optional deep link into the app, e.g. "/alerts/<id>" or "/jobs".
  link: { type: String, default: '' },

  // Free-form context (jobAlertId, applicationId, plan, etc.) — not
  // rendered directly, just useful for the linked page to reload state.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  read:   { type: Boolean, default: false },
  readAt: { type: Date,    default: null },
}, { timestamps: true });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
