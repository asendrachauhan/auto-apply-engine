'use strict';
const express  = require('express');
const router   = express.Router();
const { protect, requireVerifiedEmail } = require('../middleware/auth.middleware');
const { autoLimiter } = require('../middleware/rateLimit.middleware');
const AutomationSession = require('../models/AutomationSession');
const User  = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP, AUTO_SESSION_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

// POST /api/automation/start
router.post('/start', protect, requireVerifiedEmail, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { automationActive: true });
    logger.info(`Automation started: ${req.user.email}`);
    return sendSuccess(res, HTTP.OK, 'Automation activated');
  } catch (err) { next(err); }
});

// POST /api/automation/stop
router.post('/stop', protect, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { automationActive: false });
    return sendSuccess(res, HTTP.OK, 'Automation paused');
  } catch (err) { next(err); }
});

// POST /api/automation/run-now (rate limited: 1/hour)
router.post('/run-now', protect, requireVerifiedEmail, autoLimiter, async (req, res, next) => {
  try {
    const session = await AutomationSession.create({ userId: req.user._id, status: AUTO_SESSION_STATUS.RUNNING });
    // Trigger async — don't await
    require('../services/automation/automationEngine.service').runForUser(req.user._id, session._id)
      .catch(err => logger.error(`Manual run failed for ${req.user._id}: ${err.message}`));
    return sendSuccess(res, HTTP.OK, 'Automation run started', { sessionId: session._id });
  } catch (err) { next(err); }
});

// GET /api/automation/status
router.get('/status', protect, async (req, res, next) => {
  try {
    const session = await AutomationSession.findOne({ userId: req.user._id }).sort({ startedAt: -1 });
    return sendSuccess(res, HTTP.OK, 'Automation status', {
      active:      req.user.automationActive,
      lastSession: session,
    });
  } catch (err) { next(err); }
});

// GET /api/automation/history
router.get('/history', protect, async (req, res, next) => {
  try {
    const sessions = await AutomationSession.find({ userId: req.user._id }).sort({ startedAt: -1 }).limit(30);
    return sendSuccess(res, HTTP.OK, 'Automation history', sessions);
  } catch (err) { next(err); }
});

module.exports = router;
