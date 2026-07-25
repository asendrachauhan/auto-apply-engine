/**
 * Real-time job watcher for Pro/Elite users.
 *
 * Runs the same safe "find + prepare + notify" alert pipeline used by
 * job-alerts (jobAlertEngine.service.js), just on a much shorter interval
 * (1-2 min instead of every 6 hours) and pushed live over SSE. This does
 * NOT auto-apply on external platforms — matching the rest of the product's
 * "human-in-the-loop apply, legal sources only" model. An earlier version of
 * this service drove a Puppeteer-based auto-login-and-submit flow against
 * LinkedIn/Naukri/Indeed; that violated those platforms' Terms of Service
 * and contradicted the product's own stated architecture, so it has been
 * replaced with this approach.
 */

const JobWatch = require('../../models/JobWatch');
const User     = require('../../models/User');
const { runJobAlertPipeline } = require('../automation/jobAlertEngine.service');
const logger = require('../../utils/logger');

// ─── SSE client registry ──────────────────────────────────────────────────────
// Map<userId, Set<Response>>
const sseClients = new Map();

const addClient = (userId, res) => {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
  logger.debug(`SSE client added for user ${userId} (${sseClients.get(userId).size} total)`);
};

const removeClient = (userId, res) => {
  sseClients.get(userId)?.delete(res);
};

const pushToUser = (userId, event, data) => {
  const clients = sseClients.get(userId?.toString());
  if (!clients?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); }
    catch (e) { clients.delete(res); }
  }
};

// ─── Active watch intervals ───────────────────────────────────────────────────
// Map<userId, NodeJS.Timeout>
const activeWatchers = new Map();

/**
 * Run one watch cycle for a user — just the alert pipeline, pushed live.
 */
const runWatchCycle = async (userId) => {
  try {
    const watch = await JobWatch.findOne({ userId });
    if (!watch || !watch.active) return;

    pushToUser(userId, 'watch:scanning', { message: 'Scanning for new jobs…', ts: Date.now() });

    const stats = await runJobAlertPipeline(userId);

    watch.lastChecked   = new Date();
    watch.totalDetected = (watch.totalDetected || 0) + (stats.discovered || 0);
    watch.totalApplied  = (watch.totalApplied  || 0) + (stats.notified   || 0);
    await watch.save();

    if (stats.notified > 0) {
      pushToUser(userId, 'watch:new-jobs', { count: stats.notified, ts: Date.now() });
    }
  } catch (err) {
    logger.error(`[JobWatcher] Cycle error for user ${userId}: ${err.message}`);
  }
};

/**
 * Start real-time watcher for a user.
 * @param {string} userId
 * @param {number} intervalSeconds
 */
const startWatcher = async (userId, intervalSeconds = 120) => {
  if (activeWatchers.has(userId)) return; // already running

  logger.info(`[JobWatcher] Starting for user ${userId} (every ${intervalSeconds}s)`);

  await JobWatch.findOneAndUpdate(
    { userId },
    { active: true, checkInterval: intervalSeconds },
    { upsert: true }
  );

  // First run immediately
  runWatchCycle(userId);

  const interval = setInterval(() => runWatchCycle(userId), intervalSeconds * 1000);
  activeWatchers.set(userId, interval);
};

/**
 * Stop watcher for a user.
 */
const stopWatcher = async (userId) => {
  const interval = activeWatchers.get(userId);
  if (interval) {
    clearInterval(interval);
    activeWatchers.delete(userId);
  }
  await JobWatch.findOneAndUpdate({ userId }, { active: false });
  logger.info(`[JobWatcher] Stopped for user ${userId}`);
};

/**
 * Resume watchers for all Pro/Elite users on server restart.
 */
const resumeAllWatchers = async () => {
  try {
    const proUsers = await User.find({ plan: { $in: ['pro', 'elite'] } }).select('_id').lean();
    let resumed = 0;
    for (const u of proUsers) {
      const watch = await JobWatch.findOne({ userId: u._id, active: true });
      if (watch) {
        await startWatcher(u._id.toString(), watch.checkInterval);
        resumed++;
      }
    }
    logger.info(`[JobWatcher] Resumed ${resumed} watchers`);
  } catch (err) {
    logger.error(`[JobWatcher] Resume failed: ${err.message}`);
  }
};

module.exports = { startWatcher, stopWatcher, resumeAllWatchers, addClient, removeClient, pushToUser };
