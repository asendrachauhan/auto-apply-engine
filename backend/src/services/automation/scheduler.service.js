'use strict';
const cron   = require('node-cron');
const User   = require('../../models/User');
const AutomationSession = require('../../models/AutomationSession');
const { runForUser }    = require('./automationEngine.service');
const { AUTO_SESSION_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

const startScheduler = () => {
  // Main automation run — every 6 hours
  cron.schedule(process.env.CRON_SCHEDULE || '0 */6 * * *', async () => {
    logger.info('Scheduler: starting automation for active users');
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
    } catch (err) { logger.error(`Scheduler failed: ${err.message}`); }
  });

  logger.info('Automation scheduler started');
};

module.exports = { startScheduler };
