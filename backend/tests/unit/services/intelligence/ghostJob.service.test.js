'use strict';
const { scoreGhostJob, filterGhostJobs } = require('../../../../src/services/intelligence/ghostJob.service');

const baseJob = {
  title: 'Senior Full Stack Engineer',
  company: 'Acme Robotics',
  url: 'https://acme.greenhouse.io/jobs/12345',
  description: `We are looking for a Senior Full Stack Engineer with 5+ years of experience.
    You will be responsible for building our core platform. Required: React, Node, TypeScript,
    Docker, AWS. Must have strong communication skills. Responsibilities include leading the
    team on new feature development. Contact us at jobs@acme.example.com for questions.`.repeat(3),
  salaryMin: 90000,
  salaryMax: 130000,
  postedAt: new Date().toISOString(),
};

describe('ghostJob.service — scoreGhostJob', () => {
  test('scores a high-quality, recent, transparent listing as REAL with high confidence', () => {
    const result = scoreGhostJob(baseJob);
    expect(result.verdict).toBe('REAL');
    expect(result.confidence).toBe('HIGH');
    expect(result.realJobScore).toBeGreaterThanOrEqual(70);
    expect(result.shouldShow).toBe(true);
    expect(result.requiresWarning).toBe(false);
  });

  test('flags a stale, vague, no-salary listing as LIKELY_GHOST', () => {
    const ghostJob = {
      title: 'Rockstar Ninja Developer Wanted',
      company: 'Confidential',
      url: 'https://example.com/apply',
      description: 'always looking for talent for future opportunities, join our talent pipeline',
      salaryMin: null,
      salaryMax: null,
      postedAt: new Date(Date.now() - 120 * 86400000).toISOString(), // 120 days old
    };
    const result = scoreGhostJob(ghostJob);
    expect(result.verdict).toBe('LIKELY_GHOST');
    expect(result.confidence).toBe('LOW');
    expect(result.realJobScore).toBeLessThan(40);
  });

  test('returns UNCERTAIN band for a mixed-signal listing', () => {
    const mixedJob = {
      title: 'Backend Developer',
      company: 'Client',
      url: 'https://example.com/careers/backend',
      description: 'We need a backend developer. Some experience preferred.',
      salaryMin: null,
      salaryMax: null,
      postedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    };
    const result = scoreGhostJob(mixedJob);
    expect(['UNCERTAIN', 'LIKELY_GHOST']).toContain(result.verdict);
  });

  test('handles missing optional fields without throwing', () => {
    expect(() => scoreGhostJob({ title: 'X', company: 'Y' })).not.toThrow();
  });

  test('always returns a score clamped between 0 and 100', () => {
    const result = scoreGhostJob({});
    expect(result.realJobScore).toBeGreaterThanOrEqual(0);
    expect(result.realJobScore).toBeLessThanOrEqual(100);
  });
});

describe('ghostJob.service — filterGhostJobs', () => {
  test('drops jobs below the minimum score threshold', () => {
    const ghostJob = { title: 'Ninja', company: 'Confidential', url: '', description: '', postedAt: null };
    const filtered = filterGhostJobs([baseJob, ghostJob], { minScore: 40 });
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe(baseJob.title);
  });

  test('sorts surviving jobs by descending ghost score', () => {
    const midJob = {
      title: 'Backend Developer', company: 'Client',
      url: 'https://example.com/careers/x', description: 'some description here for the role',
      postedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    };
    const filtered = filterGhostJobs([midJob, baseJob], { minScore: 0 });
    expect(filtered[0].ghostScore.realJobScore).toBeGreaterThanOrEqual(filtered[1].ghostScore.realJobScore);
  });

  test('respects a custom minScore option', () => {
    const filtered = filterGhostJobs([baseJob], { minScore: 101 });
    expect(filtered.length).toBe(0);
  });
});
