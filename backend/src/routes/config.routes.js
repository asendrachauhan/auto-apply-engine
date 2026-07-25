'use strict';
const express = require('express');
const router  = express.Router();
const { getEffectivePlansConfig } = require('../config/systemSettings.service');
const { sendSuccess } = require('../utils/apiResponse');
const { HTTP } = require('../utils/constants');

/**
 * GET /api/config/plans — public plan catalog (pricing, features, trial
 * length). Driven by env vars in config/plans.config.js, with any live
 * Admin Panel overrides from SystemSetting applied on top — see
 * config/systemSettings.service.js#getEffectivePlansConfig.
 */
router.get('/plans', async (req, res, next) => {
  try {
    return sendSuccess(res, HTTP.OK, 'Plans', await getEffectivePlansConfig());
  } catch (err) { next(err); }
});

/**
 * GET /api/config/ai — informational only (which AI model is powering
 * features). Never exposes the API key.
 */
router.get('/ai', (req, res) => {
  return sendSuccess(res, HTTP.OK, 'AI config', {
    provider: process.env.AI_PROVIDER_LABEL || 'Groq',
    model: process.env.GROQ_MODEL || 'llama3-8b-8192',
  });
});

module.exports = router;
