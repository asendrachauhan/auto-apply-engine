'use strict';
const User              = require('../../models/User');
const Resume            = require('../../models/Resume');
const AutomationSession = require('../../models/AutomationSession');
const JobApplication    = require('../../models/JobApplication');
const JobAlert          = require('../../models/JobAlert');
const { aggregateJobs } = require('../jobs/jobAggregator.service');
const { matchJobs }     = require('../ai/jobMatcher.service');
const { generateCoverLetter } = require('../ai/coverLetter.service');
const { tailorResume }  = require('../ai/resumeTailor.service');
const { generatePrefill } = require('../ai/formPrefill.service');
const { generateResumePDF } = require('../resume/pdfGenerator.service');
const { sendApplicationEmail } = require('../notifications/email.service');
const { notifyApplication } = require('../notifications/whatsapp.service');
const { notify: notifyInApp } = require('../notifications/notification.service');
const { AUTO_SESSION_STATUS, JOB_STATUS, PLAN_LIMITS } = require('../../utils/constants');
const { getEffectivePlanId } = require('../../config/featureFlags.service');
const { getAllSkills }  = require('../../utils/resumeSkills');
const logger = require('../../utils/logger');

const computeRelevance = (job, targetRoles, skills) => {
  let score = 0;
  const title = (job.title || '').toLowerCase();
  const desc  = (job.description || '').toLowerCase();

  for (const role of targetRoles) {
    if (title.includes(role)) score += 50;
    const words = role.split(/\s+/).filter(w => w.length > 2);
    for (const w of words) {
      if (title.includes(w)) score += 15;
    }
  }

  for (const s of skills) {
    if (s.length > 1 && (title.includes(s) || desc.includes(s))) {
      score += 4;
    }
  }

  // Top platform priority bonus: Naukri, LinkedIn, Indeed
  const src = (job.source || '').toLowerCase();
  const ptf = (job.sourcePlatform || '').toLowerCase();
  if (['naukri', 'linkedin', 'indeed'].includes(src) || ['naukri', 'linkedin', 'indeed'].includes(ptf)) {
    score += 250;
  }

  return score;
};

const prioritizeJobs = (jobs, resumeData, preferences) => {
  const targetRoles = [
    ...(preferences?.jobTitles || []),
    ...(resumeData?.targetRoles || []),
    ...(resumeData?.experience || []).map(e => e.title),
  ].filter(Boolean).map(t => t.toLowerCase());

  const skills = getAllSkills(resumeData?.skills || {}).map(s => s.toLowerCase());

  return [...jobs].sort((a, b) => {
    const scoreA = computeRelevance(a, targetRoles, skills);
    const scoreB = computeRelevance(b, targetRoles, skills);
    return scoreB - scoreA;
  });
};

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
    // Session 39 fix (found during a systematic backend sweep): this used
    // to read `user.dailyApplyLimit` directly — the raw stored field, only
    // ever updated by the Stripe webhook on a REAL plan change (see
    // subscription.routes.js). That means if the admin panel's Payments
    // toggle is switched off (Session 37 — "the whole product becomes
    // free"), THIS cap — the one that actually controls how many real
    // applications get sent, arguably the single most consequential limit
    // in the product — never unlocked, even though jobAlertEngine.service
    // .js's alert cap and jobDiscovery.service.js's source list correctly
    // did. Same fix pattern as those two: use the effective plan's limit,
    // falling back to the user's own stored preference only if it's lower
    // (a user who deliberately set a smaller personal cap than their plan
    // allows should still have that respected — this only raises the
    // ceiling, never overrides a user's own more conservative choice).
    const today    = new Date(); today.setHours(0,0,0,0);
    const todayApps = await JobApplication.countDocuments({ userId, appliedAt: { $gte: today } });
    const effectivePlan = await getEffectivePlanId(user.plan);
    // Only override the user's own stored preference when the payments-
    // disabled mechanism actually changed their effective plan — normal
    // operation (effectivePlan === user.plan) leaves `dailyApplyLimit`
    // untouched, since a user may have deliberately set it lower than
    // their plan's max, and that choice should be respected, not
    // silently raised.
    const dailyCap = effectivePlan !== user.plan
      ? (PLAN_LIMITS[effectivePlan]?.dailyApply ?? user.dailyApplyLimit)
      : user.dailyApplyLimit;
    const remaining = dailyCap - todayApps;
    if (remaining <= 0) {
      logger.info(`Daily limit reached for ${user.email}`);
      await session.updateOne({ status: AUTO_SESSION_STATUS.COMPLETED, completedAt: new Date(), stats });
      return;
    }

    // 3. AI match
    const prioritizedJobs = prioritizeJobs(jobs, resume.parsedData, user.preferences);
    const jobsToMatch = prioritizedJobs.slice(0, Math.min(15, remaining * 2));
    const matched = await matchJobs(jobsToMatch, resume.parsedData, user.preferences);
    stats.jobsMatched = matched.length;

    // 4. Apply + notify
    // Sort matched by match score descending to pick the best job for each company
    const sortedMatched = [...matched].sort((a, b) => (b.score.matchScore || 0) - (a.score.matchScore || 0));

    // Dedup check: query recent applications within last 14 days to prevent duplicate spam
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentApps = await JobApplication.find(
      { userId, appliedAt: { $gte: fourteenDaysAgo } },
      { company: 1, jobTitle: 1 }
    ).lean();

    const recentlyAppliedCompanies = new Set(recentApps.map(a => (a.company || '').toLowerCase().trim()));
    const alreadyAppliedKey = new Set(recentApps.map(a => `${(a.company || '').toLowerCase().trim()}::${(a.jobTitle || '').toLowerCase().trim()}`));
    const companiesAppliedInThisRun = new Set();

    const toApply = [];
    for (const item of sortedMatched) {
      const compKey = (item.job.company || '').toLowerCase().trim();
      const jobKey  = `${compKey}::${(item.job.title || '').toLowerCase().trim()}`;
      if (alreadyAppliedKey.has(jobKey)) continue;
      if (companiesAppliedInThisRun.has(compKey)) continue;
      if (recentlyAppliedCompanies.has(compKey)) continue;

      // SAFETY GATE 1: Legitimacy & Ghost Job check
      // Never auto-apply to listings that are 'uncertain' or 'likely_ghost' (< 70)
      const realJobScore = item.job.ghostScore?.realJobScore ?? (typeof item.job.ghostScore === 'number' ? item.job.ghostScore : 100);
      const verdict = item.job.ghostScore?.verdict;
      if (realJobScore < 70 || verdict === 'uncertain' || verdict === 'ghost' || verdict === 'likely_ghost') {
        logger.info(`Skipping auto-apply for "${item.job.title} @ ${item.job.company}": unverified legitimacy (score: ${realJobScore}, verdict: ${verdict || 'uncertain'})`);
        continue;
      }

      // SAFETY GATE 2: Seniority mismatch check
      // If role demands Senior/Lead/5+ years and candidate is Junior/entry, skip
      const titleLower = (item.job.title || '').toLowerCase();
      const descLower = (item.job.description || '').toLowerCase();
      const isSeniorJob = /\b(senior|sr\.?|lead|principal|staff|architect|head of|director)\b/i.test(titleLower)
        || /(\b5\+|\b6\+|\b7\+|\b8\+|\b10\+)\s*(?:years?|yrs?)/i.test(descLower);
      const isJuniorCandidate = (resume.parsedData.targetRoles || []).concat(
        (resume.parsedData.experience || []).map(e => e.title)
      ).some(t => /\b(junior|jr\.?|intern|trainee|associate)\b/i.test(t || '')) &&
        (resume.parsedData.experience || []).length <= 2;

      if (isSeniorJob && isJuniorCandidate) {
        logger.info(`Skipping auto-apply for "${item.job.title} @ ${item.job.company}": Seniority mismatch (Senior role vs Junior profile)`);
        continue;
      }

      // SAFETY GATE 3: Minimum match score check
      if ((item.score?.matchScore || 0) < 65) {
        logger.info(`Skipping auto-apply for "${item.job.title} @ ${item.job.company}": match score ${item.score?.matchScore} below threshold 65`);
        continue;
      }

      companiesAppliedInThisRun.add(compKey);
      toApply.push(item);
      if (toApply.length >= remaining) break;
    }

    for (const { job, score } of toApply) {
      try {
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
        alreadyAppliedKey.add(`${job.company}::${job.title}`);

        // Generate Tailored Resume, PDF, and Prefill Packet for user archive in JobAlert
        try {
          const tailored = await tailorResume(resume.parsedData, job).catch(() => resume.parsedData);
          let pdfUrl = '';
          try {
            const pdfRes = await generateResumePDF(tailored, job, userId);
            pdfUrl = pdfRes?.pdfUrl || '';
          } catch {}

          const prefill = await generatePrefill(tailored, job, score).catch(() => null);

          await JobAlert.findOneAndUpdate(
            { userId, jobUrl: job.url },
            {
              $setOnInsert: {
                userId,
                title:          job.title,
                company:        job.company,
                location:       job.location || 'Remote',
                jobUrl:         job.url,
                source:         job.source,
                sourcePlatform: job.sourcePlatform ?? null,
                description:    job.description,
                salary:         job.salary,
                postedAt:       job.postedAt || new Date(),
                ghostScore:     job.ghostScore?.realJobScore ?? job.ghostScore ?? null,
                ghostVerdict:   job.ghostScore?.verdict ?? null,
                matchScore:     score.matchScore,
                matchReasons:   score.matchReasons,
                missingSkills:  score.missingSkills,
                keywordsToHighlight: tailored.keywordsAdded || [],
                tailoredResume: {
                  summary:    tailored.summary,
                  skills:     tailored.skills,
                  experience: tailored.experience,
                  fullText:   tailored.fullText || '',
                },
                tailoredResumePdfUrl: pdfUrl,
                coverLetter:   prefill?.coverLetter || coverLetter,
                prefillFields: prefill?.fields || [],
                prefillCard:   prefill?.applicationCard || '',
                status:        'applied',
                appliedAt:     new Date(),
              }
            },
            { upsert: true, new: true }
          );
        } catch (alertSyncErr) {
          logger.warn(`JobAlert sync skipped for "${job.title}": ${alertSyncErr.message}`);
        }

        // Send email notification
        // Bug fix (Session 41, found during the systematic sweep): the
        // .catch() below correctly stops a failed email from crashing the
        // whole automation run, but the code used to increment
        // `stats.notificationsSent` and set `notificationSent: true`
        // unconditionally right after — regardless of whether the send
        // actually succeeded. A failed email was being counted and
        // recorded as sent. Now branches on the actual outcome.
        if (user.notificationSettings?.emailEnabled && user.notificationSettings?.emailAddress) {
          const emailResult = await sendApplicationEmail(
            user.notificationSettings.emailAddress,
            user.name,
            {
              jobTitle: job.title,
              company: job.company,
              matchScore: score.matchScore,
              jobUrl: job.url,
              source: job.source,
              applicationsUrl: `${process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:4200'}/jobs`,
            }
          ).catch(e => { logger.warn(`Notify email failed: ${e.message}`); return null; });
          if (emailResult) {
            stats.notificationsSent++;
            await application.updateOne({ notificationSent: true });
          }
        }

        // Send WhatsApp notification
        if (user.notificationSettings?.whatsappEnabled && user.notificationSettings?.whatsappNumber) {
          await notifyApplication(user.notificationSettings.whatsappNumber, {
            jobTitle: job.title, company: job.company, matchScore: score.matchScore,
            source: job.source, appliedAt: application.appliedAt,
          }).catch(e => logger.warn(`Notify WhatsApp failed: ${e.message}`));
        }

        notifyInApp({
          userId, type: 'application',
          title:   `Applied: ${job.title}`,
          message: `AutoApply AI submitted your application to ${job.company} (${score.matchScore}% match).`,
          channels: ['in-app', ...(user.notificationSettings?.emailEnabled ? ['email'] : []), ...(user.notificationSettings?.whatsappEnabled ? ['whatsapp'] : [])],
          link: '/jobs',
          metadata: { applicationId: application._id.toString(), matchScore: score.matchScore },
        }).catch(() => {});

        logger.info(`Applied: ${job.title} @ ${job.company} (${score.matchScore}%) — ${user.email}`);
      } catch (e) {
        errors.push(`${job.title} @ ${job.company}: ${e.message}`);
        logger.error(`Application failed: ${e.message}`);
      }
    }

    await User.findByIdAndUpdate(userId, { $inc: { totalApplications: stats.applicationsSent }, lastAutomationRun: new Date() });
    await session.updateOne({ status: AUTO_SESSION_STATUS.COMPLETED, completedAt: new Date(), stats, errorLog: errors });
    logger.info(`Automation complete for ${user.email}: ${stats.applicationsSent} applications sent`);

  } catch (err) {
    logger.error(`Automation engine error: ${err.message}`);
    await session.updateOne({ status: AUTO_SESSION_STATUS.FAILED, completedAt: new Date(), stats, errorLog: [err.message] });
  }
};

module.exports = { runForUser };
