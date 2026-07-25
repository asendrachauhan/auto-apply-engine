# AutoApply AI — Complete Context for New Chat Window
Last updated: July 2026

---

## What This Project Is

AutoApply AI is a production-grade SaaS job application automation platform.
Stack: Angular 17+ (frontend) + Node.js/Express (backend) + MongoDB + Groq AI.
Deployed on: Railway (backend) + Vercel (frontend).

---

## Unique Differentiators (Not in Any Competitor)

1. **Ghost Job Detection** — Scores every job 0-100 for legitimacy before showing it
2. **Explainable AI Match Scores** — Not "87%" but WHY 87% (5 dimensions)
3. **India → Europe Intelligence** — CTC→EUR conversion, visa pathways (DE/NL/PT/SE), EU resume guide
4. **Human-in-loop Apply** — Legal, no ToS violations, quality over volume
5. **GDPR Compliant** — Consent modal, data export, right to deletion

---

## Current Build Status

### ✅ Backend — COMPLETE (75+ files)
```
backend/src/
├── app.js                          ✅ Production Express server, security headers, CORS
├── config/
│   ├── database.js                 ✅ MongoDB Atlas connection with retry
│   ├── groq.js                     ✅ Groq AI client with retry + JSON parser
│   └── cloudinary.js               ✅ Resume PDF storage
├── controllers/
│   ├── auth.controller.js          ✅ Register, Login, Verify Email, Forgot/Reset Password, Logout, Delete Account
│   ├── automation.controller.js    ✅ Start/Stop/Run/Status/History
│   ├── jobs.controller.js          ✅ Discover, Applications, Status update
│   ├── resume.controller.js        ✅ Upload, Parse (Groq), Optimize, Get
│   ├── settings.controller.js      ✅ Preferences, Notifications, Data Export (GDPR)
│   └── subscription.controller.js  ✅ Stripe checkout, Webhook, Portal
├── middleware/
│   ├── auth.middleware.js          ✅ JWT verify, brute force protection, plan enforcement
│   ├── errorHandler.middleware.js  ✅ Global error handler, never leaks stack traces
│   ├── rateLimit.middleware.js     ✅ Tiered rate limiting (global/auth/automation)
│   ├── upload.middleware.js        ✅ Multer, file type validation, 5MB limit
│   └── validate.middleware.js      ✅ express-validator, XSS sanitization
├── models/
│   ├── User.js                     ✅ GDPR consent, email verification, brute force, plan limits
│   ├── Resume.js                   ✅ Parsed + optimized data, ATS score, Cloudinary URL
│   ├── JobListing.js               ✅ Ghost score, EU metadata, all sources
│   ├── JobApplication.js           ✅ Status tracking, match dimensions, cover letter
│   └── AutomationSession.js        ✅ Run history, stats, errors
├── routes/
│   ├── auth.routes.js              ✅ All auth endpoints
│   ├── resume.routes.js            ✅ Upload + parse inline (no separate controller needed)
│   ├── jobs.routes.js              ✅ Discover + applications
│   ├── automation.routes.js        ✅ Start/stop/run/status/history
│   ├── settings.routes.js          ✅ Preferences + GDPR data export
│   ├── intelligence.routes.js      ✅ EU pathways, CTC convert, visa check, resume guide
│   └── subscription.routes.js      ✅ Stripe checkout + webhook + portal
├── services/
│   ├── ai/
│   │   ├── jobMatcher.service.js   ✅ 5-dimension explainable AI scoring
│   │   ├── coverLetter.service.js  ✅ Personalized per job
│   │   ├── resumeParser.service.js ✅ Groq JSON extraction
│   │   └── resumeOptimizer.service.js ✅ ATS optimization
│   ├── intelligence/
│   │   ├── ghostJob.service.js     ✅ 8-signal scoring model (OUR UNIQUE FEATURE)
│   │   └── indiaToEurope.service.js ✅ CTC conversion, visa eligibility, EU resume guide
│   ├── jobs/
│   │   ├── remotive.scraper.js     ✅ Legal, free, no key
│   │   ├── himalayas.scraper.js    ✅ Legal, free, no key
│   │   ├── arbeitnow.scraper.js    ✅ Legal, free EU jobs, visa filter
│   │   ├── adzuna.scraper.js       ✅ Free key, India + global
│   │   └── jobAggregator.service.js ✅ Combines all, deduplicates, ghost filters
│   ├── automation/
│   │   ├── automationEngine.service.js ✅ Full pipeline: discover→match→apply→notify
│   │   └── scheduler.service.js    ✅ node-cron every 6 hours
│   └── notifications/
│       └── email.service.js        ✅ Resend, HTML templates (verify, reset, application)
└── utils/
    ├── constants.js                ✅ Single source of truth for all magic values
    ├── apiResponse.js              ✅ Standardized success/error shape
    └── logger.js                   ✅ Winston, JSON in prod, pretty in dev
```

### ✅ Frontend — CORE COMPLETE (Angular 17+)
```
frontend/src/app/
├── app.component.ts                ✅ Root with RouterOutlet + Toast
├── app.config.ts                   ✅ provideRouter, provideHttpClient, interceptors
├── app.routes.ts                   ✅ All 14 routes, lazy loaded, guarded
├── core/
│   ├── guards/auth.guard.ts        ✅ authGuard, publicGuard, onboardingGuard
│   ├── interceptors/
│   │   ├── auth.interceptor.ts     ✅ Attaches JWT, auto-refresh on 401
│   │   └── loading.interceptor.ts  ✅ Global loading state
│   └── services/
│       ├── auth.service.ts         ✅ Login, register, logout, token management
│       ├── api.service.ts          ✅ Typed HTTP wrapper
│       ├── toast.service.ts        ✅ Signal-based toast system
│       └── loading.service.ts      ✅ Global loading indicator
├── features/
│   ├── auth/                       ✅ Login + Register + Forgot + Verify Email
│   ├── onboarding/                 ✅ 5-step wizard: Resume→Prefs→Locations→Notify→Launch
│   ├── eu/eu-careers.component.ts  ✅ CTC converter, visa pathways, EU resume guide
│   ├── dashboard/                  ✅ Exists from original ZIP
│   ├── resume/                     ✅ Exists from original ZIP
│   ├── jobs/                       ✅ Exists from original ZIP
│   ├── automation/                 ✅ Exists from original ZIP
│   ├── alerts/                     ✅ Exists from original ZIP
│   ├── settings/                   ✅ Exists from original ZIP
│   ├── analytics/                  ⚠️ Stub (needs full build)
│   ├── plans/                      ⚠️ Stub (needs full build)
│   ├── preferences/                ⚠️ Stub (needs full build)
│   └── profile/                    ⚠️ Stub (needs full build)
└── shared/
    ├── components/
    │   ├── icon/icon.component.ts   ✅ 50+ Lucide SVG icons, no emojis
    │   ├── toast/toast.component.ts ✅ Exists from original ZIP
    │   ├── sidebar/                 ✅ Exists from original ZIP (needs icon upgrade)
    │   └── neo-button/              ✅ Exists from original ZIP
    └── styles/
        ├── _variables.scss          ✅ Dark glassmorphism tokens (replaces neomorphism)
        └── styles.scss              ✅ Global dark theme, glass cards, skeletons
```

---

## What Needs To Be Built Next (Priority Order)

### Priority 1 — Connect Frontend to Real Backend
The existing Angular components from the original ZIP still have mock/hardcoded data.
They need to be connected to the real API services.

Files to update:
- `dashboard.component.ts` — connect to `/api/jobs/applications` and `/api/automation/status`
- `resume.component.ts` — connect to `/api/resume/upload` and `/api/resume/my`
- `jobs.component.ts` — connect to `/api/jobs/applications`
- `automation.component.ts` — connect to `/api/automation/run-now` and SSE for live logs
- `alerts.component.ts` — connect to `/api/jobs/discover`

### Priority 2 — Full Page Builds (Stubs need replacing)
- `analytics.component.ts` — real data charts
- `plans.component.ts` — Stripe checkout integration
- `preferences.component.ts` — job preferences form
- `profile.component.ts` — edit name, password, delete account

### Priority 3 — Ghost Score UI in Job Cards
The `ghostJob.service.js` is complete on backend.
Frontend needs a `ghost-score.component.ts` to display it in job cards.

### Priority 4 — EU Page Integration
`eu-careers.component.ts` is built but needs to call real `/api/intelligence/*` endpoints.

### Priority 5 — Sidebar Icon Upgrade
Current sidebar uses old design. Needs to use new `aa-icon` component with Lucide SVGs.

---

## Deployment — Step by Step

### Backend → Railway
1. railway.app → New Project → GitHub repo → backend folder
2. Set all env vars from `.env.example`
3. Auto-deploys on `git push main`

### Frontend → Vercel  
1. vercel.com → New Project → GitHub repo → frontend folder
2. Framework: Angular
3. Set `API_URL` env var to your Railway backend URL
4. Auto-deploys on `git push main`

### MongoDB → Atlas
1. mongodb.com/atlas → Free cluster → Connect
2. Whitelist Railway IP or use 0.0.0.0/0 for all
3. Copy connection string to `MONGODB_URI`

---

## Security Features Implemented

| Feature | Status |
|---------|--------|
| JWT (15min access + 7day refresh) | ✅ |
| bcrypt 12 rounds | ✅ |
| Brute force protection (5 attempts → 15min lockout) | ✅ |
| Rate limiting (tiered per endpoint) | ✅ |
| Input sanitization (XSS) | ✅ |
| CORS restricted to frontend domain | ✅ |
| Helmet.js security headers | ✅ |
| No stack traces in production | ✅ |
| Email verification before sensitive ops | ✅ |
| GDPR consent with timestamp + IP | ✅ |
| Data export endpoint | ✅ |
| Account deletion (GDPR right to erasure) | ✅ |
| Non-root Docker user | ✅ |
| CI/CD security audit in GitHub Actions | ✅ |

---

## API Keys Needed (All Free Tier)

| Key | Where | Free limit |
|-----|-------|-----------|
| `MONGODB_URI` | mongodb.com/atlas | 512MB |
| `GROQ_API_KEY` | console.groq.com | Generous free tier |
| `CLOUDINARY_*` | cloudinary.com | 25 credits/month |
| `ADZUNA_APP_ID/KEY` | developer.adzuna.com | 250 req/day |
| `RESEND_API_KEY` | resend.com | 3,000 emails/month |
| `TWILIO_*` | twilio.com | $15 free credit |
| `STRIPE_*` | dashboard.stripe.com | No monthly fee |
| `JWT_SECRET` | Generate locally | — |

Generate JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run twice — one for JWT_SECRET, one for JWT_REFRESH_SECRET.

---

## Instructions for New Chat Window

Tell the new Claude:

> "I am building AutoApply AI. The codebase is in the uploaded ZIP. Read CONTEXT_FOR_NEW_CHAT.md first — it explains everything that is built and what is next. Continue building from Priority 1 in that file. Do not rebuild what already exists. Use the same dark glassmorphism design system (variables in frontend/src/assets/styles/_variables.scss). Use aa-icon component for all icons, no emojis. Follow the same production patterns as the existing code."

---

## Design System Summary (Dark Glassmorphism)

```scss
Background:  #0a0a0f
Surface:     rgba(255,255,255,0.04) with backdrop-filter: blur(12px)
Border:      rgba(255,255,255,0.08)
Accent:      #7c3aed (violet)
Success:     #10b981
Danger:      #ef4444
Warning:     #f59e0b
Text:        #f8fafc (primary), #94a3b8 (secondary), #64748b (muted)
Font:        'Inter', sans-serif
Mono:        'JetBrains Mono', monospace
```

Cards always use: `background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px;`

---

## Job Sources (Legal Only)

| Source | Type | Key |
|--------|------|-----|
| Remotive | Remote global | None |
| Himalayas | Remote global | None |
| Arbeitnow | EU / Germany + visa filter | None |
| Adzuna | India + global | Free |

NOT used: LinkedIn scraping, Naukri scraping, Indeed RSS (all deprecated/ToS violation).
