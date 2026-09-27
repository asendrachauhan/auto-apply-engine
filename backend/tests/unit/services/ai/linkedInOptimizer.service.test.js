'use strict';
jest.mock('../../../../src/services/ai/groq.service');
jest.mock('../../../../src/utils/logger');

const groq = require('../../../../src/services/ai/groq.service');
const { optimizeProfile } = require('../../../../src/services/ai/linkedInOptimizer.service');

describe('linkedInOptimizer.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    groq.chat = jest.fn();
    groq.parseJSON = jest.fn();
  });

  describe('optimizeProfile', () => {
    test('returns optimized LinkedIn profile with score and suggestions', async () => {
      const input = {
        headline: 'Software Developer at TechCorp',
        about: 'I work on backend systems.',
        experienceBullets: [
          'Worked on API development',
          'Fixed bugs in the system',
        ],
        currentRole: 'Backend Engineer',
        targetRoles: ['Senior Backend Engineer', 'Tech Lead'],
      };

      const mockAiResponse = JSON.stringify({
        headline: 'Senior Backend Engineer | Distributed Systems | Go/Python | Scaling platforms for 10M+ users',
        about: 'Senior Backend Engineer with 7+ years building distributed systems at scale. Architected microservices handling 10M+ daily requests. Expert in Go, Python, and cloud infrastructure. Passionate about mentoring and technical leadership. Open to leadership roles. Let\'s connect!',
        experienceBullets: [
          'Architected scalable API infrastructure handling 10M+ daily requests using Go and Kubernetes, reducing latency by 40%',
          'Led migration from monolith to microservices, improving deployment frequency from weekly to 10x daily with 99.99% uptime',
        ],
        linkedInScore: 82,
        improvements: [
          'Headline now includes specific metrics and technologies for better recruiter search visibility',
          'About section features quantified achievements and clear career progression',
          'Experience bullets follow [Action] + [What] + [Result] pattern with measurable impact',
        ],
        keywordsAdded: ['distributed systems', 'microservices', 'Kubernetes', 'high availability', 'technical leadership'],
        tips: [
          'Consider adding 2-3 more experience bullets to fully complete the experience section',
          'Add relevant endorsements for the new keywords mentioned',
          'Schedule follow-ups with recruiters who view your profile in the next 2 weeks',
        ],
      });

      groq.chat.mockResolvedValue(mockAiResponse);
      groq.parseJSON.mockReturnValue(JSON.parse(mockAiResponse));

      const result = await optimizeProfile(input);

      expect(groq.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('RULES'),
          }),
        ]),
        expect.objectContaining({ maxTokens: 2500 })
      );

      expect(result).toHaveProperty('headline');
      expect(result).toHaveProperty('about');
      expect(result).toHaveProperty('experienceBullets');
      expect(result).toHaveProperty('linkedInScore');
      expect(result.linkedInScore).toBe(82);
      expect(result.improvements).toBeInstanceOf(Array);
      expect(result.keywordsAdded).toBeInstanceOf(Array);
      expect(result.tips).toBeInstanceOf(Array);
    });

    test('works with minimal profile (only headline)', async () => {
      const input = {
        headline: 'Software Developer',
      };

      const mockAiResponse = JSON.stringify({
        headline: 'Software Engineer | Python/JavaScript | Cloud Solutions',
        about: '',
        experienceBullets: [],
        linkedInScore: 45,
        improvements: ['Headline improved with technical keywords'],
        keywordsAdded: ['Cloud Solutions'],
        tips: ['Add an about section to increase profile strength'],
      });

      groq.chat.mockResolvedValue(mockAiResponse);
      groq.parseJSON.mockReturnValue(JSON.parse(mockAiResponse));

      const result = await optimizeProfile(input);

      expect(result.headline).toContain('Software Engineer');
      expect(result.linkedInScore).toBe(45);
    });

    test('works with experience bullets only', async () => {
      const input = {
        experienceBullets: [
          'Managed team of developers',
          'Deployed new features',
        ],
      };

      const mockAiResponse = JSON.stringify({
        headline: '',
        about: '',
        experienceBullets: [
          'Led engineering team of 8 developers, delivering 15 features per quarter with 99.5% uptime',
          'Deployed critical features using CI/CD pipeline, reducing time-to-production from 2 weeks to 2 days',
        ],
        linkedInScore: 62,
        improvements: [
          'Bullets now include quantified impact metrics',
          'Added leadership and technical keywords',
        ],
        keywordsAdded: ['engineering leadership', 'CI/CD', 'DevOps'],
        tips: ['Add headline and about section to complete profile'],
      });

      groq.chat.mockResolvedValue(mockAiResponse);
      groq.parseJSON.mockReturnValue(JSON.parse(mockAiResponse));

      const result = await optimizeProfile(input);

      expect(result.experienceBullets).toHaveLength(2);
      expect(result.experienceBullets[0]).toContain('Led');
      expect(result.linkedInScore).toBe(62);
    });

    test('rejects when no profile sections provided', async () => {
      const input = {
        headline: '',
        about: '',
        experienceBullets: [],
      };

      await expect(optimizeProfile(input)).rejects.toThrow(
        'LinkedIn profile must have at least a headline, about section, or experience bullets'
      );
    });

    test('includes industry context in optimization if provided', async () => {
      const input = {
        headline: 'Marketing Manager',
        about: 'I do marketing',
        industry: 'SaaS B2B',
      };

      const mockAiResponse = JSON.stringify({
        headline: 'B2B SaaS Marketing Manager | Demand Generation | Growth Strategy',
        about: 'B2B SaaS marketing leader specializing in demand generation.',
        experienceBullets: [],
        linkedInScore: 70,
        improvements: [],
        keywordsAdded: ['demand generation', 'SaaS marketing'],
        tips: [],
      });

      groq.chat.mockResolvedValue(mockAiResponse);
      groq.parseJSON.mockReturnValue(JSON.parse(mockAiResponse));

      const result = await optimizeProfile(input);

      // Verify industry was included in the prompt
      const callArgs = groq.chat.mock.calls[0][0][0].content;
      expect(callArgs).toContain('industry');

      expect(result.headline).toContain('SaaS');
    });

    test('handles Groq API errors gracefully', async () => {
      const input = {
        headline: 'My Profile',
        about: 'Some bio',
      };

      groq.chat.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(optimizeProfile(input)).rejects.toThrow('API rate limit exceeded');
    });

    test('respects maxTokens and temperature parameters for Groq', async () => {
      const input = {
        headline: 'Developer',
        about: 'Engineer',
      };

      groq.chat.mockResolvedValue('{}');
      groq.parseJSON.mockReturnValue({
        headline: 'Senior Developer',
        linkedInScore: 75,
        improvements: [],
        keywordsAdded: [],
        tips: [],
      });

      await optimizeProfile(input);

      expect(groq.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          maxTokens: 2500,
          temperature: 0.3, // Lower than resume optimizer (0.2) to be more consistent
        })
      );
    });
  });
});
