# AutoApply AI v2.0 🤖

> *Apply smarter. Not more.*

AI-powered job application platform with ghost job detection, India→Europe career intelligence, and explainable match scores.

## 🚀 Deploy in 5 Minutes

### Prerequisites
- GitHub account
- Railway account (backend) — railway.app
- Vercel account (frontend) — vercel.com
- MongoDB Atlas (free) — mongodb.com/atlas
- Groq API key (free) — console.groq.com

---

### Step 1 — Clone and push to GitHub
```bash
git init
git add .
git commit -m "feat: initial AutoApply AI v2.0"
git remote add origin https://github.com/YOUR_USERNAME/autoapply-ai.git
git push -u origin main
```

### Step 2 — Deploy Backend on Railway
1. Go to railway.app → New Project → Deploy from GitHub
2. Select your repo → select `backend` folder
3. Add environment variables (copy from `backend/.env.example`)
4. Railway auto-deploys on every push to main
5. Copy the generated backend URL

### Step 3 — Deploy Frontend on Vercel
1. Go to vercel.com → New Project → Import from GitHub
2. Select your repo → set Root Directory to `frontend`
3. Framework preset: Angular
4. Add environment variable: `API_URL=https://your-railway-url.railway.app`
   (no trailing slash, no `/api` — that's appended automatically)
5. Deploy

`API_URL` is picked up by `frontend/package.json`'s `vercel-build` script
(Vercel auto-detects and runs this instead of the plain `build` script),
which runs `scripts/set-api-url.js` to inject the real backend URL into
`environment.prod.ts` before Angular compiles it in. Previously this step
was documented but didn't actually do anything — the URL was silently
hardcoded regardless of what you set here. Fixed in production-readiness
review; see that script's header comment for the full story.

### Step 4 — Configure GitHub Secrets (for CI/CD)
In GitHub repo → Settings → Secrets → Actions:
```
RAILWAY_TOKEN       = (from railway.app → Account → Tokens)
VERCEL_TOKEN        = (from vercel.com → Settings → Tokens)
VERCEL_ORG_ID       = (from .vercel/project.json after first deploy)
VERCEL_PROJECT_ID   = (from .vercel/project.json after first deploy)
```

---

## 🔑 Required Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Where to get | Free? |
|----------|-------------|-------|
| `MONGODB_URI` | mongodb.com/atlas | ✅ 512MB free |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | ✅ |
| `JWT_REFRESH_SECRET` | Same command, run again | ✅ |
| `GROQ_API_KEY` | console.groq.com | ✅ Generous free tier |
| `CLOUDINARY_*` | cloudinary.com | ✅ 25 credits/mo |
| `ADZUNA_APP_ID/KEY` | developer.adzuna.com | ✅ 250 req/day |
| `RESEND_API_KEY` | resend.com | ✅ 3,000 emails/mo |
| `TWILIO_*` | twilio.com | ✅ $15 free credit |
| `STRIPE_*` | dashboard.stripe.com | ✅ No monthly fee |

---

## ✨ Unique Features

| Feature | Status | No competitor has this |
|---------|--------|----------------------|
| Ghost Job Detection | ✅ | Scores every job before showing it |
| Explainable AI Match | ✅ | Not "87%" — WHY 87% with dimensions |
| India → Europe Intelligence | ✅ | CTC→EUR, visa pathways, EU resume guide |
| Legal sources only | ✅ | No ToS violations |
| GDPR compliant | ✅ | Consent, export, deletion |
| Human-in-loop apply | ✅ | Quality > volume |

---

## 🏗 Architecture

```
autoapply-ai/
├── backend/                    Node.js + Express API
│   ├── src/
│   │   ├── config/             Database, Groq, Cloudinary
│   │   ├── controllers/        Auth, Resume, Jobs, Automation
│   │   ├── middleware/         Auth, Rate limit, Error, Upload, Validate
│   │   ├── models/             User, Resume, JobListing, JobApplication, AutomationSession
│   │   ├── routes/             8 route groups
│   │   ├── services/
│   │   │   ├── ai/             Groq, Resume parser/optimizer, Job matcher, Cover letter
│   │   │   ├── intelligence/   Ghost job detection, India→Europe intelligence
│   │   │   ├── jobs/           Remotive, Himalayas, Arbeitnow, Adzuna scrapers
│   │   │   ├── notifications/  Email (Resend), WhatsApp (Twilio)
│   │   │   └── automation/     Engine, Scheduler, SSE watcher
│   │   └── utils/              Logger, API response, Constants
│   └── Dockerfile
│
├── frontend/                   Angular 17+ SPA
│   ├── src/app/
│   │   ├── core/               Auth guard, Interceptors, Services
│   │   ├── features/           13 page components
│   │   └── shared/             Icon, Button, Sidebar, Ghost score, GDPR consent
│   ├── nginx.conf
│   └── Dockerfile
│
├── .github/workflows/          CI/CD — security audit + deploy
├── docker-compose.yml
└── README.md
```

---

## 🔒 Security

- JWT with 15-min access tokens + 7-day refresh tokens
- bcrypt with 12 rounds for password hashing
- Brute force protection (5 attempts → 15-min lockout)
- Rate limiting per endpoint tier
- Input sanitization (XSS prevention)
- CORS restricted to frontend domain only
- Helmet.js security headers
- No stack traces in production responses
- GDPR consent stored with timestamp + IP
- Non-root Docker user
- GitHub secrets scanning in CI

---

## 📋 Job Sources

There are two separate discovery pipelines, not one:

**Auto-apply pipeline** (jobs the app can apply to on your behalf):

| Source | Type | Key required |
|--------|------|-------------|
| Remotive | Remote global | No |
| Himalayas | Remote global | No |
| Arbeitnow | EU / Germany | No |
| Adzuna | India + global | Free key |

**Alert-only pipeline** (surfaces listings for you to apply to manually; never auto-applies): the four sources above, **plus**:

| Source | Type | Key required | Plan | Status (verified 2026-08-22) |
|--------|------|-------------|------|---|
| Indeed | Public RSS feed | No | All plans | ⚠️ Reliability uncertain — Indeed has been widely reported to be deprecating RSS support region by region. |
| Google Jobs (via SerpAPI) | Paid search API | Free key (250/mo) | All plans | ✅ Verified sound |
| LinkedIn | Paid provider (Techmap, via RapidAPI) | Yes | **Starter/Pro/Elite only** | ✅ Real paid API — see below |
| Naukri | Paid provider (Techmap, via RapidAPI) | Yes | **Starter/Pro/Elite only** | ✅ Real paid API — see below |

**LinkedIn and Naukri were previously scraped directly** — the LinkedIn scraper spoofed a Googlebot User-Agent to bypass LinkedIn's own bot detection, and the Naukri scraper hit an undocumented internal API that was very likely already broken (a required signed session token it never sent). Both were flagged as real legal and technical risk. **Session 39 (2026-08-22) replaced both with a real paid data provider** — Techmap's Job Postings API, accessed via RapidAPI, which covers LinkedIn, Naukri, Indeed, and 100+ other boards through one documented, normalized endpoint. See `backend/src/services/jobs/techmap.scraper.js` for the integration and its header comment for what's been verified against public documentation vs. what still needs confirming against a live subscription (RapidAPI provides an authoritative code sample once you subscribe).

**LinkedIn/Naukri coverage is gated to paid plans (Starter, Pro, Elite) — not Free.** This is enforced the same way every other plan-gated feature in this app is (see `backend/src/config/featureFlags.service.js` and `plans.config.js`), including correctly unlocking for everyone if the admin panel's Payments toggle is ever switched off.

Setup: subscribe to Techmap's "Job Postings API" on RapidAPI and set `TECHMAP_RAPIDAPI_KEY` — see `.env.example`. Without it, LinkedIn/Naukri silently return no results for paid users (fails soft, same convention as every other optional source here).

---

## 🛠 Admin Control Panel

Any user with `role: 'admin'` gets a `/admin` panel (also gated server-side
— every admin endpoint requires a verified admin session, not just a
hidden frontend route). Beyond stats, user search, and a per-user "customer
360" detail view, it includes real, backend-enforced controls added in
Session 37:

- **Features tab** — two toggles, both fully enforced, not just cosmetic:
  - **Payments**: off makes the entire product free for every user right
    now — checkout and the billing portal are blocked, and every plan-gated
    limit (daily application cap, job sources, real-time watching) treats
    every user as top-tier. Nothing about stored user data is touched;
    flipping it back on reverts everything immediately.
  - **Referrals**: off stops new signups from applying a referral code and
    hides the referral program's UI. Existing reward history is untouched.
- **Coupons tab** — real Stripe coupons + promotion codes. Create a
  percent-off or amount-off code with once/repeating/forever duration,
  optional max redemptions and expiry; customers enter it directly in
  Stripe's own hosted checkout UI. Coupons can't be deleted once redeemed
  (a Stripe constraint), only deactivated — the UI reflects that.

Both toggles read live from the database on every request (see
`backend/src/config/featureFlags.service.js`), with a short cache so this
doesn't add a DB round-trip to every single request. See that file's header
comment for exactly which call sites check it.

## 📄 License
MIT — see LICENSE file.
