/**
 * Global Jest setup for the backend test suite.
 * Runs before every test file (see jest.config.js -> setupFilesAfterEnv).
 * Provides safe dummy env vars so modules that read process.env at require
 * time (JWT secrets, API keys) don't throw during unit tests that never
 * actually hit the network.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-prod';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-do-not-use-in-prod';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-groq-key';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

// Global mock for isomorphic-dompurify to avoid ESM transformation errors
// from transitive dependency @exodus/bytes in Jest's Node environment.
jest.mock('isomorphic-dompurify', () => {
  const sanitize = (str) => {
    if (typeof str !== 'string') return str;
    let s = str;
    while (/<[^>]*>/.test(s)) s = s.replace(/<[^>]*>/g, '');
    return s;
  };
  return {
    sanitize,
    default: { sanitize },
  };
});
