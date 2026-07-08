/**
 * Naukri Public Scraper — LEGAL (public search pages only).
 *
 * Fetches Naukri's public job search results using their
 * public-facing JSON API endpoint used by their own frontend.
 * No login required. Same data shown to anonymous visitors.
 *
 * Legal basis: Reading publicly available job postings,
 * same as a person browsing the site. No account data accessed.
 */

const axios  = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://www.naukri.com/jobapi/v3/search';
const TIMEOUT  = 20_000;

const normalize = (job) => ({
  source:      'naukri',
  externalId:  job.jobId || String(job.id) || `nk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title:       job.title || job.designation || '',
  company:     job.companyName || '',
  location:    (job.placeholders?.find(p => p.type === 'location')?.label) || job.location || 'India',
  description: (job.jobDescription || '').replace(/<[^>]*>/g, ' ').slice(0, 3000),
  url:         job.jdURL || `https://www.naukri.com${job.jobUrl || ''}`,
  salary:      job.placeholders?.find(p => p.type === 'salary')?.label || '',
  remote:      (job.workMode || '').toLowerCase().includes('remote'),
  jobType:     job.employmentType || 'full-time',
  skills:      job.tagsAndSkills?.split(',').map(s => s.trim()).filter(Boolean) || [],
  postedAt:    job.createdDate ? new Date(job.createdDate) : new Date(),
});

/**
 * Search Naukri public API.
 * @param {string} searchTerm
 * @param {string} location
 */
const scrapeNaukri = async (searchTerm = 'software developer', location = '') => {
  logger.info(`Naukri: searching "${searchTerm}"`);

  try {
    const params = new URLSearchParams({
      noOfResults: '25',
      urlType:     'search_by_keyword',
      searchType:  'adv',
      keyword:     searchTerm,
      location:    location || '',
      pageNo:      '1',
      sort:        'r',
      k:           searchTerm,
      l:           location || '',
    });

    const { data } = await axios.get(`${BASE_URL}?${params.toString()}`, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent':  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':      'application/json',
        'Referer':     'https://www.naukri.com/',
        'appid':       '109',
        'systemid':    'Naukri',
      },
    });

    const jobs = (data?.jobDetails || data?.results || []).map(normalize);
    logger.info(`Naukri: found ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    logger.warn(`Naukri scraper error: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeNaukri };
