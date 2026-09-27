/** Jest config — backend (Node/Express/Mongoose). */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js', // boot wiring — covered by integration/health-check tests instead
  ],
  coverageThreshold: {
    global: { statements: 70, branches: 60, functions: 70, lines: 70 },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 20000,
  clearMocks: true,
  verbose: true,
  // isomorphic-dompurify (used by validate.middleware.js) ships as ESM inside
  // its dependency html-encoding-sniffer. Jest runs in CJS mode by default, so
  // we need to tell it to transform those packages rather than load them raw.
  // The regex below matches ANY node_modules path segment that ISN'T one of
  // these ESM-only packages — i.e. everything NOT in this list is excluded
  // from transformation (default Jest behavior), while these specific packages
  // ARE transformed (Babel-style, using Jest's built-in CommonJS interop).
  transformIgnorePatterns: [
    '/node_modules/(?!(isomorphic-dompurify|html-encoding-sniffer|jsdom|whatwg-encoding|iconv-lite)/)',
  ],
};
