/**
 * Adzuna job scraper.
 * Requires free API keys from developer.adzuna.com (250 req/day on free tier).
 */

const axios = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://api.adzuna.com/v1/api/jobs';
const TIMEOUT  = 15_000;

const normalize = (job, country) => ({
  source:      'adzuna',
  externalId:  job.id,
  title:       job.title,
  company:     job.company?.display_name || 'Unknown',
  description: (job.description || '').slice(0, 3000),
  url:         job.redirect_url,
  location:    job.location?.display_name || country || 'India',
  remote:      (job.title + ' ' + (job.description || '')).toLowerCase().includes('remote'),
  jobType:     'full-time',
  salaryMin:   job.salary_min || null,
  salaryMax:   job.salary_max || null,
  skills:      [],
  postedAt:    job.created ? new Date(job.created) : new Date(),
});

/**
 * Fetch jobs from Adzuna.
 * @param {string} searchTerm
 * @param {string} location
 * @returns {Promise<object[]>}
 */
const scrapeAdzuna = async (searchTerm = 'software developer', location = '') => {
  const appId  = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;
  const country = process.env.ADZUNA_COUNTRY || 'in';

  if (!appId || !apiKey) {
    logger.warn('Adzuna credentials not configured — skipping');
    return [];
  }

  logger.info(`Adzuna: searching for "${searchTerm}"…`);

  try {
    const { data } = await axios.get(`${BASE_URL}/${country}/search/1`, {
      params: {
        app_id:          appId,
        app_key:         apiKey,
        what:            searchTerm,
        where:           location || '',
        results_per_page:50,
        content_type:    'application/json',
      },
      timeout: TIMEOUT,
    });

    const jobs = (data.results || []).map((j) => normalize(j, country));
    logger.info(`Adzuna: found ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    logger.error(`Adzuna scraper failed: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeAdzuna };
