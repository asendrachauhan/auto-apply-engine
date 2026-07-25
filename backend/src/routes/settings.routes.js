'use strict';
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User  = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP } = require('../utils/constants');

// GET /api/settings
router.get('/', protect, async (req, res) =>
  sendSuccess(res, HTTP.OK, 'Settings', { preferences: req.user.preferences, notificationSettings: req.user.notificationSettings })
);

// PUT /api/settings/preferences
router.put('/preferences', protect, async (req, res, next) => {
  try {
    const { preferences, notificationSettings, automationActive, onboardingComplete, dailyApplyLimit } = req.body;
    const update = {};
    if (preferences)          update.preferences          = { ...req.user.preferences?.toObject?.() || {}, ...preferences };
    if (notificationSettings) update.notificationSettings = { ...req.user.notificationSettings?.toObject?.() || {}, ...notificationSettings };
    if (automationActive !== undefined)   update.automationActive   = Boolean(automationActive);
    if (onboardingComplete !== undefined) update.onboardingComplete = Boolean(onboardingComplete);
    if (dailyApplyLimit)      update.dailyApplyLimit = Math.min(Math.max(Number(dailyApplyLimit), 1), req.user.planLimits.dailyApply);
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true });
    return sendSuccess(res, HTTP.OK, 'Settings saved', user);
  } catch (err) { next(err); }
});

// GET /api/settings/data-export (GDPR)
router.get('/data-export', protect, async (req, res, next) => {
  try {
    const [user, applications] = await Promise.all([
      require('../models/User').findById(req.user._id),
      require('../models/JobApplication').find({ userId: req.user._id }),
    ]);
    const exportData = {
      exportDate:   new Date().toISOString(),
      exportVersion: '1.0',
      user: { name: user.name, email: user.email, createdAt: user.createdAt, plan: user.plan, preferences: user.preferences },
      gdprConsent:  user.gdprConsent,
      applications: applications.map(a => ({ jobTitle: a.jobTitle, company: a.company, status: a.status, appliedAt: a.appliedAt, matchScore: a.matchScore })),
    };
    res.setHeader('Content-Disposition', 'attachment; filename="autoapply-data-export.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.json(exportData);
  } catch (err) { next(err); }
});

module.exports = router;
