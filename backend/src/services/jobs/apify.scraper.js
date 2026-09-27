'use strict';

/**
 * Apify Job Scraper Service
 *
 * Provides managed cloud-based scraping for LinkedIn and Naukri job postings
 * via Apify Actors, bypassing bot-detection and IP blocking through Apify's
 * managed residential/datacenter proxy pool and headless browser infrastructure.
 *
 * SETUP:
 * 1. Create an account at apify.com (Free tier: $5 credit/month).
 * 2. Set APIFY_API_TOKEN in backend/.env.
 * 3. Optional: Configure APIFY_LINKEDIN_ACTOR and APIFY_NAUKRI_ACTOR.
 *
 * FAILS SOFT: If APIFY_API_TOKEN is not set or if any call times out or errors,
 * returns [] gracefully without blocking the aggregator or discovery pipelines.
 */

const { ApifyClient } = require('apify-client');
const logger = require('../../utils/logger');
const { parseRelativeDate } = require('../../utils/dateParser');

const DEFAULT_LINKEDIN_ACTOR = 'dottti/linkedin-jobs-scraper';
const DEFAULT_NAUKRI_ACTOR = 'curious_coder/naukri-job-scraper';
const DEFAULT_INDEED_ACTOR = 'misceres/indeed-scraper';
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Get or create an Apify client instance.
 * Returns null if token is missing.
 */
const getClient = () => {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;
  return new ApifyClient({ token });
};

/**
 * Normalize an item returned by Apify into a canonical JobListing object.
 */
const normalizeApifyJob = (job = {}, portal = 'linkedin') => {
  const url = job.url || job.jobUrl || job.link || job.applyUrl || job.externalApplyLink || '';
  const externalId = job.id || job.jobId || job.idDirect || (url ? url.replace(/[^a-zA-Z0-9]/g, '_').slice(-80) : `apify-${portal}-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const title = job.title || job.jobTitle || job.position || job.positionName || job.role || '';
  const company = job.company?.name || (typeof job.company === 'string' ? job.company : null) || job.companyName || 'Unknown Company';
  const location = job.place || job.location?.city || job.location?.name || job.location || job.jobLocation || job.city || 'India';
  const description = (job.description || job.jobDescription || job.text || '').slice(0, 4000);

  const isRemote = Boolean(
    job.remote ||
    job.workPlace === 'remote' ||
    (typeof job.workplaceType === 'string' && job.workplaceType.toLowerCase().includes('remote')) ||
    (typeof job.workMode === 'string' && job.workMode.toLowerCase().includes('remote')) ||
    /remote/i.test(location) ||
    /remote/i.test(title)
  );

  const rawSalary = job.salary || job.salaryText || job.compensation || job.ctc || '';
  const salary = typeof rawSalary === 'string' ? rawSalary : (rawSalary?.amount ? String(rawSalary.amount) : '');

  const dateVal = job.postedAt || job.postedDate || job.publishedAt || job.date || job.createdDate;
  const postedAt = parseRelativeDate(dateVal);

  return {
    source: portal, // 'linkedin', 'naukri', or 'indeed'
    sourcePlatform: portal,
    provider: 'apify',
    externalId: String(externalId),
    title,
    company: typeof company === 'string' ? company : 'Unknown Company',
    location: typeof location === 'string' ? location : 'India',
    description,
    url,
    salary,
    remote: isRemote,
    jobType: job.contractType || job.employmentType || job.jobType || 'Full-time',
    postedAt,
    skills: Array.isArray(job.skills) ? job.skills : [],
    visaSponsorship: false,
  };
};

/**
 * Execute an Apify actor with a safety timeout and return its dataset items.
 * @param {string} actorId - Apify actor ID or name (e.g. 'apify/linkedin-jobs-scraper')
 * @param {object} input - Actor input configuration
 * @param {string} portal - 'linkedin' or 'naukri'
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<object[]>} Array of normalized job listings
 */
const runApifyActor = async (actorId, input, portal, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const client = getClient();
  if (!client) {
    logger.warn(`[Apify] APIFY_API_TOKEN not set — skipping ${portal} scrape`);
    return [];
  }

  logger.info(`[Apify] Starting actor "${actorId}" for ${portal}...`);

  let timer;
  try {
    const actorPromise = (async () => {
      const run = await client.actor(actorId).call(input, {
        waitSecs: Math.max(10, Math.floor(timeoutMs / 1000)),
      });

      if (!run || !run.defaultDatasetId) {
        logger.warn(`[Apify] Actor ${actorId} completed without defaultDatasetId`);
        return [];
      }

      const { items } = await client.dataset(run.defaultDatasetId).listItems({
        limit: input.limit || input.rows || input.maxJobs || 50,
      });

      return items || [];
    })();

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Apify actor execution timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const rawItems = await Promise.race([actorPromise, timeoutPromise]);
    const jobs = rawItems
      .map(item => normalizeApifyJob(item, portal))
      .filter(j => j.title && j.url);

    logger.info(`[Apify] ${portal}: found ${jobs.length} jobs via actor "${actorId}"`);
    return jobs;
  } catch (err) {
    logger.warn(`[Apify] Actor "${actorId}" failed for ${portal}: ${err.message}`);
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Scrape LinkedIn jobs using Apify (dottti/linkedin-jobs-scraper).
 * @param {string} searchTerm
 * @param {string} location
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const scrapeLinkedInApify = async (searchTerm = 'software developer', location = 'India', limit = 25) => {
  const actorId = process.env.APIFY_LINKEDIN_ACTOR || DEFAULT_LINKEDIN_ACTOR;
  const input = {
    searches: [
      {
        keywords: searchTerm,
        location: location || 'India',
      },
    ],
    maxResults: limit,
  };
  return runApifyActor(actorId, input, 'linkedin');
};

/**
 * Scrape Naukri jobs using Apify (curious_coder/naukri-job-scraper).
 * @param {string} searchTerm
 * @param {string} location
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const scrapeNaukriApify = async (searchTerm = 'software developer', location = 'India', limit = 25) => {
  const actorId = process.env.APIFY_NAUKRI_ACTOR || DEFAULT_NAUKRI_ACTOR;
  const locSlug = location && location.toLowerCase() !== 'remote'
    ? `-in-${encodeURIComponent(location.toLowerCase())}`
    : '-in-india';
  const cleanQuery = encodeURIComponent(searchTerm.toLowerCase().replace(/\s+/g, '-'));
  const searchUrl = `https://www.naukri.com/${cleanQuery}-jobs${locSlug}`;

  const input = {
    startUrls: [{ url: searchUrl }],
    limit,
    maxJobs: limit,
  };
  return runApifyActor(actorId, input, 'naukri');
};

/**
 * Scrape Indeed jobs using Apify (misceres/indeed-scraper).
 * @param {string} searchTerm
 * @param {string} location
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const scrapeIndeedApify = async (searchTerm = 'software developer', location = 'India', limit = 25) => {
  const actorId = process.env.APIFY_INDEED_ACTOR || DEFAULT_INDEED_ACTOR;
  const input = {
    position: searchTerm,
    location: location && location.toLowerCase() !== 'remote' ? location : 'India',
    country: (process.env.INDEED_COUNTRY || 'IN').toUpperCase(),
    maxItems: limit,
  };
  return runApifyActor(actorId, input, 'indeed');
};

module.exports = {
  scrapeLinkedInApify,
  scrapeNaukriApify,
  scrapeIndeedApify,
  normalizeApifyJob,
  runApifyActor,
};
