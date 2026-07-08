'use strict';
const express = require('express');
const router  = express.Router();
const { protect }    = require('../middleware/auth.middleware');
const JobApplication = require('../models/JobApplication');
const { aggregateJobs } = require('../services/jobs/jobAggregator.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP, JOB_STATUS } = require('../utils/constants');

// GET /api/jobs/discover — fetch + ghost-filter new jobs
router.get('/discover', protect, async (req, res, next) => {
  try {
    const { euMode = false } = req.query;
    const { jobs, stats } = await aggregateJobs(req.user.preferences, { euMode: euMode === 'true' });
    return sendSuccess(res, HTTP.OK, 'Jobs discovered', jobs.slice(0, 50), stats);
  } catch (err) { next(err); }
});

// GET /api/jobs/applications — user's application history
router.get('/applications', protect, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { userId: req.user._id };
    if (status && Object.values(JOB_STATUS).includes(status)) filter.status = status;
    const [apps, total] = await Promise.all([
      JobApplication.find(filter).sort({ appliedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('jobListingId', 'ghostScore euMeta'),
      JobApplication.countDocuments(filter),
    ]);
    return sendSuccess(res, HTTP.OK, 'Applications', apps, { total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// PATCH /api/jobs/applications/:id/status
router.patch('/applications/:id/status', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!Object.values(JOB_STATUS).includes(status)) return sendError(res, HTTP.BAD_REQUEST, 'Invalid status');
    const app = await JobApplication.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status }, { new: true }
    );
    if (!app) return sendError(res, HTTP.NOT_FOUND, 'Application not found');
    return sendSuccess(res, HTTP.OK, 'Status updated', app);
  } catch (err) { next(err); }
});

module.exports = router;
