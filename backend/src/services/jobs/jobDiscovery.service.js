/**
 * Job Discovery Service — master aggregator for ALL sources.
 *
 * Legal sources only:
 * - Remotive    — public API, no key needed
 * - Himalayas   — public API, no key needed
 * - Adzuna      — official API, free key
 * - Indeed RSS  — official RSS feed, explicitly allowed
 * - LinkedIn    — public JSON-LD schema data
 * - Naukri      — public search API
 * - Google Jobs — via SerpAPI (official search API)
 *
 * No automated applications on these platforms.
 * We find + prepare. User applies manually.
 */

const JobAlert = require('../../models/JobAlert');
const { scrapeRemotive }    = require('./remotive.scraper');
const { scrapeHimalayas }   = require('./himalayas.scraper');
const { scrapeAdzuna }      = require('./adzuna.scraper');
const { scrapeArbeitnow }   = require('./arbeitnow.scraper');
const { scrapeIndeed }      = require('./indeed.rss.scraper');
const { scrapeLinkedIn }    = require('./linkedin.rss.scraper');
const { scrapeNaukri }      = require('./naukri.rss.scraper');
const { scrapeGoogleJobs }  = require('./serpapi.scraper');
const { filterGhostJobs }   = require('../intelligence/ghostJob.service');
const { PLAN_LIMITS, PLAN } = require('../../utils/constants');
const logger = require('../../utils/logger');

const PLATFORM_LABELS = {
  'remotive':    'Remotive',
  'himalayas':   'Himalayas',
  'adzuna':      'Adzuna',
  'arbeitnow':   'Arbeitnow',
  'indeed':      'Indeed',
  'linkedin':    'LinkedIn',
  'naukri':      'Naukri',
  'google-jobs': 'Google Jobs',
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
 * Filter jobs by user preferences.
 */
const filterByPreferences = (jobs, prefs) => {
  if (!prefs) return jobs;

  return jobs.filter(job => {
    // Min salary filter (basic keyword check)
    if (prefs.minSalary && job.salary) {
      const salaryNums = job.salary.match(/\d+/g)?.map(Number) || [];
      if (salaryNums.length > 0 && Math.max(...salaryNums) < prefs.minSalary) return false;
    }
    // Remote only filter
    if (prefs.remoteOnly && !job.remote && !job.location?.toLowerCase().includes('remote')) return false;
    return true;
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
  const titles     = prefs.jobTitles?.length ? prefs.jobTitles : ['software developer'];
  const locations  = prefs.locations?.length ? prefs.locations : ['India'];
  const primaryTitle    = titles[0];
  const primaryLocation = locations[0];
  const isRemote   = prefs.remoteOnly || false;
  const allowedSources = new Set((PLAN_LIMITS[user.plan] || PLAN_LIMITS[PLAN.FREE]).sources);

  logger.info(`[JobDiscovery] User ${user._id}: discovering jobs for "${primaryTitle}" (plan: ${user.plan})`);

  // Run all scrapers concurrently — gated by what the user's plan includes
  const [
    remotiveJobs,
    himalayasJobs,
    adzunaJobs,
    arbeitnowJobs,
    indeedJobs,
    linkedinJobs,
    naukriJobs,
    googleJobs,
  ] = await Promise.allSettled([
    allowedSources.has('remotive')   ? scrapeRemotive(primaryTitle, 40) : Promise.resolve([]),
    allowedSources.has('himalayas')  ? scrapeHimalayas(primaryTitle, 40) : Promise.resolve([]),
    allowedSources.has('adzuna')     ? scrapeAdzuna(primaryTitle, primaryLocation) : Promise.resolve([]),
    allowedSources.has('arbeitnow')  ? scrapeArbeitnow({ search: primaryTitle, visaOnly: prefs.visaSponsorshipRequired, remoteOnly: isRemote }) : Promise.resolve([]),
    scrapeIndeed(primaryTitle, primaryLocation),
    scrapeLinkedIn(primaryTitle, primaryLocation, isRemote),
    scrapeNaukri(primaryTitle, primaryLocation),
    scrapeGoogleJobs(primaryTitle, primaryLocation),
  ]);

  const allJobs = [
    ...(remotiveJobs.status  === 'fulfilled' ? remotiveJobs.value  : []),
    ...(himalayasJobs.status === 'fulfilled' ? himalayasJobs.value : []),
    ...(adzunaJobs.status    === 'fulfilled' ? adzunaJobs.value    : []),
    ...(arbeitnowJobs.status === 'fulfilled' ? arbeitnowJobs.value : []),
    ...(indeedJobs.status    === 'fulfilled' ? indeedJobs.value    : []),
    ...(linkedinJobs.status  === 'fulfilled' ? linkedinJobs.value  : []),
    ...(naukriJobs.status    === 'fulfilled' ? naukriJobs.value    : []),
    ...(googleJobs.status    === 'fulfilled' ? googleJobs.value    : []),
  ].filter(j => j.title && j.url);

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

  return fresh;
};

module.exports = { discoverJobs, PLATFORM_LABELS };
