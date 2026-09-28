'use strict';

jest.mock('axios');
const axios = require('axios');
const SerpApiCache = require('../../../../src/models/SerpApiCache');
const { scrapeLinkedIn } = require('../../../../src/services/jobs/linkedin.scraper');

describe('linkedin.scraper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, SERPAPI_KEY: 'test-serp-key' };
    jest.spyOn(SerpApiCache, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(SerpApiCache, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('returns [] when SERPAPI_KEY is not set', async () => {
    delete process.env.SERPAPI_KEY;
    const jobs = await scrapeLinkedIn('software engineer', 'India');
    expect(jobs).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('returns cached jobs on cache hit without re-querying API', async () => {
    const cachedJobs = [
      {
        source: 'linkedin',
        sourcePlatform: 'linkedin',
        title: 'Backend Engineer',
        company: 'Stripe',
        url: 'https://linkedin.com/jobs/view/123',
      },
    ];

    SerpApiCache.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        jobs: cachedJobs,
        fetchedAt: new Date(),
      }),
    });

    const jobs = await scrapeLinkedIn('backend engineer', 'India');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Backend Engineer');
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('queries Google Jobs with LinkedIn keyword and maps direct URL', async () => {
    axios.get.mockResolvedValue({
      data: {
        jobs_results: [
          {
            job_id: 'li_abc_1',
            title: 'Senior Python Developer',
            company_name: 'Tech Corp',
            location: 'Bengaluru, Karnataka, India',
            description: 'Building microservices in Python.',
            via: 'LinkedIn',
            apply_options: [
              { title: 'LinkedIn', link: 'https://www.linkedin.com/jobs/view/999888' },
              { title: 'Indeed', link: 'https://indeed.com/viewjob?jk=123' },
            ],
            detected_extensions: {
              work_from_home: true,
              schedule_type: 'Full-time',
            },
          },
        ],
      },
    });

    const jobs = await scrapeLinkedIn('python developer', 'Bengaluru');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].source).toBe('linkedin');
    expect(jobs[0].sourcePlatform).toBe('linkedin');
    expect(jobs[0].platform).toBe('LinkedIn');
    expect(jobs[0].title).toBe('Senior Python Developer');
    expect(jobs[0].company).toBe('Tech Corp');
    expect(jobs[0].url).toBe('https://www.linkedin.com/jobs/view/999888');
    expect(jobs[0].remote).toBe(true);

    const callParams = axios.get.mock.calls[0][1].params;
    expect(callParams.engine).toBe('google_jobs');
    expect(callParams.q).toContain('LinkedIn');
  });

  test('fails soft and returns [] on API error', async () => {
    axios.get.mockRejectedValue(new Error('Network timeout'));
    const jobs = await scrapeLinkedIn('lead engineer', 'India');
    expect(jobs).toEqual([]);
  });
});
