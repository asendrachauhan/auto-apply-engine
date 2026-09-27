'use strict';
jest.mock('../../../../src/services/ai/groq.service');
const groq = require('../../../../src/services/ai/groq.service');
const { generateCoverLetter } = require('../../../../src/services/ai/coverLetter.service');

const resumeData = {
  fullName: 'Jane Doe', targetRoles: ['Backend Engineer'],
  skills: { technical: ['Node.js', 'MongoDB', 'Docker'] },
  experience: [{ achievements: ['Cut API latency by 40%'] }],
};
const job = { title: 'Senior Backend Engineer', company: 'Acme Inc' };
const score = { matchedSkills: ['Node.js', 'Docker'] };

describe('coverLetter.service — generateCoverLetter', () => {
  test('builds a prompt with the candidate name, job title, and company, and returns trimmed text', async () => {
    groq.chat.mockResolvedValue('  Dear Hiring Manager, ...  ');
    const result = await generateCoverLetter(resumeData, job, score);
    expect(result).toBe('Dear Hiring Manager, ...');
    const promptSent = groq.chat.mock.calls[0][0][0].content;
    expect(promptSent).toContain('Jane Doe');
    expect(promptSent).toContain('Senior Backend Engineer');
    expect(promptSent).toContain('Acme Inc');
  });

  test('never throws — returns an empty string if Groq fails (caller applies it directly)', async () => {
    groq.chat.mockRejectedValue(new Error('Groq unavailable'));
    const result = await generateCoverLetter(resumeData, job, score);
    expect(result).toBe('');
  });

  test('handles missing optional resume fields without throwing', async () => {
    groq.chat.mockResolvedValue('Cover letter text');
    const result = await generateCoverLetter({}, job, {});
    expect(result).toBe('Cover letter text');
  });

  describe('regression (Session 42): the app was asked to support every job category, not just technical roles', () => {
    test('a marketing candidate with zero technical skills gets their real skills mentioned, not an empty list', async () => {
      groq.chat.mockResolvedValue('Cover letter text');
      const marketingCandidate = {
        fullName: 'Priya Sharma', targetRoles: ['Marketing Manager'],
        skills: { technical: [], soft: ['Stakeholder communication'], tools: ['HubSpot', 'Google Analytics'] },
        experience: [{ achievements: ['Grew organic traffic 3x'] }],
      };
      await generateCoverLetter(marketingCandidate, { title: 'Marketing Manager', company: 'Acme' }, {});
      const promptSent = groq.chat.mock.calls[0][0][0].content;
      expect(promptSent).toContain('HubSpot');
      expect(promptSent).toContain('Stakeholder communication');
    });

    test('a candidate with no targetRoles falls back to the job\'s own title, not a hardcoded "Software Development"', async () => {
      groq.chat.mockResolvedValue('Cover letter text');
      await generateCoverLetter({ fullName: 'Priya' }, { title: 'Content Marketing Specialist', company: 'Acme' }, {});
      const promptSent = groq.chat.mock.calls[0][0][0].content;
      expect(promptSent).toContain('Content Marketing Specialist');
      expect(promptSent).not.toContain('Software Development');
    });
  });
});
