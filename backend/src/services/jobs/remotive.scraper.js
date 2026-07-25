/**
 * Remotive job scraper.
 * Remotive is a free public API — no key required.
 * https://remotive.com/api/remote-jobs
 */

const axios = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://remotive.com/api/remote-jobs';
const TIMEOUT  = 15_000;

/**
 * Normalize a Remotive job to our standard shape.
 * @param {object} job
 * @returns {object}
 */
const normalize = (job) => ({
  source:      'remotive',
  externalId:  String(job.id),
  title:       job.title,
  company:     job.company_name,
  description: job.description?.replace(/<[^>]*>/g, ' ').slice(0, 3000) || '',
  url:         job.url,
  location:    job.candidate_required_location || 'Remote',
  remote:      true,
  jobType:     job.job_type || 'full-time',
  salaryMin:   null,
  salaryMax:   null,
  skills:      job.tags || [],
  postedAt:    job.publication_date ? new Date(job.publication_date) : new Date(),
});

/**
 * Fetch jobs from Remotive matching a search term.
 * @param {string} searchTerm
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const scrapeRemotive = async (searchTerm = 'software developer', limit = 50) => {
  logger.info(`Remotive: searching for "${searchTerm}"…`);

  try {
    const { data } = await axios.get(BASE_URL, {
      params: { search: searchTerm, limit },
      timeout: TIMEOUT,
    });

    const jobs = (data.jobs || []).map(normalize);
    logger.info(`Remotive: found ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    logger.error(`Remotive scraper failed: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeRemotive };
