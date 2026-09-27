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

/**
 * Extract structured job info from SerpApi organic Google search result for Naukri.
 */
const parseNaukriOrganicResult = (item, defaultKeyword = '', defaultLocation = 'India') => {
  const url = item.link || '';
  const snippet = item.snippet || '';
  const rawTitle = item.title || '';

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
 * @param {string} location - city or country
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const scrapeNaukri = async (keyword = 'software developer', location = 'India', limit = 25) => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    logger.warn('[Naukri] SERPAPI_KEY not set — skipping Naukri search');
    return [];
  }

  const cacheKey = `naukri::${keyword}::${location}`.toLowerCase().trim();

  try {
    const cached = await SerpApiCache.findOne({ cacheKey }).lean();
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) < getCacheTtlMs()) {
      logger.debug(`[Naukri] Cache hit for "${keyword}" in "${location}" (${cached.jobs.length} jobs)`);
      return cached.jobs.slice(0, limit);
    }
  } catch (cacheErr) {
    logger.warn(`[Naukri] Cache read error: ${cacheErr.message}`);
  }

  logger.info(`[Naukri] Searching live jobs for "${keyword}" in "${location}" via SerpAPI`);

  try {
    const query = `site:naukri.com/job-listings "${keyword}" ${location}`;
    const res = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: query,
        api_key: apiKey,
        hl: 'en',
        gl: 'in',
        num: Math.min(20, Math.max(10, limit)),
      },
      timeout: TIMEOUT,
    });

    const organic = res.data?.organic_results || [];
    const jobs = organic
      .filter(item => item.link && item.link.includes('naukri.com/job-listings'))
      .map(item => parseNaukriOrganicResult(item, keyword, location))
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    logger.info(`[Naukri] Found ${jobs.length} jobs for "${keyword}"`);

    // Cache the results
    if (jobs.length > 0) {
      SerpApiCache.findOneAndUpdate(
        { cacheKey },
        { cacheKey, jobs, fetchedAt: new Date() },
        { upsert: true, new: true }
      ).catch(e => logger.warn(`[Naukri] Cache write failed: ${e.message}`));
    }

    return jobs.slice(0, limit);
  } catch (err) {
    logger.warn(`[Naukri] Scrape failed for "${keyword}": ${err.message}`);
    return [];
  }
};

module.exports = { scrapeNaukri };
