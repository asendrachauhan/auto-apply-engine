'use strict';
const express = require('express');
const router  = express.Router();
const { getEffectivePlansConfig, getSetting } = require('../config/systemSettings.service');
const { getFlags } = require('../config/featureFlags.service');
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
 * GET /api/config/features — public feature-flag state (Session 37).
 * Deliberately unauthenticated: the registration page needs
 * `referralsEnabled` before a user has logged in (to decide whether to
 * show the referral-code field), and the marketing/landing page may want
 * `paymentsEnabled` too. Nothing sensitive here — just two booleans.
 */
router.get('/features', async (req, res, next) => {
  try {
    return sendSuccess(res, HTTP.OK, 'Feature flags', await getFlags());
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

/**
 * GET /api/config/brand — public brand config (custom logo override)
 */
router.get('/brand', async (req, res, next) => {
  try {
    const customLogoUrl = await getSetting('brand.customLogoUrl', null);
    return sendSuccess(res, HTTP.OK, 'Brand configuration', { customLogoUrl });
  } catch (err) { next(err); }
});

module.exports = router;
