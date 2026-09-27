'use strict';
const AuditLog = require('../../models/AuditLog');
const logger   = require('../../utils/logger');

/**
 * Record a security-relevant audit event. Never throws — a failure to
 * write an audit entry must never break the actual login/password-change/
 * admin-action it's recording (same "notify, don't block" principle as
 * notification.service.js).
 *
 * @param {object} params
 * @param {string} params.action    - one of AuditLog's enum values
 * @param {string} [params.userId]  - account the event happened to
 * @param {string} [params.actorId] - account that performed it (defaults to userId)
 * @param {import('express').Request} [params.req] - used to extract ip/userAgent
 * @param {object} [params.metadata] - action-specific context (never secrets)
 */
const record = async ({ action, userId, actorId, req, metadata = {} }) => {
  try {
    await AuditLog.create({
      action,
      userId:    userId || undefined,
      actorId:   actorId || userId || undefined,
      ip:        req?.ip,
      userAgent: req?.headers?.['user-agent'],
      metadata,
    });
  } catch (err) {
    // Log-and-continue — an audit write failure is itself worth knowing
    // about via the normal application log, but must never surface as a
    // failure of the real action (login, password change, etc.) it rode
    // alongside.
    logger.warn(`Audit log write failed for action "${action}": ${err.message}`);
  }
};

/**
 * Fetch a user's own audit history, newest first — used by both the
 * account-security view and the admin per-user detail page.
 */
const getHistory = async (userId, { limit = 50 } = {}) => {
  return AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
};

module.exports = { record, getHistory };
