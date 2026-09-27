/**
 * Jest config — Angular frontend.
 * Standardizes the whole project on Jest (backend + frontend); no Karma
 * anywhere. Note: this repo never actually had a Karma config wired into
 * angular.json (no "test" architect target existed) — there was nothing to
 * remove, this is a from-scratch setup.
 */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  moduleNameMapper: {
    '^@env/(.*)$': '<rootDir>/src/environments/$1',
  },
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': [
      'jest-preset-angular',
      { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$' },
    ],
  },
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.routes.ts',
    '!src/main.ts',
    '!src/app/app.config.ts',
  ],
  coverageThreshold: {
    // Starter threshold — ratchets up toward 95% as more suites land,
    // matching the same progressive approach taken on the backend.
    global: { statements: 40, branches: 30, functions: 40, lines: 40 },
  },
};
