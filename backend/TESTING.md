# Backend Testing Guide

## Setup
```bash
cd backend
npm install        # pulls in jest + supertest (added as devDependencies)
```

## Run
```bash
npm test           # full suite with coverage
npm run test:watch # watch mode while developing
npm run test:ci    # CI mode (used by GitHub Actions)
```

## What's covered so far
- `services/intelligence/ghostJob.service.js` — the ghost-job scoring engine
  (the core product differentiator), including boundary cases for each
  verdict band (REAL / UNCERTAIN / LIKELY_GHOST).
- `services/ai/groq.service.js` — retry/backoff logic added in the last
  session (regression coverage for the 429-storm production bug: retries,
  `retry-after` header handling, non-retryable errors, give-up behavior).
- `services/jobs/jobAggregator.service.js` — regression coverage for the
  `jobListingId` bug (jobs must come back with a real persisted `_id`).
- `app.js` — health check, 404 shape, security headers, and that protected
  routes reject unauthenticated requests.

No test hits the network or a real database — external services (axios,
scrapers, Mongoose models) are mocked with `jest.mock()`. `app.js` was
refactored so `NODE_ENV=test` skips the real Mongo connection and
`app.listen()`, since it previously auto-booted on `require()`.

## Not yet covered (next priorities)
- Auth flows (register/login/JWT refresh/brute-force lockout) — needs either
  `mongodb-memory-server` or a mocked User model.
- `automationEngine.service.js` end-to-end (discover → match → apply loop).
- `jobMatcher.service.js` batching/stagger behavior directly (indirectly
  exercised via groq.service mocks today).
- Frontend: no Angular test runner is configured yet (Karma/Jasmine or the
  Angular CLI's Jest builder) — TBD, needs a decision on which to standardize
  on before writing component/service specs.

## Coverage target
`jest.config.js` sets a starter threshold (70% statements/functions/lines,
60% branches) rather than the eventual 95% goal — ratcheting it up test batch
by test batch keeps CI green while coverage grows, instead of red-lining the
whole suite on day one.
