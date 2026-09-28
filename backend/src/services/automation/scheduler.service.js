'use strict';
const cron   = require('node-cron');
const User   = require('../../models/User');
const AutomationSession = require('../../models/AutomationSession');
const { runForUser }    = require('./automationEngine.service');
const { runForAllUsers } = require('./jobAlertEngine.service');
const { purgeExpiredAccounts } = require('./dataPurge.service');
const { AUTO_SESSION_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

const startScheduler = () => {
  // Main automation run & scraping — every 1 hour (0 * * * *)
  cron.schedule(process.env.CRON_SCHEDULE || '0 * * * *', async () => {
    logger.info('Scheduler: starting hourly automation & job discovery for active users');
    try {
      const users = await User.find({ automationActive: true }).select('_id email');
      logger.info(`Scheduler: ${users.length} active users`);
      for (const user of users) {
        try {
          const session = await AutomationSession.create({ userId: user._id, status: AUTO_SESSION_STATUS.RUNNING });
          await runForUser(user._id, session._id);
        } catch (e) { logger.error(`Scheduler error for ${user.email}: ${e.message}`); }
        await new Promise(r => setTimeout(r, 2000)); // 2s between users
      }

      // Also trigger hourly alert pipeline to surface newly published jobs to candidates
      runForAllUsers().catch(err => logger.warn(`[Scheduler] Hourly alert discovery failed: ${err.message}`));
    } catch (err) { logger.error(`Scheduler failed: ${err.message}`); }
  });

  // GDPR erasure purge — daily by default. Independent schedule from the
  // automation cron above since they serve unrelated purposes; no reason
  // to couple how often accounts get purged to how often job-matching runs.
  cron.schedule(process.env.PURGE_CRON_SCHEDULE || '0 3 * * *', async () => {
    logger.info('Scheduler: starting GDPR account purge');
    try {
      const { purged, failed } = await purgeExpiredAccounts();
      logger.info(`Scheduler: purge complete — ${purged} purged, ${failed} failed`);
    } catch (err) { logger.error(`Purge scheduler failed: ${err.message}`); }
  });

  logger.info('Automation scheduler started');
};

module.exports = { startScheduler };
