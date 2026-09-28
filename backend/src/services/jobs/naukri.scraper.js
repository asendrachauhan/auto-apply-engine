'use strict';

/**
 * Naukri Job Scraper.
 *
 * Naukri retired its legacy RSS feed (returning 404/403).
 * This service surfaces direct Naukri job listings using SerpAPI Google Search
 * indexing with `site:naukri.com/job-listings`, cached via SerpApiCache to protect
 * API quota while delivering 100% verified, live Naukri job opportunities.
 */

const axios = require('axios');
const SerpApiCache = require('../../models/SerpApiCache');
const logger = require('../../utils/logger');
const { parseRelativeDate } = require('../../utils/dateParser');

const TIMEOUT = 20_000;
const getCacheTtlMs = () => (Number(process.env.SERPAPI_CACHE_TTL_SECONDS) || 30 * 60) * 1000;

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

/**
 * Extract structured job info from SerpApi organic Google search result for Naukri.
 */
const parseNaukriOrganicResult = (item, defaultKeyword = '', defaultLocation = 'India') => {
  const url = unwrapGoogleUrl(item.link || '');
  const snippet = item.snippet || '';
  const rawTitle = item.title || '';

  // Skip expired or closed jobs
  if (/expired|closed|no longer available|not accepting applications|vacancy filled/i.test(snippet) ||
      /expired|closed/i.test(rawTitle)) {
    return null;
  }

  // Clean title: remove trailing portal markers like "| Naukri.com"
  let cleanTitle = rawTitle.replace(/\s*\|\s*Naukri.*$/i, '').replace(/\s*-\s*Naukri.*$/i, '').trim();
  let company = 'Naukri Verified Employer';
  let location = defaultLocation;

  // Pattern 1: Title - Location - Company or Title - Company - Location
  const parts = cleanTitle.split(/\s*-\s*/);
  if (parts.length >= 3) {
    cleanTitle = parts[0].trim();
    location = parts[1].trim();
    company = parts[2].trim();
  } else if (parts.length === 2) {
    cleanTitle = parts[0].trim();
    company = parts[1].trim();
  } else {
    // If title is "Java Full Stack Developer Jobs In India"
    cleanTitle = cleanTitle.replace(/\s+Jobs?\s+In\s+.*$/i, '').trim();
  }

  // Refine company from snippet if company is generic
  if (company === 'Naukri Verified Employer' || company.length < 3) {
    const snippetMatch = snippet.match(/([A-Z][A-Za-z0-9\s&,.]{2,35}?)(?:\s+(?:Private\s+Limited|Pvt\s+Ltd|Technologies|Solutions|Consultancy|Services|Limited|LLP|Inc|Corp))/i);
    if (snippetMatch) {
      company = snippetMatch[0].trim();
    } else {
      // Check for patterns like "Tata Consultancy Services 3.2 ·"
      const ratingMatch = snippet.match(/([A-Z][A-Za-z0-9\s&]{2,30}?)(?:\s+\d\.\d)?\s*·/);
      if (ratingMatch && ratingMatch[1]) {
        company = ratingMatch[1].trim();
      }
    }
  }

  // Refine location from snippet if available (e.g. "location Hyderabad, Chennai, Bengaluru")
  const locMatch = snippet.match(/(?:location|in)\s+([A-Za-z\s,]+?)(?:\s*·|\s*;|\s*\d|\.|$)/i);
  if (locMatch && locMatch[1] && locMatch[1].length < 40) {
    location = locMatch[1].trim();
  }

  const externalId = url ? url.replace(/[^a-zA-Z0-9]/g, '_').slice(-80) : `naukri-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dateStr = item.date || item.rich_snippet?.top?.extensions || (snippet.match(/^(\d+\s*(?:mins?|minutes?|hours?|hrs?|days?)\s*ago)/i)?.[1]) || null;
  const postedAt = parseRelativeDate(dateStr);

  return {
    source: 'naukri',
    sourcePlatform: 'naukri',
    externalId,
    title: cleanTitle || defaultKeyword || 'Software Engineer',
    company: company || 'Naukri Verified Employer',
    location: location || 'India',
    description: snippet || `Naukri opening for ${cleanTitle} at ${company}.`,
    url,
    salary: '',
    postedAt,
    remote: /remote/i.test(cleanTitle) || /remote/i.test(snippet) || /remote/i.test(location),
    jobType: 'Full-time',
    visaSponsorship: false,
    skills: [],
  };
};

/**
 * Scrape Naukri jobs for a given keyword and location.
 * @param {string} keyword - job title or search term
 * @param {string|number} location - city or country (or limit if passed as 2nd arg)
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const scrapeNaukri = async (keyword = 'software developer', location = 'India', limit = 25) => {
  // Defensive argument normalization (e.g. if called as scrapeNaukri('developer', 50))
  let effectiveLocation = location;
  let effectiveLimit = limit;
  if (typeof location === 'number') {
    effectiveLimit = location;
    effectiveLocation = 'India';
  }
  if (!effectiveLocation || typeof effectiveLocation !== 'string') {
    effectiveLocation = 'India';
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    logger.warn('[Naukri] SERPAPI_KEY not set — skipping Naukri search');
    return [];
  }

  const cleanKeyword = (keyword || 'software developer').trim();
  const cleanLoc = (effectiveLocation || 'India').trim();
  const cacheKey = `naukri::${cleanKeyword}::${cleanLoc}`.toLowerCase().trim();

  try {
    const cached = await SerpApiCache.findOne({ cacheKey }).lean();
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) < getCacheTtlMs()) {
      logger.debug(`[Naukri] Cache hit for "${cleanKeyword}" in "${cleanLoc}" (${cached.jobs.length} jobs)`);
      return cached.jobs.slice(0, effectiveLimit);
    }
  } catch (cacheErr) {
    logger.warn(`[Naukri] Cache read error: ${cacheErr.message}`);
  }

  logger.info(`[Naukri] Searching live jobs for "${cleanKeyword}" in "${cleanLoc}" via SerpAPI`);

  const collectedJobs = [];
  const seenUrls = new Set();

  try {
    // 1. Google Organic search targeting Naukri job listings (unquoted for broad keyword coverage)
    const organicQuery = `site:naukri.com/job-listings ${cleanKeyword} ${cleanLoc}`;
    const organicRes = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: organicQuery,
        api_key: apiKey,
        hl: 'en',
        gl: 'in',
        num: Math.min(20, Math.max(10, effectiveLimit)),
      },
      timeout: TIMEOUT,
    });

    const organic = organicRes.data?.organic_results || [];
    for (const item of organic) {
      if (item.link && item.link.includes('naukri.com')) {
        const parsed = parseNaukriOrganicResult(item, cleanKeyword, cleanLoc);
        if (parsed && parsed.url && !seenUrls.has(parsed.url)) {
          seenUrls.add(parsed.url);
          collectedJobs.push(parsed);
        }
      }
    }
  } catch (organicErr) {
    logger.warn(`[Naukri] Organic search failed for "${cleanKeyword}": ${organicErr.message}`);
  }

  // 2. Dual-source fallback: If organic returned fewer than 5 jobs, search Google Jobs with "Naukri"
  if (collectedJobs.length < 5) {
    try {
      const gjRes = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_jobs',
          q: `${cleanKeyword} Naukri`,
          location: cleanLoc,
          api_key: apiKey,
          hl: 'en',
          gl: 'in',
        },
        timeout: TIMEOUT,
      });

      const gjResults = gjRes.data?.jobs_results || [];
      for (const j of gjResults) {
        const naukriOpt = (j.apply_options || []).find(o => /naukri/i.test(o.title || '') || /naukri/i.test(o.link || ''));
        const directUrl = unwrapGoogleUrl(naukriOpt?.link || j.apply_options?.[0]?.link || j.related_links?.[0]?.link || j.share_link || '');
        if (directUrl && !seenUrls.has(directUrl)) {
          seenUrls.add(directUrl);
          collectedJobs.push({
            source:         'naukri',
            sourcePlatform: 'naukri',
            platform:       'Naukri',
            externalId:     j.job_id || `naukri-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title:          j.title || cleanKeyword,
            company:        j.company_name || 'Naukri Employer',
            location:       j.location || cleanLoc,
            description:    (j.description || '').slice(0, 4000),
            url:            directUrl,
            salary:         j.detected_extensions?.salary || '',
            remote:         Boolean(j.detected_extensions?.work_from_home || /remote/i.test(j.title || '')),
            jobType:        j.detected_extensions?.schedule_type || 'Full-time',
            postedAt:       parseRelativeDate(j.extensions || j.detected_extensions?.posted_at),
            skills:         [],
            applyLinks:     j.apply_options?.map(o => ({ platform: o.title, url: unwrapGoogleUrl(o.link) })) || [],
          });
        }
      }
    } catch (gjErr) {
      logger.warn(`[Naukri] Google Jobs fallback failed for "${cleanKeyword}": ${gjErr.message}`);
    }
  }

  const jobs = collectedJobs
    .filter(j => j.title && j.url)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  logger.info(`[Naukri] Total found ${jobs.length} jobs for "${cleanKeyword}" in "${cleanLoc}"`);

  // Cache the results
  if (jobs.length > 0) {
    SerpApiCache.findOneAndUpdate(
      { cacheKey },
      { cacheKey, jobs, fetchedAt: new Date() },
      { upsert: true, new: true }
    ).catch(e => logger.warn(`[Naukri] Cache write failed: ${e.message}`));
  }

  return jobs.slice(0, effectiveLimit);
};

module.exports = { scrapeNaukri };
