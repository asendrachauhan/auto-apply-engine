'use strict';

const mockCall = jest.fn();
const mockListItems = jest.fn();

jest.mock('apify-client', () => {
  return {
    ApifyClient: jest.fn().mockImplementation(() => ({
      actor: jest.fn().mockReturnValue({
        call: mockCall,
      }),
      dataset: jest.fn().mockReturnValue({
        listItems: mockListItems,
      }),
    })),
  };
});

const {
  scrapeLinkedInApify,
  scrapeNaukriApify,
  scrapeIndeedApify,
  normalizeApifyJob,
  runApifyActor,
} = require('../../../../src/services/jobs/apify.scraper');

const mockApifyJob = (overrides = {}) => ({
  id: 'job-12345',
  title: 'Senior Node.js Developer',
  company: 'TechCorp India',
  location: 'Bengaluru, Karnataka',
  description: 'Looking for a skilled backend engineer with Node.js & Mongo.',
  url: 'https://linkedin.com/jobs/view/12345',
  salary: '₹25,00,000 - ₹35,00,000',
  postedAt: '2026-09-20T10:00:00Z',
  workplaceType: 'Hybrid',
  ...overrides,
});

describe('apify.scraper — Managed Cloud Job Scraping for LinkedIn and Naukri', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      APIFY_API_TOKEN: 'apify_test_token_123',
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('Configuration & Fail-Soft Guard', () => {
    test('returns [] without calling Apify when APIFY_API_TOKEN is unset', async () => {
      delete process.env.APIFY_API_TOKEN;

      const results = await scrapeLinkedInApify('frontend engineer', 'India');
      expect(results).toEqual([]);
      expect(mockCall).not.toHaveBeenCalled();
    });

    test('fails soft and returns [] when actor call rejects with an error', async () => {
      mockCall.mockRejectedValueOnce(new Error('Network timeout or actor error'));

      const results = await scrapeLinkedInApify('data scientist', 'Delhi');
      expect(results).toEqual([]);
    });

    test('fails soft when actor run returns no defaultDatasetId', async () => {
      mockCall.mockResolvedValueOnce({ defaultDatasetId: null });

      const results = await scrapeNaukriApify('react developer', 'Pune');
      expect(results).toEqual([]);
      expect(mockListItems).not.toHaveBeenCalled();
    });
  });

  describe('scrapeLinkedInApify', () => {
    test('calls the default or configured LinkedIn actor with formatted input', async () => {
      mockCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-linkedin-1' });
      mockListItems.mockResolvedValueOnce({ items: [mockApifyJob()] });

      const jobs = await scrapeLinkedInApify('backend engineer', 'Bengaluru', 20);

      expect(mockCall).toHaveBeenCalledWith(
        expect.objectContaining({
          searches: [
            expect.objectContaining({
              keywords: 'backend engineer',
              location: 'Bengaluru',
            }),
          ],
          maxResults: 20,
        }),
        expect.objectContaining({ waitSecs: expect.any(Number) })
      );
      expect(jobs).toHaveLength(1);
      expect(jobs[0].source).toBe('linkedin');
      expect(jobs[0].sourcePlatform).toBe('linkedin');
      expect(jobs[0].provider).toBe('apify');
      expect(jobs[0].title).toBe('Senior Node.js Developer');
    });

    test('respects custom APIFY_LINKEDIN_ACTOR env variable', async () => {
      process.env.APIFY_LINKEDIN_ACTOR = 'custom-user/custom-linkedin-scraper';
      mockCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-custom' });
      mockListItems.mockResolvedValueOnce({ items: [mockApifyJob()] });

      const jobs = await scrapeLinkedInApify('devops engineer', 'Remote');
      expect(jobs).toHaveLength(1);
    });
  });

  describe('scrapeNaukriApify', () => {
    test('calls the default Naukri actor with keyword and location', async () => {
      mockCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-naukri-1' });
      mockListItems.mockResolvedValueOnce({
        items: [
          mockApifyJob({
            id: 'nk-999',
            title: 'Full Stack Engineer',
            company: 'Naukri Recruiter Co',
            jobLocation: 'Mumbai',
            jobUrl: 'https://naukri.com/job/999',
          }),
        ],
      });

      const jobs = await scrapeNaukriApify('full stack engineer', 'Mumbai', 15);

      expect(mockCall).toHaveBeenCalledWith(
        expect.objectContaining({
          startUrls: [
            expect.objectContaining({
              url: expect.stringContaining('naukri.com'),
            }),
          ],
          maxJobs: 15,
        }),
        expect.any(Object)
      );
      expect(jobs).toHaveLength(1);
      expect(jobs[0].source).toBe('naukri');
      expect(jobs[0].sourcePlatform).toBe('naukri');
      expect(jobs[0].provider).toBe('apify');
      expect(jobs[0].title).toBe('Full Stack Engineer');
      expect(jobs[0].company).toBe('Naukri Recruiter Co');
    });
  });

  describe('scrapeIndeedApify', () => {
    test('calls the default Indeed actor with position, location, and country', async () => {
      mockCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-indeed-1' });
      mockListItems.mockResolvedValueOnce({
        items: [
          mockApifyJob({
            id: 'ind-123',
            title: 'Frontend Engineer',
            company: 'Indeed Tech Corp',
            location: 'Gurugram',
            externalApplyLink: 'https://in.indeed.com/viewjob?jk=123',
          }),
        ],
      });

      const jobs = await scrapeIndeedApify('frontend engineer', 'Gurugram', 10);

      expect(mockCall).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 'frontend engineer',
          location: 'Gurugram',
          country: 'IN',
          maxItems: 10,
        }),
        expect.any(Object)
      );
      expect(jobs).toHaveLength(1);
      expect(jobs[0].source).toBe('indeed');
      expect(jobs[0].sourcePlatform).toBe('indeed');
      expect(jobs[0].provider).toBe('apify');
      expect(jobs[0].title).toBe('Frontend Engineer');
      expect(jobs[0].company).toBe('Indeed Tech Corp');
    });
  });

  describe('normalizeApifyJob', () => {
    test('correctly normalizes fields and detects remote workplace', () => {
      const normalized = normalizeApifyJob(
        {
          id: 'test-101',
          title: 'Remote React Developer',
          companyName: 'Distributed Labs',
          location: 'Remote, India',
          description: 'Fully remote frontend role.',
          link: 'https://example.com/apply/101',
          workplaceType: 'Remote',
          skills: ['React', 'TypeScript', 'Redux'],
          postedDate: '2026-09-18T12:00:00Z',
        },
        'linkedin'
      );

      expect(normalized.source).toBe('linkedin');
      expect(normalized.sourcePlatform).toBe('linkedin');
      expect(normalized.provider).toBe('apify');
      expect(normalized.title).toBe('Remote React Developer');
      expect(normalized.company).toBe('Distributed Labs');
      expect(normalized.remote).toBe(true);
      expect(normalized.skills).toEqual(['React', 'TypeScript', 'Redux']);
      expect(normalized.externalId).toBe('test-101');
      expect(normalized.url).toBe('https://example.com/apply/101');
    });

    test('generates externalId from url if id is missing', () => {
      const normalized = normalizeApifyJob(
        {
          title: 'UI Engineer',
          url: 'https://example.com/jobs/special-job-url-7788',
        },
        'naukri'
      );

      expect(normalized.externalId).toBeTruthy();
      expect(normalized.externalId).toContain('7788');
    });

    test('filters out items without title or url during actor execution', async () => {
      mockCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-mixed' });
      mockListItems.mockResolvedValueOnce({
        items: [
          { title: 'Valid Job', url: 'https://example.com/valid' },
          { title: '', url: 'https://example.com/missing-title' },
          { title: 'No URL Job', url: '' },
        ],
      });

      const jobs = await scrapeLinkedInApify('python', 'India');
      expect(jobs).toHaveLength(1);
      expect(jobs[0].title).toBe('Valid Job');
    });
  });
});
