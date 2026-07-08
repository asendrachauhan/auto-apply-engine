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
5. Deploy

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

## 📋 Job Sources (all legal)

| Source | Type | Key required |
|--------|------|-------------|
| Remotive | Remote global | No |
| Himalayas | Remote global | No |
| Arbeitnow | EU / Germany | No |
| Adzuna | India + global | Free key |

LinkedIn/Naukri/Indeed: **not scraped** — ToS violations + account bans. Ghost job alerts sent via WhatsApp for manual apply on those platforms.

---

## 📄 License
MIT — see LICENSE file.
