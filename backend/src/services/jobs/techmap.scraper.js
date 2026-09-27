'use strict';

/**
 * Techmap Job Postings API — real paid provider, via RapidAPI.
 *
 * Session 39 (2026-08-22): replaces the previous linkedin.rss.scraper.js
 * and naukri.rss.scraper.js, both flagged in Sessions 35-37 for real legal
 * and technical risk (Googlebot User-Agent spoofing to bypass LinkedIn's
 * bot detection; an undocumented Naukri internal API requiring a signed
 * token neither scraper sent). Asendra's decision: replace both with a
 * real paid provider, and gate LinkedIn/Naukri coverage to paid plans only
 * (see plans.config.js — 'linkedin'/'naukri' are in starter/pro/elite's
 * `sources` list, not free's).
 *
 * Techmap GmbH (techmap.io / jobdatafeeds.com) is a German job-data
 * aggregation company operating since 2020, covering 140+ countries across
 * LinkedIn, Indeed, Naukri, Glassdoor, and more through ONE unified,
 * documented endpoint — selected via the `portal` query parameter. This is
 * a materially different position than the scrapers it replaces: we're
 * consuming a commercial vendor's documented API contract, not directly
 * impersonating a crawler identity or reverse-engineering an internal one.
 *
 * SETUP: subscribe to "Job Postings API" by Techmap on RapidAPI
 * (rapidapi.com/techmap-io-techmap-io-default/api/daily-international-job-postings)
 * and set TECHMAP_RAPIDAPI_KEY. Free BASIC tier: 100 requests/month, up to
 * 1,000 job postings/month (10 per request).
 *
 * ⚠️ VERIFY BEFORE RELYING ON THIS IN PRODUCTION: this implementation is
 * built from Techmap's public documentation pages (jobdatafeeds.com), not
 * a live authenticated call — no network access in this sandbox to
 * confirm the exact request/response contract end-to-end. Two things
 * specifically to double-check against the actual RapidAPI dashboard once
 * subscribed (RapidAPI auto-generates a code snippet with your exact
 * key/headers, which is the authoritative source over anything below):
 *   1. Auth headers — this sends both `X-RapidAPI-Key`/`X-RapidAPI-Host`
 *      (the universal RapidAPI marketplace convention) AND an
 *      `Authorization: Bearer` header (per Techmap's own doc example) to
 *      cover either contract; confirm which one your subscription
 *      actually needs and drop the other if only one works.
 *   2. Keyword/title filtering — Techmap's docs confirm `portal`,
 *      `dateCreated`, `countryCode`, `city`, `hasSalary`, `workPlace`, and
 *      `timezone` as query params, but did NOT show a job-title/keyword
 *      search parameter in the pages this was built from (their full
 *      Swagger docs at api.techmap.io/jobs-api require a live account to
 *      browse). To stay safe, this fetches by portal+country and filters
 *      by title match CLIENT-SIDE rather than guessing at a param name
 *      that might not exist or might be spelled differently.
 */

const axios  = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = 'https://daily-international-job-postings.p.rapidapi.com/api/v2/jobs/search';
const RAPIDAPI_HOST = 'daily-international-job-postings.p.rapidapi.com';
const TIMEOUT = 20_000;

// Techmap's own docs note Naukri/LinkedIn postings surfaced through their
// system skew toward a handful of countries — 'in' covers India for
// Naukri; LinkedIn coverage is global so no country filter is applied for
// it, keeping results broader for that portal.
const COUNTRY_MAP = { naukri: 'in' };

const normalize = (job, portal) => ({
  source:      portal, // 'linkedin' or 'naukri' — matches the source values used before this replacement
  sourcePlatform: portal, // consistent with the sourcePlatform tagging added in Session 36 for Google Jobs
  externalId:  job.id || job.jobId || `${portal}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title:       job.title || job.job_title || '',
  company:     job.company?.name || job.companyName || job.company || 'Unknown',
  location:    job.location?.city || job.city || job.location || 'India',
  description: (job.description || job.text || '').slice(0, 4000),
  url:         job.url || job.jobUrl || '',
  salary:      job.salary?.amount ? String(job.salary.amount) : '',
  remote:      job.workPlace === 'remote' || (job.title || '').toLowerCase().includes('remote'),
  jobType:     job.contractType || job.employmentType || 'full-time',
  postedAt:    job.dateCreated ? new Date(job.dateCreated) : new Date(),
  skills:      [],
});

/**
 * Fetch and title-filter job postings for one portal ('linkedin' or 'naukri').
 * Fails soft — returns [] on any error, same convention as every other
 * scraper in this codebase, so one provider hiccup never breaks the whole
 * discovery pipeline.
 */
const scrapeTechmapPortal = async (portal, searchTerm, location) => {
  const apiKey = process.env.TECHMAP_RAPIDAPI_KEY;
  if (!apiKey) {
    logger.warn(`Techmap (${portal}): TECHMAP_RAPIDAPI_KEY not set — skipping`);
    return [];
  }

  try {
    const params = { portal };
    if (COUNTRY_MAP[portal]) params.countryCode = COUNTRY_MAP[portal];

    const { data } = await axios.get(BASE_URL, {
      timeout: TIMEOUT,
      params,
      headers: {
        'X-RapidAPI-Key':  apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'Authorization':   `Bearer ${apiKey}`,
      },
    });

    const rawJobs = data.jobs || data.results || data.data || [];
    const term = (searchTerm || '').toLowerCase().trim();
    const filtered = term
      ? rawJobs.filter(j => (j.title || j.job_title || '').toLowerCase().includes(term))
      : rawJobs;

    const jobs = filtered.map(j => normalize(j, portal));
    logger.info(`Techmap (${portal}): ${jobs.length} jobs matching "${searchTerm}" (${rawJobs.length} fetched before title filter)`);
    return jobs;
  } catch (err) {
    logger.warn(`Techmap (${portal}) error: ${err.message}`);
    return [];
  }
};

// Same function names/signatures as the scrapers this replaces, so
// jobDiscovery.service.js only needed a one-line import change.
const scrapeLinkedIn = (searchTerm, location) => scrapeTechmapPortal('linkedin', searchTerm, location);
const scrapeNaukri   = (searchTerm, location) => scrapeTechmapPortal('naukri', searchTerm, location);

module.exports = { scrapeLinkedIn, scrapeNaukri, scrapeTechmapPortal };
