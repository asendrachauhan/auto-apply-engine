# AutoApply AI — Antigravity IDE Workspace Rules & Architecture

## Overview
**AutoApply AI** is an autonomous SaaS job-application and intelligence platform tailored for Indian and global job seekers across all professions.

- **Frontend**: Angular 17+ (standalone components, signals, SCSS with semantic glassmorphism design system)
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **AI & Models**: Groq (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`)
- **Payments**: Stripe (webhooks, coupon codes, plan gating, kill-switch)
- **Communications**: Resend (email), Twilio (WhatsApp)
- **Package Manager**: npm (Node.js v24+)

---

## Non-Negotiable Engineering Rules

1. **Verification Over Claims**: Never describe any UI, feature, or bug fix as verified without running the real test suites or headless browser executions.
2. **Sequential Focus**: Complete the active task before moving to the next. Do not leave broken tests or half-migrated components.
3. **No Evading Third-Party Security**: Do not build bot-spoofs or scraping against third-party authenticated portals. Paid, compliant APIs and user-in-the-loop application flows are standard.
4. **Clean Responsive Design**: All pages must maintain zero horizontal overflow across Desktop (1440px), Laptop (1024px), and Mobile (390px, 375px, 360px). Use flex-wrap and responsive container padding.
5. **Durable Session Memory**: Always keep `project-memory/` updated (`CURRENT_STATUS.md`, `TEST_RESULTS.md`, `UI_AUDIT.md`, `UI_CHANGELOG.md`, `SESSION_HANDOFF.md`).

---

## Key Workflows & Commands

### Running Development Server
```bash
# Frontend dev server (port 4200)
cd frontend && npx ng serve --port 4200

# Backend dev server (port 5000)
cd backend && npm run dev
```

### Running Test Suites
```bash
# Backend unit & integration tests (32 suites, 309 tests)
cd backend && npm test -- --no-coverage --forceExit

# Frontend component & service tests (14 suites, 85 tests)
cd frontend && npm test -- --no-coverage --forceExit
```

### Compiling & Typechecking
```bash
# Check TypeScript compiler errors
cd frontend && npx tsc --noEmit

# Production bundle compilation
cd frontend && npx ng build --configuration production
```
