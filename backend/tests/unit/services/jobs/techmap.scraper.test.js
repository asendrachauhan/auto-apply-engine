'use strict';
jest.mock('axios');
const axios = require('axios');
const { scrapeLinkedIn, scrapeNaukri, scrapeTechmapPortal } = require('../../../../src/services/jobs/techmap.scraper');

const rawJob = (overrides = {}) => ({
  id: 'tm1',
  title: 'Backend Engineer',
  company: { name: 'Acme Inc' },
  location: { city: 'Bengaluru' },
  description: 'Build things',
  url: 'https://example.com/job/tm1',
  workPlace: 'onsite',
  contractType: 'full-time',
  dateCreated: '2026-08-20T10:00:00Z',
  ...overrides,
});

describe('techmap.scraper — Session 39: real paid provider replacing the flagged direct scrapers', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, TECHMAP_RAPIDAPI_KEY: 'test-key' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  test('returns [] without calling the API when TECHMAP_RAPIDAPI_KEY is unset', async () => {
    process.env.TECHMAP_RAPIDAPI_KEY = '';
    const jobs = await scrapeLinkedIn('backend engineer', 'India');
    expect(jobs).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('scrapeLinkedIn sends portal=linkedin and no countryCode (global coverage)', async () => {
    axios.get.mockResolvedValue({ data: { jobs: [rawJob()] } });
    await scrapeLinkedIn('backend engineer', 'India');
    const [url, config] = axios.get.mock.calls[0];
    expect(url).toContain('daily-international-job-postings.p.rapidapi.com');
    expect(config.params.portal).toBe('linkedin');
    expect(config.params.countryCode).toBeUndefined();
  });

  test('scrapeNaukri sends portal=naukri WITH countryCode=in', async () => {
    axios.get.mockResolvedValue({ data: { jobs: [rawJob()] } });
    await scrapeNaukri('backend engineer', 'India');
    const config = axios.get.mock.calls[0][1];
    expect(config.params.portal).toBe('naukri');
    expect(config.params.countryCode).toBe('in');
  });

  test('sends both RapidAPI-standard headers and the Bearer header, to cover either auth contract', async () => {
    axios.get.mockResolvedValue({ data: { jobs: [rawJob()] } });
    await scrapeLinkedIn('backend engineer', 'India');
    const config = axios.get.mock.calls[0][1];
    expect(config.headers['X-RapidAPI-Key']).toBe('test-key');
    expect(config.headers['X-RapidAPI-Host']).toBe('daily-international-job-postings.p.rapidapi.com');
    expect(config.headers['Authorization']).toBe('Bearer test-key');
  });

  test('filters results by title client-side (no confirmed keyword param from the provider)', async () => {
    axios.get.mockResolvedValue({
      data: { jobs: [rawJob({ title: 'Backend Engineer' }), rawJob({ id: 'tm2', title: 'Sales Manager' })] },
    });
    const jobs = await scrapeLinkedIn('backend engineer', 'India');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Backend Engineer');
  });

  test('title filter is case-insensitive', async () => {
    axios.get.mockResolvedValue({ data: { jobs: [rawJob({ title: 'BACKEND ENGINEER' })] } });
    const jobs = await scrapeLinkedIn('backend engineer', 'India');
    expect(jobs).toHaveLength(1);
  });

  test('no search term returns all fetched jobs unfiltered', async () => {
    axios.get.mockResolvedValue({
      data: { jobs: [rawJob({ title: 'Backend Engineer' }), rawJob({ id: 'tm2', title: 'Sales Manager' })] },
    });
    const jobs = await scrapeLinkedIn('', 'India');
    expect(jobs).toHaveLength(2);
  });

  test('normalizes fields correctly, tags source and sourcePlatform to the portal', async () => {
    axios.get.mockResolvedValue({ data: { jobs: [rawJob()] } });
    const jobs = await scrapeLinkedIn('backend engineer', 'India');
    expect(jobs[0]).toEqual(expect.objectContaining({
      source: 'linkedin',
      sourcePlatform: 'linkedin',
      title: 'Backend Engineer',
      company: 'Acme Inc',
      location: 'Bengaluru',
      url: 'https://example.com/job/tm1',
      remote: false,
      jobType: 'full-time',
    }));
  });

  test('detects remote from workPlace field', async () => {
    axios.get.mockResolvedValue({ data: { jobs: [rawJob({ workPlace: 'remote' })] } });
    const jobs = await scrapeLinkedIn('backend engineer', 'India');
    expect(jobs[0].remote).toBe(true);
  });

  test('handles an alternate response shape (results key instead of jobs)', async () => {
    axios.get.mockResolvedValue({ data: { results: [rawJob()] } });
    const jobs = await scrapeLinkedIn('backend engineer', 'India');
    expect(jobs).toHaveLength(1);
  });

  test('fails soft on a network/API error — returns [], never throws', async () => {
    axios.get.mockRejectedValue(new Error('timeout'));
    const jobs = await scrapeNaukri('backend engineer', 'India');
    expect(jobs).toEqual([]);
  });

  test('missing description/company/url fields do not throw — normalized with safe fallbacks', async () => {
    axios.get.mockResolvedValue({ data: { jobs: [{ id: 'tm3', title: 'QA Engineer' }] } });
    const jobs = await scrapeLinkedIn('qa', 'India');
    expect(jobs[0].company).toBe('Unknown');
    expect(jobs[0].description).toBe('');
    expect(jobs[0].url).toBe('');
  });
});
