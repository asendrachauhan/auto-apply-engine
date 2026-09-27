'use strict';
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { optimizeProfile, extractCleanString } = require('../services/ai/linkedInOptimizer.service');
const { fetchLinkedInProfile } = require('../services/linkedin/linkedInFetcher.service');
const Resume = require('../models/Resume');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * POST /api/linkedin/fetch
 * Fetches public LinkedIn profile details from a LinkedIn URL and structures them via Groq AI.
 * Request body: { url }
 */
router.post('/fetch', protect, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      return sendError(res, HTTP.BAD_REQUEST, 'Please provide a LinkedIn profile URL.');
    }
    const profile = await fetchLinkedInProfile(url);
    return sendSuccess(res, HTTP.OK, 'LinkedIn profile data fetched successfully', profile);
  } catch (err) {
    logger.warn(`[LinkedIn] Profile fetch failed: ${err.message}`);
    return sendError(res, HTTP.BAD_REQUEST, err.message);
  }
});

/**
 * GET /api/linkedin/from-resume
 * Auto-populates LinkedIn fields directly from the candidate's existing resume.
 */
router.get('/from-resume', protect, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume || !resume.parsedData) {
      return sendError(res, HTTP.NOT_FOUND, 'No resume profile found. Please upload your resume first or paste a LinkedIn URL.');
    }
    const data = resume.parsedData;
    const bullets = [];
    if (Array.isArray(data.experience)) {
      for (const exp of data.experience) {
        if (Array.isArray(exp.bullets)) {
          bullets.push(...exp.bullets.slice(0, 2));
        } else if (exp.summary) {
          bullets.push(exp.summary);
        }
      }
    }
    const targetRoles = (Array.isArray(data.targetRoles) ? data.targetRoles : [])
      .map(r => extractCleanString(r))
      .filter(Boolean);
    const rawRole = data.experience?.[0]?.title || targetRoles[0] || '';
    const currentRole = extractCleanString(rawRole, 'Software Engineer');
    const headline = currentRole ? `${currentRole} | Specialist` : (extractCleanString(data.summary)?.slice(0, 100) || '');

    return sendSuccess(res, HTTP.OK, 'Profile data loaded from resume', {
      headline: headline.slice(0, 120),
      about: extractCleanString(data.summary) || '',
      experienceBullets: bullets.map(b => extractCleanString(b)).filter(Boolean).slice(0, 5),
      currentRole,
      targetRoles,
      fullName: extractCleanString(data.fullName) || '',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/linkedin/optimize
 * Takes a user's LinkedIn profile sections and returns AI-optimized suggestions.
 * Request body: { headline, about, experienceBullets, currentRole?, targetRoles?, industry? }
 * Response: { headline, about, experienceBullets, linkedInScore, improvements, keywordsAdded, tips }
 */
router.post('/optimize', protect, async (req, res, next) => {
  try {
    const { headline, about, experienceBullets, currentRole, targetRoles, industry } = req.body;

    // Validation: at least one section provided
    if (!headline && !about && (!experienceBullets || experienceBullets.length === 0)) {
      return sendError(res, HTTP.BAD_REQUEST, 
        'Please provide at least a headline, about section, or experience bullets to optimize.');
    }

    // Prepare profile object
    const profile = {
      headline: headline || '',
      about: about || '',
      experienceBullets: Array.isArray(experienceBullets) ? experienceBullets : [],
      ...(currentRole && { currentRole }),
      ...(targetRoles && Array.isArray(targetRoles) && { targetRoles }),
      ...(industry && { industry }),
    };

    logger.info(`[LinkedIn] Optimizing profile for user ${req.user._id}`);
    const optimized = await optimizeProfile(profile);

    return sendSuccess(res, HTTP.OK, 'LinkedIn profile optimized', optimized);
  } catch (err) {
    logger.error(`[LinkedIn] Optimization error: ${err.message}`);
    next(err);
  }
});

module.exports = router;
