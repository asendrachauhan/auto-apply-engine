'use strict';
jest.mock('../../../../src/services/ai/groq.service');
const groq = require('../../../../src/services/ai/groq.service');
const { matchJobs, scoreJob } = require('../../../../src/services/ai/jobMatcher.service');

const makeJob = (i) => ({ title: `Job ${i}`, company: `Co ${i}`, description: 'desc', url: 'https://x.com' });
const resumeData = { targetRoles: ['engineer'], skills: { technical: ['React'] }, experience: [{ title: 'Dev' }], summary: 'summary' };

describe('jobMatcher.service — scoreJob', () => {
  test('calls groq.chat with a prompt including job title/company and parses the JSON response', async () => {
    groq.chat.mockResolvedValue('{"matchScore":80,"shouldApply":true}');
    groq.parseJSON.mockReturnValue({ matchScore: 80, shouldApply: true });

    const result = await scoreJob(makeJob(1), resumeData);
    expect(result).toEqual({ matchScore: 80, shouldApply: true });
    expect(groq.chat).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ role: 'user', content: expect.stringContaining('Job 1') })]),
      expect.objectContaining({ maxTokens: 1200, temperature: 0.2 })
    );
  });

  describe('regression (Session 42): the app was asked to support every job category, not just technical roles', () => {
    test('the prompt no longer frames the model as a "technical recruiter" — must work for marketing/BPO/sales/etc.', async () => {
      groq.chat.mockResolvedValue('{"matchScore":80,"shouldApply":true}');
      groq.parseJSON.mockReturnValue({ matchScore: 80, shouldApply: true });

      await scoreJob(makeJob(1), resumeData);
      const promptSent = groq.chat.mock.calls[0][0][0].content;
      expect(promptSent).not.toMatch(/technical recruiter/i);
      expect(promptSent).toMatch(/any industry/i);
    });

    test('a candidate with ONLY non-technical skills (soft/tools/languages) is no longer sent an empty skills list', async () => {
      groq.chat.mockResolvedValue('{"matchScore":80,"shouldApply":true}');
      groq.parseJSON.mockReturnValue({ matchScore: 80, shouldApply: true });

      const marketingCandidate = {
        targetRoles: ['Marketing Manager'],
        skills: { technical: [], soft: ['Stakeholder communication', 'Team leadership'], tools: ['HubSpot', 'Google Analytics', 'SEMrush'], languages: [] },
        experience: [{ title: 'Marketing Manager' }],
        summary: '8 years in B2B marketing',
      };
      await scoreJob(makeJob(1), marketingCandidate);
      const promptSent = groq.chat.mock.calls[0][0][0].content;
      // Before the fix, candidateSummary.skills only pulled skills.technical
      // ([] here) — the AI would have seen an empty skills list for this
      // candidate despite them having 5 genuinely relevant skills.
      expect(promptSent).toContain('HubSpot');
      expect(promptSent).toContain('Stakeholder communication');
    });

    test('all four skill buckets are combined, capped at 20 total (same cap as before, now shared across categories instead of belonging only to "technical")', async () => {
      groq.chat.mockResolvedValue('{"matchScore":80,"shouldApply":true}');
      groq.parseJSON.mockReturnValue({ matchScore: 80, shouldApply: true });

      const candidate = {
        skills: {
          technical: Array.from({ length: 10 }, (_, i) => `tech-${i}`),
          tools:     Array.from({ length: 10 }, (_, i) => `tool-${i}`),
          soft:      Array.from({ length: 10 }, (_, i) => `soft-${i}`),
        },
        experience: [], summary: '',
      };
      await scoreJob(makeJob(1), candidate);
      const promptSent = groq.chat.mock.calls[0][0][0].content;
      // Non-greedy, bounded up to the blank line before JOB: — verified via
      // direct execution that a naive greedy/dotall regex overshoots into
      // the prompt's trailing example JSON block instead of stopping at
      // the actual candidate data.
      const candidateJson = promptSent.match(/CANDIDATE \(key info only\):\n(.+?)\n\nJOB:/s)[1];
      const parsedCandidateData = JSON.parse(candidateJson);
      expect(parsedCandidateData.skills.length).toBeLessThanOrEqual(20);
      // technical still takes priority when trimming, but tools should
      // appear too since technical alone (10) doesn't fill the cap (20)
      expect(parsedCandidateData.skills).toEqual(expect.arrayContaining(['tech-0', 'tool-0']));
    });
  });
});

describe('jobMatcher.service — matchJobs', () => {
  beforeEach(() => {
    groq.parseJSON.mockImplementation((raw) => JSON.parse(raw));
  });

  test('only returns jobs where shouldApply is true', async () => {
    const jobs = [makeJob(1), makeJob(2)];
    groq.chat
      .mockResolvedValueOnce('{"matchScore":85,"shouldApply":true}')
      .mockResolvedValueOnce('{"matchScore":30,"shouldApply":false}');

    const results = await matchJobs(jobs, resumeData);
    expect(results.length).toBe(1);
    expect(results[0].job.title).toBe('Job 1');
  });

  test('a rejected scoring call is excluded, not thrown (Promise.allSettled semantics)', async () => {
    const jobs = [makeJob(1), makeJob(2)];
    groq.chat
      .mockRejectedValueOnce(new Error('Request failed with status code 429'))
      .mockResolvedValueOnce('{"matchScore":90,"shouldApply":true}');

    const results = await matchJobs(jobs, resumeData);
    expect(results.length).toBe(1);
    expect(results[0].job.title).toBe('Job 2');
  });

  test('sorts results by matchScore descending', async () => {
    const jobs = [makeJob(1), makeJob(2), makeJob(3)];
    groq.chat
      .mockResolvedValueOnce('{"matchScore":70,"shouldApply":true}')
      .mockResolvedValueOnce('{"matchScore":95,"shouldApply":true}')
      .mockResolvedValueOnce('{"matchScore":80,"shouldApply":true}');

    const results = await matchJobs(jobs, resumeData);
    expect(results.map(r => r.score.matchScore)).toEqual([95, 80, 70]);
  });

  test('processes jobs in batches (verifies batching does not drop any job)', async () => {
    const jobCount = 12; // > default BATCH_SIZE of 5, forces multiple batches
    const jobs = Array.from({ length: jobCount }, (_, i) => makeJob(i));
    groq.chat.mockResolvedValue('{"matchScore":75,"shouldApply":true}');

    const results = await matchJobs(jobs, resumeData);
    expect(groq.chat).toHaveBeenCalledTimes(jobCount);
    expect(results.length).toBe(jobCount);
  }, 15000);

  test('returns an empty array when no jobs are provided', async () => {
    const results = await matchJobs([], resumeData);
    expect(results).toEqual([]);
    expect(groq.chat).not.toHaveBeenCalled();
  });
});
