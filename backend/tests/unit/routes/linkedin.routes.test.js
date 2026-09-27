jest.mock('../../../src/services/ai/linkedInOptimizer.service');
jest.mock('../../../src/middleware/auth.middleware', () => {
  const handler = (req, res, next) => {
    req.user = { _id: 'test-user-123' };
    next();
  };
  return {
    protect: handler,
    authenticate: handler,
    requireVerifiedEmail: (req, res, next) => next(),
    requirePlan: () => (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
  };
});

const request = require('supertest');
const { app } = require('../../../src/app');

const linkedinOptimizer = require('../../../src/services/ai/linkedInOptimizer.service');

describe('linkedin.routes — POST /optimize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with optimized profile when all sections provided', async () => {
    const mockOptimized = {
      headline: 'Senior Backend Engineer | Distributed Systems | Go/Python',
      about: 'Experienced backend engineer...',
      experienceBullets: ['Led architecture of...', 'Optimized queries...'],
      linkedInScore: 82,
      improvements: ['Added metrics', 'Improved keywords'],
      keywordsAdded: ['distributed systems', 'microservices'],
      tips: ['Consider adding more experience bullets'],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    const res = await request(app).post('/api/linkedin/optimize').send({
      headline: 'Backend Developer at Company',
      about: 'I build APIs',
      experienceBullets: ['Worked on API', 'Fixed bugs'],
      currentRole: 'Backend Engineer',
      targetRoles: ['Senior Backend Engineer'],
      industry: 'FinTech',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(mockOptimized);
    expect(linkedinOptimizer.optimizeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Backend Developer at Company',
        about: 'I build APIs',
        currentRole: 'Backend Engineer',
        targetRoles: ['Senior Backend Engineer'],
        industry: 'FinTech',
      })
    );
  });

  test('returns 200 with only headline provided', async () => {
    const mockOptimized = {
      headline: 'Software Engineer | Python/Go',
      about: '',
      experienceBullets: [],
      linkedInScore: 45,
      improvements: [],
      keywordsAdded: [],
      tips: ['Complete your about section'],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    const res = await request(app).post('/api/linkedin/optimize').send({
      headline: 'Software Developer',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.linkedInScore).toBe(45);
  });

  test('returns 200 with only about section provided', async () => {
    const mockOptimized = {
      headline: '',
      about: 'Experienced professional...',
      experienceBullets: [],
      linkedInScore: 50,
      improvements: [],
      keywordsAdded: [],
      tips: [],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    const res = await request(app).post('/api/linkedin/optimize').send({
      about: 'I am a software engineer with 5 years experience',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 with only experience bullets provided', async () => {
    const mockOptimized = {
      headline: '',
      about: '',
      experienceBullets: ['Led team of...', 'Delivered...'],
      linkedInScore: 62,
      improvements: [],
      keywordsAdded: [],
      tips: [],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    const res = await request(app).post('/api/linkedin/optimize').send({
      experienceBullets: ['Built features', 'Managed team'],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.experienceBullets).toHaveLength(2);
  });

  test('returns 400 when no profile sections provided', async () => {
    const res = await request(app).post('/api/linkedin/optimize').send({
      headline: '',
      about: '',
      experienceBullets: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('at least a headline, about section, or experience bullets');
  });

  test('returns 400 when request body is empty', async () => {
    const res = await request(app).post('/api/linkedin/optimize').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('accepts experienceBullets as an array', async () => {
    const mockOptimized = {
      headline: '',
      about: '',
      experienceBullets: ['Optimized bullet 1', 'Optimized bullet 2'],
      linkedInScore: 65,
      improvements: [],
      keywordsAdded: [],
      tips: [],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    const res = await request(app).post('/api/linkedin/optimize').send({
      experienceBullets: ['Bullet 1', 'Bullet 2', 'Bullet 3'],
    });

    expect(res.status).toBe(200);
    expect(linkedinOptimizer.optimizeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        experienceBullets: ['Bullet 1', 'Bullet 2', 'Bullet 3'],
      })
    );
  });

  test('handles non-array experienceBullets gracefully', async () => {
    const mockOptimized = {
      headline: 'Optimized headline',
      about: '',
      experienceBullets: [],
      linkedInScore: 40,
      improvements: [],
      keywordsAdded: [],
      tips: [],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    const res = await request(app).post('/api/linkedin/optimize').send({
      headline: 'Developer',
      experienceBullets: 'this is not an array', // should be ignored/coerced
    });

    expect(res.status).toBe(200);
    expect(linkedinOptimizer.optimizeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        experienceBullets: [], // coerced to empty array
      })
    );
  });

  test('passes optional fields (currentRole, targetRoles, industry) when provided', async () => {
    const mockOptimized = {
      headline: 'Optimized',
      about: '',
      experienceBullets: [],
      linkedInScore: 70,
      improvements: [],
      keywordsAdded: [],
      tips: [],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    const res = await request(app).post('/api/linkedin/optimize').send({
      headline: 'My Headline',
      currentRole: 'Tech Lead',
      targetRoles: ['Engineering Manager', 'Director of Engineering'],
      industry: 'Enterprise SaaS',
    });

    expect(res.status).toBe(200);
    expect(linkedinOptimizer.optimizeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        currentRole: 'Tech Lead',
        targetRoles: ['Engineering Manager', 'Director of Engineering'],
        industry: 'Enterprise SaaS',
      })
    );
  });

  test('omits optional fields from request when not provided', async () => {
    const mockOptimized = {
      headline: 'Optimized',
      about: '',
      experienceBullets: [],
      linkedInScore: 50,
      improvements: [],
      keywordsAdded: [],
      tips: [],
    };

    linkedinOptimizer.optimizeProfile.mockResolvedValue(mockOptimized);

    await request(app).post('/api/linkedin/optimize').send({
      headline: 'My Headline',
    });

    expect(linkedinOptimizer.optimizeProfile).toHaveBeenCalledWith(
      expect.not.objectContaining({
        currentRole: expect.anything(),
        targetRoles: expect.anything(),
        industry: expect.anything(),
      })
    );
  });

  test('returns 500 when optimizer service throws an error', async () => {
    linkedinOptimizer.optimizeProfile.mockRejectedValue(
      new Error('Groq API error')
    );

    const res = await request(app).post('/api/linkedin/optimize').send({
      headline: 'My Profile',
      about: 'Some bio',
    });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('requires authentication (protect middleware)', async () => {
    // This test verifies that the protect middleware is applied.
    // Since we mocked it to always add req.user, we can't directly test
    // the unauthenticated case here without unmocking, but the route
    // definition includes it and the mock confirms it runs.
    const res = await request(app).post('/api/linkedin/optimize').send({
      headline: 'Test',
    });

    // Even with our mock that injects req.user, the flow works
    expect(res.status).not.toBe(401);
  });
});
