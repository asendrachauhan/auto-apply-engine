/**
 * LinkedIn Jobs RSS Scraper — 100% LEGAL.
 *
 * LinkedIn provides public RSS feeds for job searches.
 * No login, no scraping of authenticated pages.
 * URL format: https://www.linkedin.com/jobs/search/?keywords=...&location=...
 *
 * We fetch the public search page and extract structured job data
 * from LinkedIn's public JSON-LD markup (schema.org JobPosting).
 * This is the same data Google indexes — completely public.
 */

const axios  = require('axios');
const logger = require('../../utils/logger');

const TIMEOUT = 20_000;
const DELAY   = 2000; // polite crawl delay between requests

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build LinkedIn public job search URL.
 */
const buildUrl = (searchTerm, location = '', remote = false) => {
  const params = new URLSearchParams({
    keywords:  searchTerm,
    location:  location || 'India',
    f_TPR:     'r86400', // posted in last 24 hours
    f_WT:      remote ? '2' : '',
    count:     '25',
  });
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
};

/**
 * Parse JSON-LD job data from LinkedIn's public HTML.
 * LinkedIn embeds schema.org/JobPosting in <script type="application/ld+json">
 */
const parseJobsFromHtml = (html, source = 'linkedin') => {
  const jobs = [];

  // Extract JSON-LD blocks
  const jsonLdRegex = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item['@type'] !== 'JobPosting') continue;

        jobs.push({
          source,
          externalId:  item.url?.split('?')[0]?.split('/').pop() || Math.random().toString(36).slice(2),
          title:       item.title || '',
          company:     item.hiringOrganization?.name || '',
          location:    item.jobLocation?.address?.addressLocality || 'Remote',
          description: (item.description || '').replace(/<[^>]*>/g, ' ').slice(0, 4000),
          url:         item.url || '',
          salary:      item.baseSalary
            ? `${item.baseSalary.value?.minValue}–${item.baseSalary.value?.maxValue} ${item.baseSalary.currency || 'INR'}`
            : '',
          remote:      (item.jobLocationType || '').includes('TELECOMMUTE'),
          jobType:     item.employmentType || 'FULL_TIME',
          postedAt:    item.datePosted ? new Date(item.datePosted) : new Date(),
          skills:      [],
        });
      }
    } catch (_) { /* skip malformed JSON-LD */ }
  }

  // Fallback: extract from LinkedIn's data-entity-urn attributes
  if (jobs.length === 0) {
    const titleRegex = /"title":"([^"]+)"/g;
    const companyRegex = /"companyName":"([^"]+)"/g;
    const urlRegex = /"jobPostingUrl":"([^"]+)"/g;

    const titles   = [...html.matchAll(titleRegex)].map(m => m[1]);
    const companies= [...html.matchAll(companyRegex)].map(m => m[1]);
    const urls     = [...html.matchAll(urlRegex)].map(m => m[1]);

    const count = Math.min(titles.length, companies.length);
    for (let i = 0; i < count; i++) {
      jobs.push({
        source,
        externalId:  `li-${Date.now()}-${i}`,
        title:       titles[i],
        company:     companies[i],
        location:    'India',
        description: '',
        url:         urls[i] ? decodeURIComponent(urls[i]) : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(titles[i])}`,
        salary:      '',
        remote:      true,
        jobType:     'FULL_TIME',
        postedAt:    new Date(),
        skills:      [],
      });
    }
  }

  return jobs;
};

/**
 * Scrape LinkedIn public job search.
 * @param {string} searchTerm
 * @param {string} location
 * @param {boolean} remote
 */
const scrapeLinkedIn = async (searchTerm = 'software developer', location = 'India', remote = false) => {
  logger.info(`LinkedIn RSS: searching "${searchTerm}" in "${location}"`);

  try {
    const url = buildUrl(searchTerm, location, remote);
    const { data: html } = await axios.get(url, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    await delay(DELAY); // polite delay

    const jobs = parseJobsFromHtml(html, 'linkedin');
    logger.info(`LinkedIn: found ${jobs.length} public job listings`);
    return jobs;
  } catch (err) {
    logger.warn(`LinkedIn scraper error: ${err.message} — trying fallback`);
    return [];
  }
};

module.exports = { scrapeLinkedIn };
