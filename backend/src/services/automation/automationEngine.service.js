'use strict';
const User              = require('../../models/User');
const Resume            = require('../../models/Resume');
const AutomationSession = require('../../models/AutomationSession');
const JobApplication    = require('../../models/JobApplication');
const { aggregateJobs } = require('../jobs/jobAggregator.service');
const { matchJobs }     = require('../ai/jobMatcher.service');
const { generateCoverLetter } = require('../ai/coverLetter.service');
const { sendApplicationEmail } = require('../notifications/email.service');
const { notifyApplication } = require('../notifications/whatsapp.service');
const { AUTO_SESSION_STATUS, JOB_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Core automation run for a single user.
 * Called by scheduler and manual run endpoint.
 */
const runForUser = async (userId, sessionId) => {
  const session = await AutomationSession.findById(sessionId);
  const user    = await User.findById(userId);
  const resume  = await Resume.findOne({ userId });

  if (!user?.automationActive || !resume?.parsedData) {
    await session.updateOne({ status: AUTO_SESSION_STATUS.CANCELLED, completedAt: new Date() });
    return;
  }

  logger.info(`Automation run started: ${user.email}`);
  const stats = { jobsFound: 0, ghostFiltered: 0, jobsMatched: 0, applicationsAttempted: 0, applicationsSent: 0, notificationsSent: 0 };
  const errors = [];

  try {
    // 1. Discover jobs
    const { jobs, stats: aggStats } = await aggregateJobs(user.preferences, { euMode: user.preferences?.euMode, plan: user.plan });
    stats.jobsFound     = aggStats.raw;
    stats.ghostFiltered = aggStats.ghostFiltered;

    // 2. Check daily limit
    const today    = new Date(); today.setHours(0,0,0,0);
    const todayApps = await JobApplication.countDocuments({ userId, appliedAt: { $gte: today } });
    const remaining = user.dailyApplyLimit - todayApps;
    if (remaining <= 0) {
      logger.info(`Daily limit reached for ${user.email}`);
      await session.updateOne({ status: AUTO_SESSION_STATUS.COMPLETED, completedAt: new Date(), stats });
      return;
    }

    // 3. AI match
    const matched = await matchJobs(jobs.slice(0, 30), resume.parsedData, user.preferences);
    stats.jobsMatched = matched.length;

    // 4. Apply + notify
    const toApply = matched.slice(0, remaining);
    for (const { job, score } of toApply) {
      try {
        // Skip if already applied
        const exists = await JobApplication.findOne({ userId, company: job.company, jobTitle: job.title });
        if (exists) continue;

        const coverLetter = await generateCoverLetter(resume.parsedData, job, score).catch(() => '');

        const application = await JobApplication.create({
          userId, jobListingId: job._id, status: JOB_STATUS.APPLIED,
          jobTitle: job.title, company: job.company, jobUrl: job.url,
          matchScore: score.matchScore,
          matchDimensions: { matchReasons: score.matchReasons, missingSkills: score.missingSkills, applicationStrategy: score.applicationStrategy },
          coverLetter, source: job.source, resumeVersion: resume.version,
          ghostScore: job.ghostScore?.realJobScore,
        });

        stats.applicationsAttempted++;
        stats.applicationsSent++;

        // Send email notification
        if (user.notificationSettings?.emailEnabled && user.notificationSettings?.emailAddress) {
          await sendApplicationEmail(
            user.notificationSettings.emailAddress,
            user.name,
            { jobTitle: job.title, company: job.company, matchScore: score.matchScore, jobUrl: job.url, source: job.source }
          ).catch(e => logger.warn(`Notify email failed: ${e.message}`));
          stats.notificationsSent++;
          await application.updateOne({ notificationSent: true });
        }

        // Send WhatsApp notification
        if (user.notificationSettings?.whatsappEnabled && user.notificationSettings?.whatsappNumber) {
          await notifyApplication(user.notificationSettings.whatsappNumber, {
            jobTitle: job.title, company: job.company, matchScore: score.matchScore,
            source: job.source, appliedAt: application.appliedAt,
          }).catch(e => logger.warn(`Notify WhatsApp failed: ${e.message}`));
        }

        logger.info(`Applied: ${job.title} @ ${job.company} (${score.matchScore}%) — ${user.email}`);
      } catch (e) {
        errors.push(`${job.title} @ ${job.company}: ${e.message}`);
        logger.error(`Application failed: ${e.message}`);
      }
    }

    await User.findByIdAndUpdate(userId, { $inc: { totalApplications: stats.applicationsSent }, lastAutomationRun: new Date() });
    await session.updateOne({ status: AUTO_SESSION_STATUS.COMPLETED, completedAt: new Date(), stats, errors });
    logger.info(`Automation complete for ${user.email}: ${stats.applicationsSent} applications sent`);

  } catch (err) {
    logger.error(`Automation engine error: ${err.message}`);
    await session.updateOne({ status: AUTO_SESSION_STATUS.FAILED, completedAt: new Date(), stats, errors: [err.message] });
  }
};

module.exports = { runForUser };
