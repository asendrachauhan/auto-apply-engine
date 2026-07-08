/**
 * Job Alert Engine — the main pipeline for the "find + prepare + notify" flow.
 *
 * For each user:
 * 1. Discover new jobs from all legal sources
 * 2. AI match + score against user profile
 * 3. For matched jobs (score ≥ 65):
 *    a. Tailor resume to JD
 *    b. Generate PDF of tailored resume
 *    c. Generate pre-filled form data
 *    d. Save JobAlert record
 *    e. Send WhatsApp + Email with full packet
 */

const User          = require('../../models/User');
const Resume        = require('../../models/Resume');
const JobAlert      = require('../../models/JobAlert');
const { discoverJobs }     = require('../jobs/jobDiscovery.service');
const { scoreJob }         = require('../ai/jobMatcher.service');
const { tailorResume }     = require('../ai/resumeTailor.service');
const { generatePrefill }  = require('../ai/formPrefill.service');
const { generateResumePDF }= require('../resume/pdfGenerator.service');
const { sendJobAlert }     = require('../notifications/jobAlert.service');
const logger = require('../../utils/logger');

const MATCH_THRESHOLD   = 65;
const MAX_ALERTS_PER_RUN= 10;
const INTER_JOB_DELAY   = 3000; // ms between processing jobs (respect Groq rate limits)

const delay = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Run the full job alert pipeline for one user.
 * @param {string} userId
 * @returns {Promise<object>} stats
 */
const runJobAlertPipeline = async (userId) => {
  const stats = { discovered: 0, matched: 0, tailored: 0, notified: 0, errors: 0 };
  const startTime = Date.now();

  try {
    // ── Load user, resume ─────────────────────────────────────────────────────
    const [user, resume] = await Promise.all([
      User.findById(userId),
      Resume.findOne({ userId }),
    ]);

    if (!user || !resume) {
      logger.warn(`[AlertEngine] User ${userId}: missing profile — skipping`);
      return stats;
    }

    const resumeData = resume.optimizedData || resume.parsedData;
    if (!resumeData) {
      logger.warn(`[AlertEngine] User ${userId}: no parsed resume — skipping`);
      return stats;
    }

    const planLimits = user.planLimits; // virtual on User — real source of truth for plan limits
    const maxAlerts  = Math.min(planLimits.dailyApply, MAX_ALERTS_PER_RUN);

    logger.info(`[AlertEngine] User ${userId}: discovering jobs (plan: ${user.plan})`);

    // ── Step 1: Discover new jobs ─────────────────────────────────────────────
    const newJobs = await discoverJobs(user);
    stats.discovered = newJobs.length;

    if (newJobs.length === 0) {
      logger.info(`[AlertEngine] User ${userId}: no new jobs found`);
      return stats;
    }

    logger.info(`[AlertEngine] User ${userId}: ${newJobs.length} new jobs to evaluate`);

    // ── Step 2: Score & process matched jobs ──────────────────────────────────
    let alertsSent = 0;

    for (const job of newJobs) {
      if (alertsSent >= maxAlerts) break;

      try {
        // AI match score
        const matchResult = await scoreJob(job, resumeData);

        if (!matchResult.shouldApply || matchResult.matchScore < MATCH_THRESHOLD) {
          logger.debug(`[AlertEngine] Skip "${job.title}" @ ${job.company}: score ${matchResult.matchScore}%`);
          continue;
        }

        stats.matched++;
        logger.info(`[AlertEngine] Match: "${job.title}" @ ${job.company} — ${matchResult.matchScore}%`);

        // ── Step 3a: Tailor resume ──────────────────────────────────────────
        const tailored = await tailorResume(resumeData, job);
        stats.tailored++;

        // ── Step 3b: Generate PDF ───────────────────────────────────────────
        let pdfUrl = '';
        try {
          const { pdfUrl: url } = await generateResumePDF(tailored, job, userId);
          pdfUrl = url;
        } catch (pdfErr) {
          logger.warn(`[AlertEngine] PDF gen failed: ${pdfErr.message}`);
        }

        // ── Step 3c: Generate prefill packet ────────────────────────────────
        const prefill = await generatePrefill(tailored, job, matchResult);

        // ── Step 3d: Save JobAlert ───────────────────────────────────────────
        const alertDoc = await JobAlert.create({
          userId,
          title:       job.title,
          company:     job.company,
          location:    job.location,
          jobUrl:      job.url,
          source:      job.source,
          description: job.description,
          salary:      job.salary,
          postedAt:    job.postedAt,

          ghostScore:   job.ghostScore ?? null,
          ghostVerdict: job.ghostVerdict ?? null,

          matchScore:          matchResult.matchScore,
          matchReasons:        matchResult.matchReasons,
          missingSkills:       matchResult.missingSkills,
          keywordsToHighlight: tailored.keywordsAdded || [],

          tailoredResume: {
            summary:    tailored.summary,
            skills:     tailored.skills,
            experience: tailored.experience,
            fullText:   tailored.fullText || '',
          },
          tailoredResumePdfUrl: pdfUrl,

          coverLetter:   prefill.coverLetter,
          prefillFields: prefill.fields || [],
          prefillCard:   prefill.applicationCard,

          status: 'pending',
        });

        // ── Step 3e: Send notifications ──────────────────────────────────────
        const notifResult = await sendJobAlert(user, alertDoc, prefill.applicationCard);

        await JobAlert.findByIdAndUpdate(alertDoc._id, {
          status:           'notified',
          notificationSent: true,
          notificationSentAt: new Date(),
          whatsappSent:     notifResult.whatsapp,
          emailSent:        notifResult.email,
        });

        stats.notified++;
        alertsSent++;

        logger.info(`[AlertEngine] Alert sent: "${job.title}" @ ${job.company}`);

        // Rate limit Groq API — wait between jobs
        if (alertsSent < maxAlerts) await delay(INTER_JOB_DELAY);

      } catch (jobErr) {
        stats.errors++;
        logger.error(`[AlertEngine] Error on "${job.title}": ${jobErr.message}`);
        // Continue with next job — don't let one failure block others
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`[AlertEngine] User ${userId}: done in ${duration}s. Stats: ${JSON.stringify(stats)}`);

    return stats;

  } catch (err) {
    logger.error(`[AlertEngine] Fatal error for user ${userId}: ${err.message}`);
    throw err;
  }
};

/**
 * Run job alert pipeline for all active users.
 */
const runForAllUsers = async () => {
  logger.info('[AlertEngine] Starting batch run for all active users');

  const users = await User.find({ automationActive: true }).select('_id').lean();
  logger.info(`[AlertEngine] ${users.length} active users`);

  const allStats = [];
  for (const user of users) {
    try {
      const stats = await runJobAlertPipeline(user._id.toString());
      allStats.push({ userId: user._id, ...stats });
      await delay(15_000); // 15s between users
    } catch (err) {
      logger.error(`[AlertEngine] Failed for user ${user._id}: ${err.message}`);
    }
  }

  return allStats;
};

module.exports = { runJobAlertPipeline, runForAllUsers };
