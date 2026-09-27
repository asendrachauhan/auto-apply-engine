'use strict';
jest.mock('axios');
jest.mock('../../../../src/models/SerpApiCache');

const axios = require('axios');
const SerpApiCache = require('../../../../src/models/SerpApiCache');
const { scrapeGoogleJobs } = require('../../../../src/services/jobs/serpapi.scraper');

const rawResult = (overrides = {}) => ({
  job_id: 'gj1',
  title: 'Backend Engineer',
  company_name: 'Acme',
  location: 'Bengaluru, India',
  description: 'Build things',
  via: 'via LinkedIn',
  detected_extensions: { posted_at: '2026-08-20' },
  ...overrides,
});

describe('serpapi.scraper — Session 36: caching (fixes real quota-exhaustion bug)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, SERPAPI_KEY: 'test-key' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  test('returns [] without calling the API when SERPAPI_KEY is unset', async () => {
    process.env.SERPAPI_KEY = '';
    const jobs = await scrapeGoogleJobs('engineer', 'India');
    expect(jobs).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('cache miss: hits the real API, then writes the result to cache', async () => {
    SerpApiCache.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    SerpApiCache.findOneAndUpdate = jest.fn().mockResolvedValue({});
    axios.get.mockResolvedValue({ data: { jobs_results: [rawResult()] } });

    const jobs = await scrapeGoogleJobs('backend engineer', 'India');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveLength(1);
    expect(SerpApiCache.findOneAndUpdate).toHaveBeenCalledWith(
      { cacheKey: 'backend engineer::india' },
      expect.objectContaining({ cacheKey: 'backend engineer::india' }),
      { upsert: true }
    );
  });

  test('cache hit (fresh): serves cached jobs, does NOT call the real API — this is the actual quota fix', async () => {
    SerpApiCache.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        cacheKey: 'backend engineer::india',
        jobs: [{ title: 'Cached Job', source: 'google-jobs' }],
        fetchedAt: new Date(), // just now — well within default 30 min TTL
      }),
    });

    const jobs = await scrapeGoogleJobs('backend engineer', 'India');

    expect(axios.get).not.toHaveBeenCalled();
    expect(jobs).toEqual([{ title: 'Cached Job', source: 'google-jobs' }]);
  });

  test('cache hit (stale, past TTL): falls through and calls the real API again', async () => {
    process.env.SERPAPI_CACHE_TTL_SECONDS = '60'; // 1 minute TTL for this test
    SerpApiCache.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        cacheKey: 'backend engineer::india',
        jobs: [{ title: 'Stale Job' }],
        fetchedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min old, TTL is 1 min
      }),
    });
    SerpApiCache.findOneAndUpdate = jest.fn().mockResolvedValue({});
    axios.get.mockResolvedValue({ data: { jobs_results: [rawResult()] } });

    const jobs = await scrapeGoogleJobs('backend engineer', 'India');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(jobs[0].title).toBe('Backend Engineer'); // fresh result, not the stale cached one
  });

  test('a cache read failure falls through to the real API rather than throwing', async () => {
    SerpApiCache.findOne.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('mongo down')) });
    SerpApiCache.findOneAndUpdate = jest.fn().mockResolvedValue({});
    axios.get.mockResolvedValue({ data: { jobs_results: [rawResult()] } });

    const jobs = await scrapeGoogleJobs('backend engineer', 'India');
    expect(jobs).toHaveLength(1);
  });

  test('a cache write failure does not fail the search — still returns the fetched jobs', async () => {
    SerpApiCache.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    SerpApiCache.findOneAndUpdate = jest.fn().mockRejectedValue(new Error('mongo down'));
    axios.get.mockResolvedValue({ data: { jobs_results: [rawResult()] } });

    const jobs = await scrapeGoogleJobs('backend engineer', 'India');
    expect(jobs).toHaveLength(1);
  });

  test('a real API error fails soft — returns []', async () => {
    SerpApiCache.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    axios.get.mockRejectedValue(new Error('timeout'));

    const jobs = await scrapeGoogleJobs('backend engineer', 'India');
    expect(jobs).toEqual([]);
  });
});

describe('serpapi.scraper — sourcePlatform detection (Session 36: LinkedIn/Naukri coverage via Google Jobs)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SERPAPI_KEY = 'test-key';
    SerpApiCache.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    SerpApiCache.findOneAndUpdate = jest.fn().mockResolvedValue({});
  });

  test.each([
    ['via LinkedIn', 'linkedin'],
    ['via Naukri.com', 'naukri'],
    ['via Indeed', 'indeed'],
    ['via Glassdoor', 'glassdoor'],
    ['via SomeOtherBoard', 'other'],
  ])('tags a job with via="%s" as sourcePlatform="%s"', async (via, expected) => {
    axios.get.mockResolvedValue({ data: { jobs_results: [rawResult({ via })] } });
    const jobs = await scrapeGoogleJobs('engineer', 'India');
    expect(jobs[0].sourcePlatform).toBe(expected);
  });
});
