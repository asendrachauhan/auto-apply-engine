'use strict';
const axios  = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://www.arbeitnow.com/api/job-board-api';

const normalize = (job) => ({
  source: 'arbeitnow',
  externalId: String(job.slug || job.id || `${job.company_name}-${job.title}`.replace(/\s+/g,'-').toLowerCase()),
  title:    job.title || '',
  company:  job.company_name || '',
  description: (job.description || '').replace(/<[^>]*>/g,' ').trim().slice(0,3000),
  url:      job.url || '',
  location: job.location || 'Europe',
  remote:   Boolean(job.remote),
  jobType:  job.job_types?.[0] || 'full-time',
  salaryMin: null, salaryMax: null,
  skills:   (job.tags || []).filter(t => t.length > 1 && t.length < 40),
  postedAt:  job.created_at ? new Date(job.created_at * 1000) : new Date(),
  euMeta: {
    visaSponsorship: Boolean(job.visa_sponsorship),
    relocation:      Boolean(job.relocation),
    country: job.location?.includes('Germany') ? 'DE' : job.location?.includes('Netherlands') ? 'NL' : 'EU',
  },
});

const scrapeArbeitnow = async ({ search = 'software developer', visaOnly = false, remoteOnly = false, maxPages = 2 } = {}) => {
  logger.info(`Arbeitnow: searching "${search}"…`);
  const allJobs = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const params = { page };
      if (search)     params.search = search;
      if (visaOnly)   params.visa   = 1;
      if (remoteOnly) params.remote = 1;
      const { data } = await axios.get(BASE_URL, { params, timeout: 15000 });
      const jobs = (data.data || []).map(normalize);
      allJobs.push(...jobs);
      if (jobs.length < 25) break;
    } catch (err) { logger.error(`Arbeitnow page ${page} failed: ${err.message}`); break; }
  }
  logger.info(`Arbeitnow: ${allJobs.length} jobs`);
  return allJobs;
};

module.exports = { scrapeArbeitnow };
