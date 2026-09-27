'use strict';
const User               = require('../../models/User');
const Resume              = require('../../models/Resume');
const JobApplication      = require('../../models/JobApplication');
const JobAlert            = require('../../models/JobAlert');
const JobWatch             = require('../../models/JobWatch');
const Notification        = require('../../models/Notification');
const AutomationSession    = require('../../models/AutomationSession');
const ReferralReward      = require('../../models/ReferralReward');
const AuditLog             = require('../../models/AuditLog');
const cloudinary           = require('../../config/cloudinary');
const logger              = require('../../utils/logger');
const { GDPR }            = require('../../utils/constants');

/**
 * GDPR right-to-erasure purge. `deletionRequestedAt` (set when a user
 * confirms account deletion — see auth.controller.js's deleteAccount) only
 * ever blocked further access via the `protect` middleware; nothing
 * actually erased the underlying data. This closes that gap.
 *
 * Runs on a grace-period delay (GDPR.DELETION_WINDOW_DAYS, currently 30
 * days — that constant already existed but was never wired to anything)
 * rather than purging immediately, so a user who requested deletion by
 * mistake has a real, if narrow, recovery window before data is gone for
 * good. Access is already blocked from the moment of the request, so the
 * grace period only delays erasure, not the access lock.
 */
const purgeExpiredAccounts = async () => {
  const cutoff = new Date(Date.now() - GDPR.DELETION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const dueUsers = await User.find({ deletionRequestedAt: { $lte: cutoff } }).select('_id email').lean();

  if (dueUsers.length === 0) {
    logger.info('[DataPurge] No accounts past the deletion grace period');
    return { purged: 0, failed: 0 };
  }

  logger.info(`[DataPurge] ${dueUsers.length} account(s) past the ${GDPR.DELETION_WINDOW_DAYS}-day grace period — purging`);

  let purged = 0, failed = 0;
  for (const user of dueUsers) {
    try {
      await purgeOneAccount(user._id);
      purged++;
      logger.info(`[DataPurge] Purged account ${user._id} (${user.email})`);
    } catch (err) {
      failed++;
      // One account failing to purge must not stop the rest — same
      // isolation principle used in scheduler.service.js and
      // jobAlertEngine.service.js's per-user loops.
      logger.error(`[DataPurge] Failed to purge account ${user._id}: ${err.message}`);
    }
  }
  return { purged, failed };
};

/**
 * Cascades deletion across every collection that references this user,
 * plus the Cloudinary-hosted résumé file, then removes the User document
 * itself last (so a failure partway through still leaves the account
 * correctly locked by the existing deletionRequestedAt/protect-middleware
 * check, rather than in a half-erased-but-still-accessible state).
 */
const purgeOneAccount = async (userId) => {
  const resume = await Resume.findOne({ userId }).select('cloudinaryId').lean();
  if (resume?.cloudinaryId) {
    const client = cloudinary.getClient();
    if (client) {
      try {
        await client.uploader.destroy(resume.cloudinaryId, { resource_type: 'raw' });
      } catch (err) {
        // Don't let a Cloudinary hiccup block erasing the actual personal
        // data records — log it and continue; an orphaned file with no
        // account attached to it is a follow-up cleanup, not a compliance
        // blocker on its own.
        logger.warn(`[DataPurge] Cloudinary cleanup failed for user ${userId}: ${err.message}`);
      }
    }
  }

  await Promise.all([
    Resume.deleteMany({ userId }),
    JobApplication.deleteMany({ userId }),
    JobAlert.deleteMany({ userId }),
    JobWatch.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    AutomationSession.deleteMany({ userId }),
    ReferralReward.deleteMany({ $or: [{ referrerId: userId }, { referredUserId: userId }] }),
    // AuditLog is deliberately NOT deleted — security/audit trails
    // (login history, account changes) are a recognized, standard
    // exception to erasure requests under GDPR Art. 17(3) where retention
    // is necessary for legal/security purposes. Anonymize the userId AND
    // actorId references instead of deleting the records outright.
    //
    // Bug fix (Session 41, found during the systematic sweep): this used
    // to be a single `updateMany({ userId }, { $set: { userId: null } })`
    // — it never touched `actorId` at all, despite this exact comment
    // already claiming it anonymized "the actor reference." Per the
    // schema's own comment, `actorId` equals `userId` for every self-
    // service action (logins, logouts, password changes — the vast
    // majority of a typical user's own audit trail), so the real user ID
    // was silently surviving erasure in that field on nearly every one of
    // their own records. It also meant a purged admin's actions taken on
    // OTHER users' accounts (userId = the other user, actorId = the
    // purged admin) were never matched by the query at all — those
    // records wouldn't even be found, let alone anonymized. Two separate
    // updateMany calls, since a single query can't conditionally null
    // only the field(s) that actually matched this specific user's ID.
    AuditLog.updateMany({ userId }, { $set: { userId: null } }),
    AuditLog.updateMany({ actorId: userId }, { $set: { actorId: null } }),
  ]);

  await User.findByIdAndDelete(userId);
};

module.exports = { purgeExpiredAccounts, purgeOneAccount };
