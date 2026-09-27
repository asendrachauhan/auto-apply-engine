'use strict';
const axios = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://jobicy.com/api/v2/remote-jobs';
const TIMEOUT  = 12_000;

const normalize = (job) => ({
  source:      'jobicy',
  externalId:  String(job.id || job.url),
  title:       job.jobTitle || '',
  company:     job.companyName || '',
  description: (job.jobDescription || '').replace(/<[^>]*>/g, ' ').slice(0, 3000),
  url:         job.url || '',
  location:    job.jobGeo || 'Remote',
  remote:      true,
  jobType:     job.jobType?.[0] || 'full-time',
  salaryMin:   job.annualSalaryMin ? Number(job.annualSalaryMin) : null,
  salaryMax:   job.annualSalaryMax ? Number(job.annualSalaryMax) : null,
  skills:      (job.jobIndustry || []).concat(job.jobLevel ? [job.jobLevel] : []),
  postedAt:    job.pubDate ? new Date(job.pubDate) : new Date(),
});

const scrapeJobicy = async (searchTerm = 'dev', count = 30) => {
  logger.info(`Jobicy: searching for remote jobs "${searchTerm}"…`);
  try {
    const { data } = await axios.get(BASE_URL, {
      params: { count, tag: searchTerm.toLowerCase().includes('stack') ? 'dev' : searchTerm },
      timeout: TIMEOUT,
    });
    const jobs = (data?.jobs || []).map(normalize);
    logger.info(`Jobicy: found ${jobs.length} remote jobs`);
    return jobs;
  } catch (err) {
    logger.warn(`Jobicy scraper soft fail: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeJobicy };
