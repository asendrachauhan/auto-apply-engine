'use strict';
jest.mock('../../../../src/services/ai/groq.service');
const groq = require('../../../../src/services/ai/groq.service');
const { generatePrefill } = require('../../../../src/services/ai/formPrefill.service');

const job = { title: 'Marketing Manager', company: 'Acme Inc', source: 'linkedin', description: 'desc', url: 'https://x.com' };

describe('formPrefill.service — generatePrefill', () => {
  beforeEach(() => jest.clearAllMocks());

  test('builds a prompt with the candidate and job info, returns the parsed prefill with platformInfo and applicationCard attached', async () => {
    groq.chat.mockResolvedValue('{"fields":[],"coverLetter":"","oneLiner":""}');
    groq.parseJSON.mockReturnValue({ fields: [], coverLetter: '', oneLiner: '' });

    const result = await generatePrefill({ fullName: 'Jane', skills: { technical: ['SQL'] } }, job, {});
    expect(result.platformInfo).toBeDefined();
    expect(result.applicationCard).toContain('Marketing Manager');
    expect(result.applicationCard).toContain('Acme Inc');
  });

  describe('regression (Session 42): the app was asked to support every job category, not just technical roles', () => {
    test('topSkills includes non-technical skill buckets, not just technical', async () => {
      groq.chat.mockResolvedValue('{"fields":[]}');
      groq.parseJSON.mockReturnValue({ fields: [] });

      const marketingCandidate = {
        fullName: 'Priya Sharma',
        skills: { technical: [], soft: ['Stakeholder communication'], tools: ['HubSpot', 'Google Analytics'] },
      };
      await generatePrefill(marketingCandidate, job, {});
      const promptSent = groq.chat.mock.calls[0][0][0].content;
      expect(promptSent).toContain('HubSpot');
      expect(promptSent).toContain('Stakeholder communication');
    });

    test('a candidate with zero skills in any bucket does not throw', async () => {
      groq.chat.mockResolvedValue('{"fields":[]}');
      groq.parseJSON.mockReturnValue({ fields: [] });
      await expect(generatePrefill({ fullName: 'X', skills: {} }, job, {})).resolves.toBeDefined();
    });
  });
});
