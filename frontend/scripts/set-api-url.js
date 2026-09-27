#!/usr/bin/env node
'use strict';

/**
 * Injects the real backend URL into environment.prod.ts at build time.
 *
 * WHY THIS EXISTS: environment.prod.ts previously had a hardcoded backend
 * URL with a comment claiming it was "Replaced by CI/CD with actual Railway
 * URL." That was never true — nothing in .github/workflows/deploy.yml or
 * anywhere else ever did that replacement. The GitHub Actions workflow's
 * "Deploy frontend to Vercel" step just triggers Vercel's OWN separate
 * build (via vercel-action) — it doesn't control what Angular compiles in.
 * The practical effect: any deployment whose real Railway backend URL
 * differs from that hardcoded placeholder would silently call the wrong
 * backend. Found and fixed as part of production-readiness review.
 *
 * HOW IT WORKS NOW: Vercel auto-detects and prefers a "vercel-build" script
 * in package.json over the plain "build" script (standard Vercel behavior
 * for Node-based frameworks — no vercel.json override needed). That script
 * runs this first, which reads the API_URL project environment variable
 * (set in the Vercel dashboard — see README's deploy instructions) and
 * rewrites environment.prod.ts before `ng build` compiles it in.
 *
 * SAFE BY DEFAULT: if API_URL isn't set (e.g. a local `npm run build`, or
 * a Vercel preview deploy that hasn't configured it yet), this leaves
 * environment.prod.ts untouched and just warns — it never blocks the
 * build or silently writes an empty/broken URL.
 */

const fs = require('fs');
const path = require('path');

const apiUrl = process.env.API_URL;
const envFilePath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

if (!apiUrl) {
  console.warn(
    '[set-api-url] API_URL environment variable is not set — leaving ' +
    'environment.prod.ts unchanged. Set API_URL in the Vercel dashboard ' +
    '(Project Settings → Environment Variables) to the base URL of your ' +
    'backend, e.g. https://your-app.up.railway.app (no trailing slash, no /api).'
  );
  process.exit(0);
}

const normalizedBase = apiUrl.trim().replace(/\/+$/, '');
const fullApiUrl = `${normalizedBase}/api`;

const content = `// AUTO-GENERATED at build time by scripts/set-api-url.js from the
// API_URL environment variable. Do not hand-edit this file's apiUrl —
// changes will be overwritten on the next build. To change the backend
// URL, update the API_URL environment variable in your deploy platform
// (Vercel dashboard → Project Settings → Environment Variables) instead.
export const environment = {
  production: true,
  apiUrl: '${fullApiUrl}',
};
`;

fs.writeFileSync(envFilePath, content, 'utf8');
console.log(`[set-api-url] environment.prod.ts apiUrl set to: ${fullApiUrl}`);
