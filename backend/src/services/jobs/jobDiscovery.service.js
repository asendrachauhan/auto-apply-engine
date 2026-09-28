/**
 * Job Discovery Service — master aggregator for ALL sources.
 *
 * Sources, and their actual status as of Session 39 (2026-08-22):
 * - Remotive    — public API, no key needed. Verified sound.
 * - Himalayas   — public API, no key needed. Verified sound.
 * - Adzuna      — official API, free key. Verified sound.
 * - Indeed RSS  — public feed, self-identifying User-Agent (no spoofing).
 *   Reliability uncertain — Indeed has been widely reported to be
 *   deprecating RSS support. Fixed a wrong-host bug and a field-mapping
 *   bug in Session 35; see indeed.rss.scraper.js.
 * - LinkedIn / Naukri — Session 39: REPLACED the direct scrapers flagged in
 *   Sessions 35-37 (Googlebot User-Agent spoofing for LinkedIn; an
 *   undocumented, likely-broken internal API for Naukri) with a real paid
 *   provider — Techmap's Job Postings API via RapidAPI, see
 *   techmap.scraper.js. Gated to PAID PLANS ONLY (see plans.config.js —
 *   'linkedin'/'naukri' are in starter/pro/elite's `sources`, not free's),
 *   per Asendra's decision. `TECHMAP_RAPIDAPI_KEY` must be set or these
 *   two silently return no results (fails soft, same as every other
 *   source here).
 * - Google Jobs — via SerpAPI, official paid search API. Verified sound.
 *   Session 36: found and fixed a real quota-exhaustion bug — this was
 *   being called unconditionally on every watch cycle (120s default) with
 *   no caching, meaning a single active user could burn SerpAPI's entire
 *   250/month free quota in ~8 hours. Added a TTL cache (SerpApiCache
 *   model) and widened the query to cover the user's top 3 job titles.
 *   Results are tagged with `sourcePlatform` so LinkedIn/Naukri postings
 *   found through Google's index (as distinct from the paid Techmap
 *   integration above — two separate ways the same platforms' postings
 *   can surface) are identifiable downstream.
 *
 * No automated applications on ANY of these platforms — we find + prepare,
 * user applies manually.
 */

const JobAlert = require('../../models/JobAlert');
const { scrapeRemotive }    = require('./remotive.scraper');
const { scrapeHimalayas }   = require('./himalayas.scraper');
const { scrapeJobicy }      = require('./jobicy.scraper');
const { scrapeAdzuna }      = require('./adzuna.scraper');
const { scrapeArbeitnow }   = require('./arbeitnow.scraper');
const { scrapeIndeed }      = require('./indeed.rss.scraper');
const { scrapeLinkedIn, scrapeNaukri } = require('./techmap.scraper');
const { scrapeLinkedInApify, scrapeNaukriApify, scrapeIndeedApify } = require('./apify.scraper');
const { scrapeGoogleJobs }  = require('./serpapi.scraper');
const { filterGhostJobs }   = require('../intelligence/ghostJob.service');
const { isJobEligible }     = require('../../utils/jobEligibility');
const { PLAN_LIMITS, PLAN } = require('../../utils/constants');
const { getEffectivePlanId } = require('../../config/featureFlags.service');
const logger = require('../../utils/logger');

const PLATFORM_LABELS = {
  'remotive':    'Remotive',
  'himalayas':   'Himalayas',
  'jobicy':      'Jobicy',
  'adzuna':      'Adzuna',
  'arbeitnow':   'Arbeitnow',
  'indeed':      'Indeed',
  'linkedin':    'LinkedIn',
  'naukri':      'Naukri',
  'google-jobs': 'Google Jobs',
  'apify':       'Apify',
};

/**
 * Deduplicate jobs by URL (canonical identifier across sources).
 */
const deduplicateByUrl = (jobs) => {
  const seen = new Set();
  return jobs.filter(j => {
    const key = (j.url || '').split('?')[0].toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Filter jobs by user preferences and candidate location/visa eligibility.
 */
const filterByPreferences = (jobs, prefs) => {
  if (!prefs) return jobs;

  return jobs.filter(job => {
    // Min salary filter (basic keyword check)
    if (prefs.minSalary && job.salary) {
      const salaryNums = job.salary.match(/\d+/g)?.map(Number) || [];
      if (salaryNums.length > 0 && Math.max(...salaryNums) < prefs.minSalary) return false;
    }
    // Strict location, remote, and visa sponsorship candidate eligibility filter
    return isJobEligible(job, prefs);
  });
};

/**
 * Check which jobs are already alerted for this user (avoid duplicates).
 */
const filterAlreadyAlerted = async (userId, jobs) => {
  const urls = jobs.map(j => j.url).filter(Boolean);
  const existing = await JobAlert.find({ userId, jobUrl: { $in: urls } }).select('jobUrl').lean();
  const alertedUrls = new Set(existing.map(a => a.jobUrl));
  return jobs.filter(j => !alertedUrls.has(j.url));
};

/**
 * Discover new jobs from all sources for a given user.
 * @param {object} user - user document
 * @returns {Promise<object[]>} new job listings not yet seen
 */
const discoverJobs = async (user) => {
  const prefs      = user.preferences || {};
  // Bug fix (Session 43): see jobAggregator.service.js's buildSearchTerms
  // for the full reasoning — this defaulted to a tech-specific title when
  // a user had no jobTitles set. Onboarding requires setting titles, so
  // this is an edge-case fallback, not routine — but it was assuming
  // every such user is a developer regardless.
  if (!prefs.jobTitles?.length) {
    logger.warn(`[JobDiscovery] User ${user._id}: no jobTitles set — falling back to a generic search term. This should only happen if onboarding was not completed.`);
  }
  const titles     = prefs.jobTitles?.length ? prefs.jobTitles : ['professional'];
  const locations  = prefs.locations?.length ? prefs.locations : ['India'];
  const primaryTitle    = titles[0];
  const primaryLocation = locations.find(l => l && l.toLowerCase() !== 'remote') || locations[0] || 'India';
  const isRemote   = prefs.remoteOnly || false;
  const effectivePlan = await getEffectivePlanId(user.plan);
  const allowedSources = new Set((PLAN_LIMITS[effectivePlan] || PLAN_LIMITS[PLAN.FREE]).sources);

  logger.info(`[JobDiscovery] User ${user._id}: discovering jobs for "${primaryTitle}" (plan: ${user.plan}, effective: ${effectivePlan})`);

  // Google Jobs (via SerpAPI) is queried across the user's job titles, not
  // just the primary one (Session 36) — this is the "lean harder on Google
  // Jobs for LinkedIn/Naukri coverage" change: since Google Jobs surfaces
  // LinkedIn/Naukri postings without us touching either platform directly,
  // querying more of the user's actual titles means genuinely more
  // LinkedIn/Naukri coverage through the compliant channel, not just more
  // API calls for their own sake. Capped at 3 titles — safe now that
  // results are cached per (title, location) with a real TTL (see
  // serpapi.scraper.js), so this can't runaway-burn the SerpAPI quota the
  // way the uncapped, uncached version would have.
  const googleJobsTitles = titles.slice(0, 3);

  // Run all scrapers concurrently — high-priority portals (Naukri, LinkedIn, Indeed) first
  const [
    naukriJobs,
    apifyNaukriJobs,
    linkedinJobs,
    apifyLinkedinJobs,
    indeedJobs,
    apifyIndeedJobs,
    adzunaJobs,
    ...googleJobsResults
  ] = await Promise.allSettled([
    allowedSources.has('naukri')     ? scrapeNaukri(primaryTitle, primaryLocation) : Promise.resolve([]),
    allowedSources.has('naukri')     ? scrapeNaukriApify(primaryTitle, primaryLocation) : Promise.resolve([]),
    allowedSources.has('linkedin')   ? scrapeLinkedIn(primaryTitle, primaryLocation) : Promise.resolve([]),
    allowedSources.has('linkedin')   ? scrapeLinkedInApify(primaryTitle, primaryLocation) : Promise.resolve([]),
    scrapeIndeed(primaryTitle, primaryLocation),
    allowedSources.has('indeed')     ? scrapeIndeedApify(primaryTitle, primaryLocation) : Promise.resolve([]),
    allowedSources.has('adzuna')     ? scrapeAdzuna(primaryTitle, primaryLocation) : Promise.resolve([]),
    ...googleJobsTitles.map(title => scrapeGoogleJobs(title, primaryLocation)),
  ]);

  // Secondary international/remote aggregators
  const [
    remotiveJobs,
    himalayasJobs,
    jobicyJobs,
    arbeitnowJobs,
  ] = await Promise.allSettled([
    allowedSources.has('remotive')   ? scrapeRemotive(primaryTitle, 40) : Promise.resolve([]),
    allowedSources.has('himalayas')  ? scrapeHimalayas(primaryTitle, 40) : Promise.resolve([]),
    scrapeJobicy(primaryTitle, 40),
    allowedSources.has('arbeitnow')  ? scrapeArbeitnow({ search: primaryTitle, visaOnly: prefs.visaSponsorshipRequired, remoteOnly: isRemote }) : Promise.resolve([]),
  ]);

  const googleJobs = googleJobsResults
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // High priority: Naukri, LinkedIn, Indeed first
  const highPriorityJobs = [
    ...(naukriJobs.status        === 'fulfilled' ? naukriJobs.value        : []),
    ...(apifyNaukriJobs.status   === 'fulfilled' ? apifyNaukriJobs.value   : []),
    ...(linkedinJobs.status      === 'fulfilled' ? linkedinJobs.value      : []),
    ...(apifyLinkedinJobs.status === 'fulfilled' ? apifyLinkedinJobs.value : []),
    ...(indeedJobs.status        === 'fulfilled' ? indeedJobs.value        : []),
    ...(apifyIndeedJobs.status   === 'fulfilled' ? apifyIndeedJobs.value   : []),
  ];

  const secondaryJobs = [
    ...googleJobs,
    ...(adzunaJobs.status        === 'fulfilled' ? adzunaJobs.value        : []),
    ...(himalayasJobs.status     === 'fulfilled' ? himalayasJobs.value     : []),
    ...(remotiveJobs.status      === 'fulfilled' ? remotiveJobs.value      : []),
    ...(jobicyJobs.status        === 'fulfilled' ? jobicyJobs.value        : []),
    ...(arbeitnowJobs.status     === 'fulfilled' ? arbeitnowJobs.value     : []),
  ];

  const allJobs = [...highPriorityJobs, ...secondaryJobs].filter(j => j.title && j.url);

  const googleLinkedinCount = googleJobs.filter(j => j.sourcePlatform === 'linkedin').length;
  const googleNaukriCount   = googleJobs.filter(j => j.sourcePlatform === 'naukri').length;
  logger.info(`[JobDiscovery] Priority jobs fetched: ${highPriorityJobs.length} (Naukri, LinkedIn, Indeed), ${secondaryJobs.length} from secondary aggregators`);
  logger.info(`[JobDiscovery] Google Jobs: ${googleJobs.length} total (${googleLinkedinCount} via LinkedIn, ${googleNaukriCount} via Naukri) across ${googleJobsTitles.length} title queries`);
  logger.info(`[JobDiscovery] Raw: ${allJobs.length} jobs from all sources`);

  // Ghost-job filter — same differentiator used by the auto-apply pipeline.
  // Runs here too so alerts never surface stale/fake listings either.
  const minGhostScore = Number.isFinite(prefs.ghostScoreMinimum)
    ? prefs.ghostScoreMinimum
    : (Number(process.env.GHOST_JOB_MIN_SCORE) || 40);
  const ghostFiltered = filterGhostJobs(allJobs, { minScore: minGhostScore })
    .map(j => ({ ...j, ghostScore: j.ghostScore.realJobScore, ghostVerdict: j.ghostScore.verdict }));
  logger.info(`[JobDiscovery] After ghost filter: ${ghostFiltered.length}`);

  // Deduplicate
  const unique = deduplicateByUrl(ghostFiltered);
  logger.info(`[JobDiscovery] After dedup: ${unique.length} unique jobs`);

  // Apply preference filters
  const filtered = filterByPreferences(unique, prefs);
  logger.info(`[JobDiscovery] After preference filter: ${filtered.length}`);

  // Remove already alerted
  const fresh = await filterAlreadyAlerted(user._id, filtered);
  logger.info(`[JobDiscovery] Fresh (not yet alerted): ${fresh.length}`);

  // Sort by posting date descending so the newest jobs (posted minutes/hours ago) are scored and processed first
  const sorted = fresh.sort((a, b) => {
    const timeA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const timeB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    return timeB - timeA;
  });

  return sorted;
};

module.exports = { discoverJobs, PLATFORM_LABELS };
