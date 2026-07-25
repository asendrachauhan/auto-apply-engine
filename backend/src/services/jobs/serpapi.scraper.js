/**
 * SerpAPI — Google Jobs aggregator.
 *
 * Google Jobs aggregates LinkedIn, Indeed, Naukri, Glassdoor, and 100+ boards.
 * Accessing via SerpAPI is 100% legal — we're using a paid search API.
 * Free tier: 100 searches/month.
 * https://serpapi.com/google-jobs-api
 *
 * This is the BEST source because:
 * - Legal — official search API
 * - Aggregates all major platforms
 * - Structured JSON response
 * - Real-time (within hours of posting)
 */

const axios  = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://serpapi.com/search';
const TIMEOUT  = 20_000;

const normalize = (job, searchTerm) => ({
  source:      'google-jobs',
  externalId:  job.job_id || `gj-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title:       job.title || '',
  company:     job.company_name || '',
  location:    job.location || 'Remote',
  description: (job.description || '').slice(0, 4000),
  url:         job.related_links?.[0]?.link || job.share_link || '',
  salary:      job.detected_extensions?.salary || '',
  remote:      (job.detected_extensions?.work_from_home) || false,
  jobType:     job.detected_extensions?.schedule_type || 'Full-time',
  skills:      [],
  postedAt:    job.detected_extensions?.posted_at
    ? new Date(job.detected_extensions.posted_at)
    : new Date(),
  // Keep original platform info
  platform:    job.via || 'Google Jobs',
  applyLinks:  job.apply_options?.map(o => ({ platform: o.title, url: o.link })) || [],
});

/**
 * Search Google Jobs via SerpAPI.
 * Returns jobs aggregated from all major platforms.
 * @param {string} searchTerm
 * @param {string} location
 */
const scrapeGoogleJobs = async (searchTerm = 'software developer', location = 'India') => {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    logger.warn('SERPAPI_KEY not set — skipping Google Jobs');
    return [];
  }

  logger.info(`SerpAPI: searching Google Jobs for "${searchTerm}" in "${location}"`);

  try {
    const { data } = await axios.get(BASE_URL, {
      timeout: TIMEOUT,
      params: {
        api_key:  apiKey,
        engine:   'google_jobs',
        q:        searchTerm,
        location: location,
        hl:       'en',
        chips:    'date_posted:today', // only today's jobs
      },
    });

    const jobs = (data.jobs_results || []).map(j => normalize(j, searchTerm));
    logger.info(`SerpAPI: found ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    logger.warn(`SerpAPI error: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeGoogleJobs };
