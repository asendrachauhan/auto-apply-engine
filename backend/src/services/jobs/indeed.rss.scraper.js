/**
 * Indeed RSS Scraper — LEGAL.
 *
 * Indeed provides official public RSS feeds for job searches.
 * Documented at: https://www.indeed.com/rss
 * This is explicitly allowed in their ToS for personal use.
 */

const axios  = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://www.indeed.com/rss';
const TIMEOUT  = 20_000;

/**
 * Parse Indeed RSS XML into structured job objects.
 */
const parseRSS = (xml, country = 'in') => {
  const jobs = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const extract = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    const title   = extract('title');
    const link    = extract('link') || extract('guid');
    const company = extract('source') || extract('author');
    const desc    = extract('description').replace(/<[^>]*>/g, ' ').slice(0, 3000);
    const pubDate = extract('pubDate');
    const location= (block.match(/<indeed:salary>(.*?)<\/indeed:salary>/i) || [])[1] || '';

    if (title && link) {
      jobs.push({
        source:      'indeed',
        externalId:  link.split('jk=')[1]?.split('&')[0] || `indeed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title,
        company:     company || 'Unknown',
        location:    location || 'India',
        description: desc,
        url:         link,
        salary:      '',
        remote:      desc.toLowerCase().includes('remote') || title.toLowerCase().includes('remote'),
        jobType:     'full-time',
        postedAt:    pubDate ? new Date(pubDate) : new Date(),
        skills:      [],
      });
    }
  }
  return jobs;
};

/**
 * Fetch Indeed RSS feed.
 * @param {string} searchTerm
 * @param {string} location
 * @param {string} country - country code (in, us, gb…)
 */
const scrapeIndeed = async (searchTerm = 'software developer', location = 'India', country = 'in') => {
  logger.info(`Indeed RSS: searching "${searchTerm}"`);

  try {
    const params = new URLSearchParams({
      q:       searchTerm,
      l:       location,
      sort:    'date',
      limit:   '25',
      fromage: '1',  // posted in last 1 day
    });

    const url = `${BASE_URL}?${params.toString()}`;
    const { data: xml } = await axios.get(url, {
      timeout: TIMEOUT,
      headers: { 'User-Agent': 'AutoApply RSS Reader/1.0 (+https://autoapply.ai)' },
    });

    const jobs = parseRSS(xml, country);
    logger.info(`Indeed: found ${jobs.length} jobs via RSS`);
    return jobs;
  } catch (err) {
    logger.warn(`Indeed RSS error: ${err.message}`);
    return [];
  }
};

module.exports = { scrapeIndeed };
