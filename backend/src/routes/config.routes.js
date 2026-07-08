'use strict';
const express = require('express');
const router  = express.Router();
const { getPublicPlansConfig } = require('../config/plans.config');
const { sendSuccess } = require('../utils/apiResponse');
const { HTTP } = require('../utils/constants');

/**
 * GET /api/config/plans — public plan catalog (pricing, features, trial
 * length). Driven entirely by env vars in config/plans.config.js — change
 * pricing or feature copy there without touching any other code.
 */
router.get('/plans', (req, res) => {
  return sendSuccess(res, HTTP.OK, 'Plans', getPublicPlansConfig());
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
