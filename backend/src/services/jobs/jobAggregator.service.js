'use strict';
/**
 * Job aggregator service — the core discovery pipeline behind automated
 * applications. Runs all legal scrapers in parallel, scores every job for
 * "ghost job" legitimacy (our differentiator — see intelligence/ghostJob
 * .service.js), deduplicates, upserts to MongoDB, and returns the jobs the
 * matcher should actually consider.
 *
 * Active sources (8 platforms):
 *  1. Remotive       — no API key, remote-focused
 *  2. Himalayas      — no API key, remote-focused
 *  3. Jobicy         — no API key, remote-focused
 *  4. Adzuna         — API key gated (Pro plan)
 *  5. Arbeitnow      — no API key, EU + visa-sponsorship focused
 *  6. Indeed RSS     — no API key, global (India-first)
 *  7. Naukri RSS     — no API key, India-first
 *  8. Google Jobs    — SerpAPI key required (free tier: 250/month)
 *                      Aggregates LinkedIn, Naukri, Indeed, Glassdoor, etc.
 */

const JobListing = require('../../models/JobListing');
const { scrapeRemotive }   = require('./remotive.scraper');
const { scrapeHimalayas }  = require('./himalayas.scraper');
const { scrapeAdzuna }     = require('./adzuna.scraper');
const { scrapeArbeitnow }  = require('./arbeitnow.scraper');
const { scrapeJobicy }     = require('./jobicy.scraper');
const { scrapeIndeed }     = require('./indeed.rss.scraper');
const { scrapeNaukri }     = require('./naukri.scraper');
const { scrapeGoogleJobs } = require('./serpapi.scraper');
const { scrapeLinkedInApify, scrapeNaukriApify, scrapeIndeedApify } = require('./apify.scraper');
const { filterGhostJobs }  = require('../intelligence/ghostJob.service');
const { isJobEligible }    = require('../../utils/jobEligibility');
const { PLAN_LIMITS, PLAN } = require('../../utils/constants');
const { getEffectivePlanId } = require('../../config/featureFlags.service');
const logger = require('../../utils/logger');

/**
 * Build search queries from user preferences.
 * @param {object} preferences - user.preferences
 * @returns {string[]}
 */
const buildSearchTerms = (preferences) => {
  if (!preferences?.jobTitles?.length) {
    logger.warn('buildSearchTerms: user has no jobTitles set — falling back to a generic search term. This should only happen if onboarding was not completed.');
  }
  const titles = preferences?.jobTitles?.length
    ? preferences.jobTitles
    : ['professional'];

  // Limit to 3 to avoid rate limits
  return titles.slice(0, 3);
};

/**
 * Fetch from all sources available to the user's plan, ghost-filter,
 * deduplicate by (source + externalId), and upsert to DB.
 *
 * @param {object} preferences - user.preferences
 * @param {object} options
 * @param {boolean} options.euMode - prioritise EU/visa-sponsorship sources
 * @param {string}  options.plan - user's plan (gates which sources run)
 * @returns {Promise<{ jobs: object[], stats: { raw: number, ghostFiltered: number, newJobs: number } }>}
 */
const aggregateJobs = async (preferences = {}, options = {}) => {
  const { euMode = false, plan = PLAN.FREE } = options;
  const effectivePlan = await getEffectivePlanId(plan);
  const allowedSources = new Set((PLAN_LIMITS[effectivePlan] || PLAN_LIMITS[PLAN.FREE]).sources);

  const searchTerms = buildSearchTerms(preferences);
  const locations    = preferences?.locations?.slice(0, 2) || [];
  const primaryTerm   = searchTerms[0];
  const primaryLoc    = locations[0] || '';
  const remoteOnly    = Boolean(preferences?.remoteOnly);
  const visaOnly      = Boolean(preferences?.visaSponsorshipRequired);

  logger.info(`Aggregating jobs for terms: ${searchTerms.join(', ')} (plan: ${plan}${euMode ? ', EU mode' : ''})`);

  // ── Source tasks ────────────────────────────────────────────────────────────
  const tasks = [];

  // 1. Remotive — always on, remote-focused
  tasks.push(scrapeRemotive(primaryTerm, 50));

  // 2. Himalayas — always on, remote-focused
  tasks.push(scrapeHimalayas(primaryTerm, 50));

  // 3. Jobicy — always on, remote-focused
  tasks.push(scrapeJobicy(primaryTerm, 30));

  // 4. Adzuna — plan-gated (Pro+)
  if (allowedSources.has('adzuna')) {
    tasks.push(scrapeAdzuna(primaryTerm, primaryLoc));
  } else {
    tasks.push(Promise.resolve([]));
  }

  // 5. Arbeitnow — EU/visa/remote mode
  if (euMode || visaOnly || remoteOnly) {
    tasks.push(scrapeArbeitnow({ search: primaryTerm, visaOnly, remoteOnly }));
  } else {
    tasks.push(Promise.resolve([]));
  }

  // 6. Indeed RSS — always on, India-first
  // Location derived from user preference or defaults to 'India' for Indian candidates
  const indeedLocation = primaryLoc || (remoteOnly ? '' : 'India');
  tasks.push(scrapeIndeed(primaryTerm, indeedLocation, 'in'));

  // 7. Naukri RSS — always on, India-first
  tasks.push(scrapeNaukri(primaryTerm, 50));

  // 8. Google Jobs via SerpAPI — optional, requires SERPAPI_KEY
  // Aggregates LinkedIn, Glassdoor, Naukri, Indeed, and 100+ boards in one call.
  // When SERPAPI_KEY is not set, scrapeGoogleJobs() returns [] gracefully.
  const serpLocation = primaryLoc || (remoteOnly ? 'Remote' : 'India');
  tasks.push(scrapeGoogleJobs(primaryTerm, serpLocation));

  // 9. Apify LinkedIn — plan-gated & requires APIFY_API_TOKEN
  if (allowedSources.has('linkedin') && process.env.APIFY_API_TOKEN) {
    tasks.push(scrapeLinkedInApify(primaryTerm, serpLocation));
  } else {
    tasks.push(Promise.resolve([]));
  }

  // 10. Apify Naukri — plan-gated & requires APIFY_API_TOKEN
  if (allowedSources.has('naukri') && process.env.APIFY_API_TOKEN) {
    tasks.push(scrapeNaukriApify(primaryTerm, serpLocation));
  } else {
    tasks.push(Promise.resolve([]));
  }

  // 11. Apify Indeed — plan-gated & requires APIFY_API_TOKEN
  if (allowedSources.has('indeed') && process.env.APIFY_API_TOKEN) {
    tasks.push(scrapeIndeedApify(primaryTerm, serpLocation));
  } else {
    tasks.push(Promise.resolve([]));
  }

  const results = await Promise.allSettled(tasks);
  const [
    remotiveJobs, himalayasJobs, jobicyJobs,
    adzunaJobs, arbeitnowJobs,
    indeedJobs, naukriJobs, googleJobs,
    apifyLinkedinJobs, apifyNaukriJobs, apifyIndeedJobs,
  ] = results.map(r => (r.status === 'fulfilled' ? r.value : []));

  const rawJobs = [
    // Top Priority: Naukri, LinkedIn, Indeed
    ...naukriJobs,
    ...apifyNaukriJobs,
    ...apifyLinkedinJobs,
    ...indeedJobs,
    ...apifyIndeedJobs,
    // Secondary portals & aggregators
    ...googleJobs,
    ...adzunaJobs,
    ...himalayasJobs,
    ...remotiveJobs,
    ...jobicyJobs,
    ...arbeitnowJobs,
  ].filter(j => j.title && j.url);

  logger.info(`Total raw jobs fetched: ${rawJobs.length} (naukri:${naukriJobs.length + apifyNaukriJobs.length} linkedin:${apifyLinkedinJobs.length} indeed:${indeedJobs.length + apifyIndeedJobs.length} google:${googleJobs.length} adzuna:${adzunaJobs.length} remotive:${remotiveJobs.length})`);

  // Ghost-job filter
  const minGhostScore = Number.isFinite(preferences?.ghostScoreMinimum)
    ? preferences.ghostScoreMinimum
    : (Number(process.env.GHOST_JOB_MIN_SCORE) || 40);
  const scoredJobs = filterGhostJobs(rawJobs, { minScore: minGhostScore });
  const ghostFilteredCount = rawJobs.length - scoredJobs.length;

  // Strict location, remote, and visa sponsorship candidate eligibility filter
  const eligibleJobs = scoredJobs.filter(j => isJobEligible(j, preferences));
  logger.info(`Eligibility filter: ${eligibleJobs.length}/${scoredJobs.length} passed candidate location/visa requirements`);

  // Flatten ghostScore object -> the plain 0-100 number the schema expects
  const jobsForUpsert = eligibleJobs.map(j => ({
    ...j,
    ghostScore:   j.ghostScore.realJobScore,
    ghostVerdict: j.ghostScore.verdict,
  }));

  // Upsert all jobs — updateOne with upsert to avoid duplicates
  let newJobsCount = 0;
  const ops = jobsForUpsert.map((job) => ({
    updateOne: {
      filter: { source: job.source, externalId: job.externalId },
      update: { $setOnInsert: job },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    const result = await JobListing.bulkWrite(ops, { ordered: false });
    newJobsCount = result.upsertedCount;
  }

  logger.info(`Ghost filter: ${scoredJobs.length}/${rawJobs.length} passed. New jobs inserted: ${newJobsCount}`);

  // Re-fetch persisted documents to get real Mongo _ids
  let jobsForMatching = scoredJobs;
  if (jobsForUpsert.length > 0) {
    const persisted = await JobListing.find({
      $or: jobsForUpsert.map(j => ({ source: j.source, externalId: j.externalId })),
    }).lean();

    const byKey = new Map(persisted.map(doc => [`${doc.source}:${doc.externalId}`, doc]));
    const ghostByKey = new Map(scoredJobs.map(j => [`${j.source}:${j.externalId}`, j.ghostScore]));

    jobsForMatching = jobsForUpsert
      .map(j => {
        const doc = byKey.get(`${j.source}:${j.externalId}`);
        if (!doc) return null;
        return { ...doc, ghostScore: ghostByKey.get(`${j.source}:${j.externalId}`) || doc.ghostScore };
      })
      .filter(Boolean);
  }

  return {
    jobs: jobsForMatching,
    stats: { raw: rawJobs.length, ghostFiltered: ghostFilteredCount, newJobs: newJobsCount },
  };
};

/**
 * Fetch recent jobs from DB for matching (last 24 hours).
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const getRecentJobs = async (limit = 150) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return JobListing.find({ createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

module.exports = { aggregateJobs, getRecentJobs };
