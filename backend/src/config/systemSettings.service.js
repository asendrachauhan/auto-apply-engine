/**
 * SystemSetting DB-override layer.
 *
 * Every config value in this app already has a coded default and an
 * env-var override (see plans.config.js, groq.js). This module adds a
 * THIRD, highest-priority layer on top: a live, admin-editable override
 * stored in MongoDB, so pricing/features/limits can be changed from the
 * Admin Panel without touching `.env` or redeploying.
 *
 * Precedence: SystemSetting (DB) > env var > coded default.
 *
 * This module does not change how PLAN_LIMITS (utils/constants.js) is
 * computed at boot — that stays env-driven, exactly as documented, since
 * rewriting every call site that imports it synchronously is out of scope
 * here. What DB overrides affect is anything that reads through
 * `getEffectivePlansConfig()` below: the public /api/config/plans catalog
 * and the Admin Panel's own settings screen. A plan price changed in the
 * Admin Panel is reflected immediately on the pricing page; daily-apply
 * enforcement continues to use the env/coded value until env vars are
 * updated and the process restarts. This asymmetry is intentional and
 * documented rather than silently inconsistent — flag to the product
 * owner if enforcement needs to move onto this same layer later.
 */
'use strict';
const SystemSetting = require('../models/SystemSetting');
const { PLANS_CONFIG, getPublicPlansConfig } = require('./plans.config');
const logger = require('../utils/logger');

/** Read a single override, or fall back to the given default. */
const getSetting = async (key, fallback = null) => {
  try {
    const doc = await SystemSetting.findOne({ key }).lean();
    return doc ? doc.value : fallback;
  } catch (err) {
    logger.error(`[SystemSetting] getSetting(${key}) failed: ${err.message}`);
    return fallback;
  }
};

/** Fetch all overrides as a { key: value } map — used to merge in bulk. */
const getAllSettings = async () => {
  try {
    const docs = await SystemSetting.find().lean();
    return Object.fromEntries(docs.map(d => [d.key, d.value]));
  } catch (err) {
    logger.error(`[SystemSetting] getAllSettings failed: ${err.message}`);
    return {};
  }
};

/** Upsert an override. `updatedBy` is the admin user's _id, for the audit trail. */
const setSetting = async (key, value, category = 'general', updatedBy = null) => {
  return SystemSetting.findOneAndUpdate(
    { key },
    { value, category, updatedBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const deleteSetting = async (key) => {
  return SystemSetting.findOneAndDelete({ key });
};

/**
 * Plan catalog with DB overrides applied. Override keys follow the pattern
 * `plan.<planId>.<field>` for price/features/dailyApply/popular, e.g.
 * `plan.pro.price` -> 599. Falls back to the env-driven PLANS_CONFIG value
 * whenever no override exists for a given field.
 */
const getEffectivePlansConfig = async () => {
  const overrides = await getAllSettings();
  const base = getPublicPlansConfig();

  const plans = base.plans.map(p => {
    const price      = overrides[`plan.${p.id}.price`];
    const features    = overrides[`plan.${p.id}.features`];
    const popular     = overrides[`plan.${p.id}.popular`];
    const cta         = overrides[`plan.${p.id}.cta`];
    return {
      ...p,
      price:    price !== undefined ? Number(price) : p.price,
      features: Array.isArray(features) ? features : p.features,
      popular:  popular !== undefined ? Boolean(popular) : p.popular,
      cta:      cta !== undefined ? cta : p.cta,
    };
  });

  return { ...base, plans };
};

module.exports = { getSetting, getAllSettings, setSetting, deleteSetting, getEffectivePlansConfig, PLANS_CONFIG };
