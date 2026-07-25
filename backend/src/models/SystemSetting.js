const mongoose = require('mongoose');

/**
 * Generic key/value override store, editable live from the Admin Panel.
 *
 * This sits ON TOP OF the existing env-driven defaults (config/plans.config.js,
 * config/groq.js, etc.) — it does not replace them. Every config reader
 * should keep its env-var + coded-default fallback exactly as-is, and only
 * consult SystemSetting for a value to override that default *if one has
 * been set*. See config/systemSettings.service.js for the read/write helpers
 * and config/plans.config.js's `getEffectivePlansConfig` for the pattern.
 *
 * Values are stored as Mixed so the same collection can hold numbers,
 * strings, booleans, or small objects/arrays (e.g. a plan's feature list).
 */
const systemSettingSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true, index: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },

  // Free-text so the admin UI can group/label settings without a rigid taxonomy.
  category: { type: String, default: 'general', trim: true },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
