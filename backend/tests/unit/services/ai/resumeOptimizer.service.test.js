'use strict';
jest.mock('../../../../src/services/ai/groq.service');
const groq = require('../../../../src/services/ai/groq.service');
const { optimizeResume } = require('../../../../src/services/ai/resumeOptimizer.service');

describe('resumeOptimizer.service — optimizeResume', () => {
  test('sends parsed data to Groq and returns the optimized result', async () => {
    groq.chat.mockResolvedValue('{"atsScore":88,"improvements":["Added metrics"]}');
    groq.parseJSON.mockReturnValue({ atsScore: 88, improvements: ['Added metrics'] });

    const result = await optimizeResume({ fullName: 'Jane Doe', experience: [{ title: 'Engineer' }] });
    expect(result).toEqual({ atsScore: 88, improvements: ['Added metrics'] });
    expect(groq.chat).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining('Jane Doe') })]),
      expect.objectContaining({ maxTokens: 2500, temperature: 0.2 })
    );
  });

  test('truncates very large parsed data to stay within prompt limits', async () => {
    groq.chat.mockResolvedValue('{"atsScore":50}');
    groq.parseJSON.mockReturnValue({ atsScore: 50 });

    const hugeData = { fullName: 'X', notes: 'A'.repeat(20000) };
    await optimizeResume(hugeData);
    const promptSent = groq.chat.mock.calls[0][0][0].content;
    expect(promptSent.length).toBeLessThan(7000); // prompt prefix (~1750 chars) + 5000-char slice cap
  });

  test('propagates a Groq failure to the caller (no silent fallback)', async () => {
    groq.chat.mockRejectedValue(new Error('Groq unavailable'));
    await expect(optimizeResume({ fullName: 'Jane' })).rejects.toThrow('Groq unavailable');
  });
});
