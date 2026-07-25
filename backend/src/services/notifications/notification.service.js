/**
 * Notification service — single entry point for writing to the in-app
 * Notifications Center.
 *
 * This is deliberately separate from email.service.js / whatsapp.service.js:
 * those send the actual message, this records that it happened so the user
 * has a history inside the app (bell + /notifications) even if they never
 * open their inbox. Call this ALONGSIDE the email/WhatsApp send, not instead
 * of it — and never let a notification-record failure break the calling
 * flow, since the real send already succeeded or failed on its own.
 */
'use strict';
const Notification = require('../../models/Notification');
const logger        = require('../../utils/logger');

/**
 * @param {Object} params
 * @param {string} params.userId
 * @param {'job_alert'|'application'|'automation'|'billing'|'referral'|'system'} params.type
 * @param {string} params.title
 * @param {string} params.message
 * @param {string[]} [params.channels]
 * @param {string} [params.link]
 * @param {Object} [params.metadata]
 */
const notify = async ({ userId, type, title, message, channels = ['in-app'], link = '', metadata = {} }) => {
  try {
    if (!userId || !type || !title || !message) {
      logger.warn('[Notification] Skipped — missing required field(s)');
      return null;
    }
    return await Notification.create({ userId, type, title, message, channels, link, metadata });
  } catch (err) {
    // Never let this bubble up and fail the caller's actual send.
    logger.error(`[Notification] Failed to record: ${err.message}`);
    return null;
  }
};

module.exports = { notify };
