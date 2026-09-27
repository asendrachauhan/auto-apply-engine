export const environment = {
  production: true,
  // Placeholder — overwritten at Vercel build time by scripts/set-api-url.js
  // from the API_URL environment variable. See that script's header comment
  // for why this matters: this value used to be a stale hardcoded URL with
  // a comment falsely claiming CI/CD replaced it. Nothing did. Fixed in
  // production-readiness review — do not rely on this literal string being
  // correct for any real deployment; it's only accurate immediately after
  // a Vercel build with API_URL set.
  apiUrl: 'http://localhost:3000/api',
};
