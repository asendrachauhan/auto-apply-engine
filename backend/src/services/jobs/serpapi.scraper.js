/**
 * SerpAPI — Google Jobs aggregator.
 *
 * Google Jobs aggregates LinkedIn, Indeed, Naukri, Glassdoor, and 100+ boards.
 * Accessing via SerpAPI is 100% legal — we're using a paid search API.
 * Free tier: 250 searches/month (verified current as of Session 35, 2026-08-22
 * — SerpAPI's `google_jobs` engine and response shape were confirmed still
 * active; this is the only one of the four alert-only sources verified this
 * session to be a genuinely stable, sanctioned integration).
 * https://serpapi.com/google-jobs-api
 *
 * This is the BEST source because:
 * - Legal — official search API
 * - Aggregates all major platforms, INCLUDING LinkedIn and Naukri, without
 *   needing to scrape either directly — see `sourcePlatform` in the
 *   normalized job object below (Session 36)
 * - Structured JSON response
 * - Real-time (within hours of posting)
 *
 * CACHING (Session 36, 2026-08-22): results are cached per (searchTerm,
 * location) via the SerpApiCache model. This is a real fix, not an
 * optimization — see SerpApiCache.js's header comment for the quota-
 * exhaustion bug this closes. Cache TTL default 30 min, override with
 * `SERPAPI_CACHE_TTL_SECONDS`.
 */

const axios  = require('axios');
const SerpApiCache = require('../../models/SerpApiCache');
const logger = require('../../utils/logger');
const { parseRelativeDate } = require('../../utils/dateParser');

const BASE_URL = 'https://serpapi.com/search';
const TIMEOUT  = 20_000;
const getCacheTtlMs = () => (Number(process.env.SERPAPI_CACHE_TTL_SECONDS) || 30 * 60) * 1000;

// Unwrap Google redirect URLs (e.g. https://www.google.com/url?q=...) to direct target URLs
const unwrapGoogleUrl = (rawUrl = '') => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  try {
    if (trimmed.includes('google.com/url?') || trimmed.includes('/url?q=') || trimmed.includes('/url?url=')) {
      const parsed = new URL(trimmed);
      const target = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (target && target.startsWith('http')) return decodeURIComponent(target);
    }
  } catch {}
  return trimmed;
};

// Select the most direct and reliable job application URL, prioritizing Naukri, LinkedIn, Indeed, and employer sites
const extractBestJobUrl = (job) => {
  const options = Array.isArray(job.apply_options) ? job.apply_options : [];

  // Priority 1: Direct link from top priority portals (Naukri, LinkedIn, Indeed)
  const topPortalMatch = options.find(o => {
    const title = (o.title || '').toLowerCase();
    const link  = (o.link || '').toLowerCase();
    return (
      title.includes('naukri') || link.includes('naukri.com') ||
      title.includes('linkedin') || link.includes('linkedin.com') ||
      title.includes('indeed') || link.includes('indeed.com')
    );
  });
  if (topPortalMatch?.link) return unwrapGoogleUrl(topPortalMatch.link);

  // Priority 2: Any direct application link from apply_options
  const validOption = options.find(o => o.link && typeof o.link === 'string' && o.link.startsWith('http'));
  if (validOption?.link) return unwrapGoogleUrl(validOption.link);

  // Priority 3: Fall back to related link or Google share link
  const fallback = job.related_links?.[0]?.link || job.share_link || '';
  return unwrapGoogleUrl(fallback);
};

// Google Jobs' `via` field reads like "via LinkedIn", "via Naukri.com",
// "via Indeed", etc. — this lets us credit the real origin platform even
// though we only ever queried the compliant, sanctioned Google Jobs API.
const detectSourcePlatform = (via = '', applyOptions = [], url = '') => {
  const v = (via || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const optTitles = (applyOptions || []).map(o => (o.title || '').toLowerCase());
  const optLinks  = (applyOptions || []).map(o => (o.link || '').toLowerCase());

  if (v.includes('naukri') || u.includes('naukri.com') || optTitles.some(t => t.includes('naukri')) || optLinks.some(l => l.includes('naukri.com'))) return 'naukri';
  if (v.includes('linkedin') || u.includes('linkedin.com') || optTitles.some(t => t.includes('linkedin')) || optLinks.some(l => l.includes('linkedin.com'))) return 'linkedin';
  if (v.includes('indeed') || u.includes('indeed.com') || optTitles.some(t => t.includes('indeed')) || optLinks.some(l => l.includes('indeed.com'))) return 'indeed';
  if (v.includes('glassdoor') || u.includes('glassdoor.com') || optTitles.some(t => t.includes('glassdoor')) || optLinks.some(l => l.includes('glassdoor.com'))) return 'glassdoor';
  return 'other';
};

const normalize = (job) => {
  const bestUrl = extractBestJobUrl(job);
  return {
    source:      'google-jobs',
    sourcePlatform: detectSourcePlatform(job.via, job.apply_options, bestUrl),
    externalId:  job.job_id || `gj-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title:       job.title || '',
    company:     job.company_name || '',
    location:    job.location || 'Remote',
    description: (job.description || '').slice(0, 4000),
    url:         bestUrl,
    salary:      job.detected_extensions?.salary || '',
    remote:      (job.detected_extensions?.work_from_home) || false,
    jobType:     job.detected_extensions?.schedule_type || 'Full-time',
    skills:      [],
    postedAt:    parseRelativeDate(job.extensions || job.detected_extensions?.posted_at),
    // Keep original platform info
    platform:    job.via || 'Google Jobs',
    applyLinks:  job.apply_options?.map(o => ({ platform: o.title, url: unwrapGoogleUrl(o.link) })) || [],
  };
};

const cacheKeyFor = (searchTerm, location) => `${searchTerm}::${location}`.toLowerCase().trim();

/**
 * Search Google Jobs via SerpAPI. Cached per (searchTerm, location) —
 * see the module header comment for why.
 * @param {string} searchTerm
 * @param {string} location
 */
const scrapeGoogleJobs = async (searchTerm = 'professional', location = 'India') => {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    logger.warn('SERPAPI_KEY not set — skipping Google Jobs');
    return [];
  }

  const key = cacheKeyFor(searchTerm, location);

  try {
    const cached = await SerpApiCache.findOne({ cacheKey: key }).lean();
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) < getCacheTtlMs()) {
      logger.debug(`SerpAPI: cache hit for "${searchTerm}" in "${location}" (${cached.jobs.length} jobs)`);
      return cached.jobs;
    }
  } catch (cacheErr) {
    // Cache read failing should never block a real search — fall through
    // and hit the API directly, same as a cache miss.
    logger.warn(`SerpAPI cache read failed: ${cacheErr.message}`);
  }

  logger.info(`SerpAPI: searching Google Jobs for "${searchTerm}" in "${location}"`);

  try {
    const isRemoteOnly = !location || location.toLowerCase() === 'remote';
    const query = isRemoteOnly && !searchTerm.toLowerCase().includes('remote')
      ? `${searchTerm} remote`
      : searchTerm;

    const params = {
      api_key: apiKey,
      engine:  'google_jobs',
      q:       query,
      hl:      'en',
      chips:   'date_posted:today', // only today's jobs
    };
    if (!isRemoteOnly && location) {
      params.location = location;
    }

    const { data } = await axios.get(BASE_URL, {
      timeout: TIMEOUT,
      params,
    });

    const jobs = (data.jobs_results || [])
      .map(normalize)
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    logger.info(`SerpAPI: found ${jobs.length} jobs`);

    try {
      await SerpApiCache.findOneAndUpdate(
        { cacheKey: key },
        { cacheKey: key, jobs, fetchedAt: new Date() },
        { upsert: true }
      );
    } catch (cacheWriteErr) {
      // A cache write failure shouldn't fail the actual search result —
      // it just means the next call within the TTL window re-hits the API.
      logger.warn(`SerpAPI cache write failed: ${cacheWriteErr.message}`);
    }

    return jobs;
  } catch (err) {
    logger.warn(`SerpAPI error: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeGoogleJobs };
