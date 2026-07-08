# AutoApply AI

AI-powered job application platform with ghost job detection, India→Europe
career intelligence, and explainable match scores.

Imported as a MERN-style project (Angular frontend, Node/Express + MongoDB
backend) originally built for Railway (backend) + Vercel (frontend) +
MongoDB Atlas deployment. It has been set up to run natively on Replit
instead.

## Architecture

- `backend/` — Node.js + Express API (Mongoose/MongoDB, JWT auth, Groq AI,
  job-board scrapers, ghost-job detection, automation scheduler).
- `frontend/` — Angular 17 SPA, served via `ng serve` with a dev proxy that
  forwards `/api` to the backend.

## Running on Replit

Three workflows run together:

- **MongoDB** — local `mongod` instance, data stored in `.data/mongodb`
  (not a hosted Atlas cluster; this is dev-only local storage).
- **Backend** — `cd backend && npm run dev` (nodemon), listens on port 3000.
- **Frontend** — `cd frontend && npx ng serve`, listens on port 5000 (the
  one shown in the Replit preview). Its dev-server proxy forwards `/api`
  calls to the backend on port 3000.

Configuration lives in environment variables (Replit "shared" env), not in
a `.env` file — `JWT_SECRET`/`JWT_REFRESH_SECRET` were generated
automatically, `MONGODB_URI` points at the local Mongo instance, and
`FRONTEND_URL`/`APP_URL` are set to the Replit dev domain for CORS.

### Optional integrations (not configured — features degrade gracefully without them)

These are read from env vars but the app runs fine without them; the
related features are just disabled until keys are added:

- `GROQ_API_KEY` — AI resume parsing/optimization, job matching, cover letters.
- `CLOUDINARY_*` — resume/file uploads to Cloudinary.
- `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` — Adzuna job source.
- `RESEND_API_KEY` — email notifications.
- `TWILIO_*` — WhatsApp notifications.
- `STRIPE_*` — subscription billing.

Ask to add any of these later if you want that feature turned on.

## User preferences

None recorded yet.
