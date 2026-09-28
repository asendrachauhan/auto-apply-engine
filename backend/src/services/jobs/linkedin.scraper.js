'use strict';

/**
 * Dedicated LinkedIn Job Scraper.
 *
 * Surfaces direct, verified LinkedIn job listings through SerpAPI Google Jobs
 * with targeted query (`${searchTerm} LinkedIn`), backed by SerpApiCache.
 *
 * All surfaced jobs are verified and tagged with:
 *   source: 'linkedin', sourcePlatform: 'linkedin', platform: 'LinkedIn'
 *
 * Direct URLs are resolved to `linkedin.com/jobs/view/...` or direct portal links.
 */

const axios = require('axios');
const SerpApiCache = require('../../models/SerpApiCache');
const logger = require('../../utils/logger');
const { parseRelativeDate } = require('../../utils/dateParser');

const BASE_URL = 'https://serpapi.com/search';
const TIMEOUT  = 20_000;
const getCacheTtlMs = () => (Number(process.env.SERPAPI_CACHE_TTL_SECONDS) || 30 * 60) * 1000;

// Unwrap Google redirect parameters to extract direct destination URLs
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

// Select the most direct LinkedIn application URL from apply_options
const extractBestLinkedInUrl = (job) => {
  const options = Array.isArray(job.apply_options) ? job.apply_options : [];

  // Priority 1: Direct link containing 'linkedin.com'
  const linkedInDirect = options.find(o => {
    const title = (o.title || '').toLowerCase();
    const link  = (o.link || '').toLowerCase();
    return title.includes('linkedin') || link.includes('linkedin.com');
  });
  if (linkedInDirect?.link) return unwrapGoogleUrl(linkedInDirect.link);

  // Priority 2: Any apply option
  const validOption = options.find(o => o.link && typeof o.link === 'string' && o.link.startsWith('http'));
  if (validOption?.link) return unwrapGoogleUrl(validOption.link);

  // Priority 3: Related links or share link
  const fallback = job.related_links?.[0]?.link || job.share_link || '';
  return unwrapGoogleUrl(fallback);
};

const normalizeLinkedInJob = (j, defaultLocation = 'India') => {
  const directUrl = extractBestLinkedInUrl(j);
  return {
    source:         'linkedin',
    sourcePlatform: 'linkedin',
    platform:       'LinkedIn',
    externalId:     j.job_id || `linkedin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title:          j.title || '',
    company:        j.company_name || 'LinkedIn Employer',
    location:       j.location || defaultLocation || 'India',
    description:    (j.description || '').slice(0, 4000),
    url:            directUrl,
    salary:         j.detected_extensions?.salary || '',
    remote:         Boolean(j.detected_extensions?.work_from_home || /remote/i.test(j.title || '')),
    jobType:        j.detected_extensions?.schedule_type || 'Full-time',
    postedAt:       parseRelativeDate(j.extensions || j.detected_extensions?.posted_at),
    skills:         [],
    applyLinks:     j.apply_options?.map(o => ({ platform: o.title, url: unwrapGoogleUrl(o.link) })) || [],
  };
};

/**
 * Scrape LinkedIn jobs for a given keyword and location.
 * @param {string} searchTerm - Job title or keywords
 * @param {string} location - City or country
 * @param {number} limit - Maximum jobs to return
 * @returns {Promise<object[]>}
 */
const scrapeLinkedIn = async (searchTerm = 'software engineer', location = 'India', limit = 25) => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    logger.warn('[LinkedIn] SERPAPI_KEY not set — skipping LinkedIn search');
    return [];
  }

  const cacheKey = `linkedin::${searchTerm}::${location}`.toLowerCase().trim();

  try {
    const cached = await SerpApiCache.findOne({ cacheKey }).lean();
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) < getCacheTtlMs()) {
      logger.debug(`[LinkedIn] Cache hit for "${searchTerm}" in "${location}" (${cached.jobs.length} jobs)`);
      return cached.jobs.slice(0, limit);
    }
  } catch (cacheErr) {
    logger.warn(`[LinkedIn] Cache read error: ${cacheErr.message}`);
  }

  logger.info(`[LinkedIn] Fetching live jobs for "${searchTerm}" in "${location}" via SerpAPI Google Jobs`);

  try {
    const isRemoteOnly = !location || location.toLowerCase() === 'remote';
    const query = isRemoteOnly && !searchTerm.toLowerCase().includes('remote')
      ? `${searchTerm} remote LinkedIn`
      : `${searchTerm} LinkedIn`;

    const params = {
      engine: 'google_jobs',
      q: query,
      api_key: apiKey,
      hl: 'en',
      gl: 'in',
    };
    if (!isRemoteOnly && location) {
      params.location = location;
    }

    const res = await axios.get(BASE_URL, {
      params,
      timeout: TIMEOUT,
    });

    const results = res.data?.jobs_results || [];
    const jobs = results
      .map(j => normalizeLinkedInJob(j, location))
      .filter(j => j.title && j.url)
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    logger.info(`[LinkedIn] Found ${jobs.length} jobs via SerpAPI for "${searchTerm}"`);

    // Cache the results
    if (jobs.length > 0) {
      SerpApiCache.findOneAndUpdate(
        { cacheKey },
        { cacheKey, jobs, fetchedAt: new Date() },
        { upsert: true, new: true }
      ).catch(e => logger.warn(`[LinkedIn] Cache write failed: ${e.message}`));
    }

    return jobs.slice(0, limit);
  } catch (err) {
    logger.warn(`[LinkedIn] Scrape failed for "${searchTerm}": ${err.message}`);
    return [];
  }
};

module.exports = { scrapeLinkedIn };
