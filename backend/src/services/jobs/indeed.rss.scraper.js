'use strict';

/**
 * Indeed Job Scraper.
 *
 * Indeed retired public RSS feeds (returning 404 in 2026).
 * This service provides a dual-layer approach:
 * 1. Checks SerpApi Google Jobs targeted query (`${searchTerm} indeed`) cached via SerpApiCache.
 * 2. Falls back to RSS if ever restored.
 * All surfaced jobs are tagged with source: 'indeed' and sourcePlatform: 'indeed'.
 */

const axios = require('axios');
const SerpApiCache = require('../../models/SerpApiCache');
const logger = require('../../utils/logger');
const { parseRelativeDate } = require('../../utils/dateParser');

const BASE_URL = 'https://rss.indeed.com/rss';
const TIMEOUT  = 20_000;
const getCacheTtlMs = () => (Number(process.env.SERPAPI_CACHE_TTL_SECONDS) || 30 * 60) * 1000;

/**
 * Parse Indeed RSS XML if available.
 */
const parseRSS = (xml, country = 'in', searchLocation = 'India') => {
  const jobs = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const extract = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    const title   = extract('title');
    const link    = extract('link') || extract('guid');
    const company = extract('source') || extract('author');
    const desc    = extract('description').replace(/<[^>]*>/g, ' ').slice(0, 3000);
    const pubDate = extract('pubDate');
    const salary  = (block.match(/<indeed:salary>(.*?)<\/indeed:salary>/i) || [])[1] || '';

    if (title && link) {
      jobs.push({
        source:         'indeed',
        sourcePlatform: 'indeed',
        externalId:     link.split('jk=')[1]?.split('&')[0] || `indeed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title,
        company:        company || 'Unknown Company',
        location:       searchLocation || 'India',
        description:    desc,
        url:            link,
        salary,
        remote:         desc.toLowerCase().includes('remote') || title.toLowerCase().includes('remote'),
        jobType:        'full-time',
        postedAt:       pubDate ? new Date(pubDate) : new Date(),
        skills:         [],
      });
    }
  }
  return jobs;
};

/**
 * Fetch Indeed jobs via SerpAPI Google Jobs targeted search.
 */
const fetchIndeedViaSerpApi = async (searchTerm, location, limit = 25) => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const cacheKey = `indeed::${searchTerm}::${location}`.toLowerCase().trim();

  try {
    const cached = await SerpApiCache.findOne({ cacheKey }).lean();
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) < getCacheTtlMs()) {
      logger.debug(`[Indeed] Cache hit for "${searchTerm}" in "${location}" (${cached.jobs.length} jobs)`);
      return cached.jobs.slice(0, limit);
    }
  } catch (cacheErr) {
    logger.warn(`[Indeed] Cache read error: ${cacheErr.message}`);
  }

  logger.info(`[Indeed] Fetching jobs for "${searchTerm}" in "${location}" via SerpAPI`);

  try {
    const res = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_jobs',
        q: `${searchTerm} indeed`,
        location: location || 'India',
        api_key: apiKey,
        hl: 'en',
        gl: 'in',
      },
      timeout: TIMEOUT,
    });

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

    const results = res.data?.jobs_results || [];
    const jobs = results.map(j => {
      // Find direct Indeed apply link if present, or first direct apply option
      const indeedOption = (j.apply_options || []).find(o => /indeed/i.test(o.title || '') || /indeed/i.test(o.link || ''));
      const directUrl = unwrapGoogleUrl(indeedOption?.link || j.apply_options?.[0]?.link || j.related_links?.[0]?.link || j.share_link || '');

      return {
        source:         'indeed',
        sourcePlatform: 'indeed',
        externalId:     j.job_id || `indeed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title:          j.title || '',
        company:        j.company_name || 'Indeed Employer',
        location:       j.location || location || 'India',
        description:    (j.description || '').slice(0, 4000),
        url:            directUrl,
        salary:         j.detected_extensions?.salary || '',
        remote:         Boolean(j.detected_extensions?.work_from_home || /remote/i.test(j.title || '')),
        jobType:        j.detected_extensions?.schedule_type || 'Full-time',
        postedAt:       parseRelativeDate(j.extensions || j.detected_extensions?.posted_at),
        skills:         [],
        applyLinks:     j.apply_options?.map(o => ({ platform: o.title, url: o.link })) || [],
      };
    }).filter(j => j.title && j.url)
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    logger.info(`[Indeed] Found ${jobs.length} jobs via SerpAPI`);

    if (jobs.length > 0) {
      SerpApiCache.findOneAndUpdate(
        { cacheKey },
        { cacheKey, jobs, fetchedAt: new Date() },
        { upsert: true, new: true }
      ).catch(e => logger.warn(`[Indeed] Cache write failed: ${e.message}`));
    }

    return jobs.slice(0, limit);
  } catch (err) {
    logger.warn(`[Indeed] SerpAPI query failed: ${err.message}`);
    return [];
  }
};

/**
 * Fetch Indeed jobs (SerpAPI fallback with RSS check).
 * @param {string} searchTerm
 * @param {string} location
 * @param {string} country - country code (in, us, gb…)
 */
const scrapeIndeed = async (searchTerm = 'professional', location = 'India', country = 'in') => {
  // First attempt targeted SerpAPI search (guaranteed live data)
  const serpJobs = await fetchIndeedViaSerpApi(searchTerm, location);
  if (serpJobs && serpJobs.length > 0) {
    return serpJobs;
  }

  // Fallback to RSS if SerpAPI returns empty or has no quota
  try {
    const params = new URLSearchParams({
      q:       searchTerm,
      l:       location,
      sort:    'date',
      limit:   '25',
      fromage: '1',
    });

    const url = `${BASE_URL}?${params.toString()}`;
    const { data: xml } = await axios.get(url, {
      timeout: TIMEOUT,
      headers: { 'User-Agent': 'AutoApply/1.0 (Job Aggregator; +https://autoapply.ai)' },
    });

    const jobs = parseRSS(xml, country, location);
    logger.info(`Indeed: found ${jobs.length} jobs via RSS`);
    return jobs;
  } catch (err) {
    logger.debug(`Indeed RSS not reachable (${err.message})`);
    return [];
  }
};

module.exports = { scrapeIndeed };
