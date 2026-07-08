/**
 * Himalayas job scraper.
 * Free public API — no key required.
 * https://himalayas.app/jobs/api
 */

const axios = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://himalayas.app/jobs/api';
const TIMEOUT  = 15_000;

const normalize = (job) => ({
  source:      'himalayas',
  externalId:  job.id || `${job.company}-${job.title}`.replace(/\s+/g, '-').toLowerCase(),
  title:       job.title,
  company:     job.companyName || job.company,
  description: (job.description || '').replace(/<[^>]*>/g, ' ').slice(0, 3000),
  url:         job.applicationLink || job.url || '',
  location:    job.location || 'Remote',
  remote:      true,
  jobType:     job.jobType || 'full-time',
  salaryMin:   job.salaryMin || null,
  salaryMax:   job.salaryMax || null,
  skills:      job.requiredSkills || [],
  postedAt:    job.createdAt ? new Date(job.createdAt) : new Date(),
});

/**
 * Fetch jobs from Himalayas.
 * @param {string} searchTerm
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const scrapeHimalayas = async (searchTerm = 'software developer', limit = 50) => {
  logger.info(`Himalayas: searching for "${searchTerm}"…`);

  try {
    const { data } = await axios.get(BASE_URL, {
      params: { q: searchTerm, limit },
      timeout: TIMEOUT,
    });

    const jobs = (data.jobs || []).map(normalize);
    logger.info(`Himalayas: found ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    logger.error(`Himalayas scraper failed: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeHimalayas };
