'use strict';

jest.mock('../../../../src/services/jobs/remotive.scraper');
jest.mock('../../../../src/services/jobs/himalayas.scraper');
jest.mock('../../../../src/services/jobs/adzuna.scraper');
jest.mock('../../../../src/services/jobs/arbeitnow.scraper');
jest.mock('../../../../src/services/jobs/jobicy.scraper');
jest.mock('../../../../src/models/JobListing');

const { scrapeRemotive }  = require('../../../../src/services/jobs/remotive.scraper');
const { scrapeHimalayas } = require('../../../../src/services/jobs/himalayas.scraper');
const { scrapeAdzuna }    = require('../../../../src/services/jobs/adzuna.scraper');
const { scrapeArbeitnow } = require('../../../../src/services/jobs/arbeitnow.scraper');
const { scrapeJobicy }    = require('../../../../src/services/jobs/jobicy.scraper');
const JobListing = require('../../../../src/models/JobListing');
const { aggregateJobs } = require('../../../../src/services/jobs/jobAggregator.service');

const rawJob = {
  title: 'Full Stack Engineer',
  company: 'Acme Inc',
  url: 'https://acme.greenhouse.io/jobs/1',
  description: 'A'.repeat(600) + ' React Node Docker AWS required experience responsibilities',
  source: 'remotive',
  externalId: 'ext-1',
  postedAt: new Date().toISOString(),
  salaryMin: 100000,
  salaryMax: 140000,
};

describe('jobAggregator.service — regression: jobListingId bug', () => {
  beforeEach(() => {
    scrapeRemotive.mockResolvedValue([rawJob]);
    scrapeHimalayas.mockResolvedValue([]);
    scrapeAdzuna.mockResolvedValue([]);
    scrapeArbeitnow.mockResolvedValue([]);
    scrapeJobicy.mockResolvedValue([]);

    JobListing.bulkWrite = jest.fn().mockResolvedValue({ upsertedCount: 1 });
    // Simulate the persisted document the DB would actually return —
    // this is the object that MUST come back with a real _id.
    JobListing.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: 'persisted-mongo-id-123', source: 'remotive', externalId: 'ext-1', title: rawJob.title, company: rawJob.company, url: rawJob.url },
      ]),
    });
  });

  test('returned jobs carry a real persisted _id (not undefined)', async () => {
    const { jobs } = await aggregateJobs({ jobTitles: ['full stack'] }, { plan: 'free' });
    expect(jobs.length).toBe(1);
    expect(jobs[0]._id).toBe('persisted-mongo-id-123');
    expect(jobs[0]._id).not.toBeUndefined();
  });

  test('re-attaches the full ghostScore object (not just the flattened number) on returned jobs', async () => {
    const { jobs } = await aggregateJobs({ jobTitles: ['full stack'] }, { plan: 'free' });
    expect(jobs[0].ghostScore).toEqual(
      expect.objectContaining({ realJobScore: expect.any(Number), verdict: expect.any(String) })
    );
  });

  test('calls JobListing.find using the natural key (source + externalId), not by ghost-filtered array index', async () => {
    await aggregateJobs({ jobTitles: ['full stack'] }, { plan: 'free' });
    expect(JobListing.find).toHaveBeenCalledWith({
      $or: [{ source: 'remotive', externalId: 'ext-1' }],
    });
  });

  test('gracefully skips a job if it somehow was not found in the persisted re-fetch (never crashes the pipeline)', async () => {
    JobListing.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    const { jobs } = await aggregateJobs({ jobTitles: ['full stack'] }, { plan: 'free' });
    expect(jobs).toEqual([]);
  });

  test('returns empty jobs array with zero stats when no scrapers find anything', async () => {
    scrapeRemotive.mockResolvedValue([]);
    const { jobs, stats } = await aggregateJobs({ jobTitles: ['full stack'] }, { plan: 'free' });
    expect(jobs).toEqual([]);
    expect(stats.raw).toBe(0);
    expect(JobListing.bulkWrite).not.toHaveBeenCalled();
  });

  describe('regression (Session 43): the no-jobTitles fallback no longer assumes every user is a developer', () => {
    test('a user with no jobTitles set gets a generic, category-neutral search term, not a tech-specific one', async () => {
      scrapeRemotive.mockResolvedValue([]);
      await aggregateJobs({}, { plan: 'free' }); // no jobTitles at all
      expect(scrapeRemotive).toHaveBeenCalledWith('professional', expect.anything());
      expect(scrapeRemotive).not.toHaveBeenCalledWith(expect.stringMatching(/developer/i), expect.anything());
    });

    test('an empty jobTitles array (not just undefined) triggers the same fallback', async () => {
      scrapeRemotive.mockResolvedValue([]);
      await aggregateJobs({ jobTitles: [] }, { plan: 'free' });
      expect(scrapeRemotive).toHaveBeenCalledWith('professional', expect.anything());
    });
  });
});
