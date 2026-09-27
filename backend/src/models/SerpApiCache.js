const mongoose = require('mongoose');

/**
 * Caches SerpAPI Google Jobs query results, keyed by (searchTerm, location).
 *
 * Added Session 36 (2026-08-22) to fix a real, pre-existing bug: the
 * real-time job watcher (jobWatcher.service.js) calls discoverJobs() every
 * checkInterval (120s by default) for every active Pro/Elite user, and
 * discoverJobs() was calling scrapeGoogleJobs() unconditionally on every
 * single cycle with no caching or gating. SerpAPI's free tier is 250
 * searches/month — at a 120s cadence, ONE user watching continuously burns
 * the entire monthly quota in about 8 hours. This wasn't something "leaning
 * harder" on Google Jobs coverage could respond to by adding MORE calls; it
 * had to be fixed first.
 *
 * Job postings don't meaningfully change within a couple of minutes, so
 * caching the same (searchTerm, location) query for a while is not a loss
 * of freshness that matters in practice — it's the correct fix, not a
 * workaround. Query results found via CACHE_TTL_SECONDS (default 30 min,
 * `SERPAPI_CACHE_TTL_SECONDS` env override) are served from here instead of
 * hitting SerpAPI again.
 */
const serpApiCacheSchema = new mongoose.Schema({
  cacheKey:  { type: String, required: true, unique: true, index: true }, // `${searchTerm}::${location}`.toLowerCase()
  jobs:      { type: [mongoose.Schema.Types.Mixed], default: [] },
  fetchedAt: { type: Date, default: Date.now },
});

// TTL index — the cache entry itself expires and is cleaned up automatically;
// callers additionally check freshness against CACHE_TTL_SECONDS on read (see
// serpapi.scraper.js) so the effective TTL is controlled by env var without
// needing an index rebuild. This outer TTL is a generous backstop (2 hours)
// just to keep the collection from growing unbounded if the env var is ever
// raised above it.
serpApiCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 2 * 60 * 60 });

module.exports = mongoose.model('SerpApiCache', serpApiCacheSchema);
