'use strict';
/**
 * Job aggregator service — the core discovery pipeline behind automated
 * applications. Runs all legal scrapers in parallel, scores every job for
 * "ghost job" legitimacy (our differentiator — see intelligence/ghostJob
 * .service.js), deduplicates, upserts to MongoDB, and returns the jobs the
 * matcher should actually consider.
 */

const JobListing = require('../../models/JobListing');
const { scrapeRemotive }   = require('./remotive.scraper');
const { scrapeHimalayas }  = require('./himalayas.scraper');
const { scrapeAdzuna }     = require('./adzuna.scraper');
const { scrapeArbeitnow }  = require('./arbeitnow.scraper');
const { filterGhostJobs }  = require('../intelligence/ghostJob.service');
const { PLAN_LIMITS, PLAN } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Build search queries from user preferences.
 * @param {object} preferences - user.preferences
 * @returns {string[]}
 */
const buildSearchTerms = (preferences) => {
  const titles = preferences?.jobTitles?.length
    ? preferences.jobTitles
    : ['software developer', 'full stack developer'];

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
  const allowedSources = new Set((PLAN_LIMITS[plan] || PLAN_LIMITS[PLAN.FREE]).sources);

  const searchTerms = buildSearchTerms(preferences);
  const locations    = preferences?.locations?.slice(0, 2) || [];
  const primaryTerm   = searchTerms[0];
  const primaryLoc    = locations[0] || '';
  const remoteOnly    = Boolean(preferences?.remoteOnly);
  const visaOnly      = Boolean(preferences?.visaSponsorshipRequired);

  logger.info(`Aggregating jobs for terms: ${searchTerms.join(', ')} (plan: ${plan}${euMode ? ', EU mode' : ''})`);

  // Only call scrapers this plan actually includes.
  const tasks = [];
  if (allowedSources.has('remotive'))  tasks.push(scrapeRemotive(primaryTerm, 50));
  else tasks.push(Promise.resolve([]));

  if (allowedSources.has('himalayas')) tasks.push(scrapeHimalayas(primaryTerm, 50));
  else tasks.push(Promise.resolve([]));

  if (allowedSources.has('adzuna'))    tasks.push(scrapeAdzuna(primaryTerm, primaryLoc));
  else tasks.push(Promise.resolve([]));

  if (allowedSources.has('arbeitnow') && (euMode || visaOnly)) {
    tasks.push(scrapeArbeitnow({ search: primaryTerm, visaOnly, remoteOnly }));
  } else {
    tasks.push(Promise.resolve([]));
  }

  const results = await Promise.allSettled(tasks);
  const [remotiveJobs, himalayasJobs, adzunaJobs, arbeitnowJobs] = results.map(
    r => (r.status === 'fulfilled' ? r.value : [])
  );

  const rawJobs = [...remotiveJobs, ...himalayasJobs, ...adzunaJobs, ...arbeitnowJobs]
    .filter(j => j.title && j.url);
  logger.info(`Total raw jobs fetched: ${rawJobs.length}`);

  // Ghost-job filter — our unique differentiator. Score every job 0-100 for
  // legitimacy and drop anything below the threshold before it ever reaches
  // matching, DB storage, or the user.
  const minGhostScore = Number.isFinite(preferences?.ghostScoreMinimum)
    ? preferences.ghostScoreMinimum
    : (Number(process.env.GHOST_JOB_MIN_SCORE) || 40);
  const scoredJobs = filterGhostJobs(rawJobs, { minScore: minGhostScore });
  const ghostFilteredCount = rawJobs.length - scoredJobs.length;

  // Flatten ghostScore object -> the plain 0-100 number the schema expects,
  // but keep the full breakdown on the in-memory object for the matcher/UI.
  const jobsForUpsert = scoredJobs.map(j => ({
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

  // Jobs returned for matching keep the full ghostScore object (score +
  // verdict + signals) since the AI matcher and downstream code read
  // job.ghostScore.realJobScore.
  return {
    jobs: scoredJobs,
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
