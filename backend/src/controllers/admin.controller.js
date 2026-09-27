/**
 * Admin Controller.
 * Everything behind `protect, requireAdmin` in routes/admin.routes.js.
 * Read-heavy (stats, user lookups) plus a narrow set of live-editable
 * settings via the SystemSetting DB-override layer — see
 * config/systemSettings.service.js for how those merge with env defaults.
 */
'use strict';
const User             = require('../models/User');
const JobApplication    = require('../models/JobApplication');
const JobAlert          = require('../models/JobAlert');
const Resume             = require('../models/Resume');
const ReferralReward    = require('../models/ReferralReward');
const SystemSetting    = require('../models/SystemSetting');
const { getAllSettings, setSetting, deleteSetting } = require('../config/systemSettings.service');
const { getFlags, setPaymentsEnabled, setReferralsEnabled } = require('../config/featureFlags.service');
const { getStripe } = require('../config/stripe');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');
const { PLANS_CONFIG }  = require('../config/plans.config');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { HTTP, PLAN } = require('../utils/constants');
const logger = require('../utils/logger');
const audit  = require('../services/audit/auditLog.service');

/** GET /api/admin/stats — platform-wide overview */
const getStats = async (req, res, next) => {
  try {
    const [
      totalUsers, verifiedUsers, usersByPlan, totalApplications,
      totalAlerts, totalResumes, activeAutomation, newUsers7d,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ emailVerified: true }),
      User.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
      JobApplication.countDocuments(),
      JobAlert.countDocuments(),
      Resume.countDocuments(),
      User.countDocuments({ automationActive: true }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    ]);

    const planCounts = Object.fromEntries(Object.values(PLAN).map(p => [p, 0]));
    usersByPlan.forEach(p => { planCounts[p._id] = p.count; });

    // Rough MRR estimate from current plan distribution — informational only,
    // does not account for trials, proration, or churn mid-cycle.
    const mrr = Object.entries(planCounts).reduce(
      (sum, [plan, count]) => sum + (PLANS_CONFIG[plan]?.price || 0) * count, 0
    );

    return sendSuccess(res, HTTP.OK, 'Platform stats', {
      totalUsers, verifiedUsers, newUsers7d,
      usersByPlan: planCounts,
      totalApplications, totalAlerts, totalResumes,
      activeAutomationUsers: activeAutomation,
      estimatedMrr: mrr, currency: PLANS_CONFIG.free ? (process.env.PLAN_CURRENCY || 'INR') : 'INR',
    });
  } catch (err) { next(err); }
};

/** GET /api/admin/users — searchable, paginated user list */
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', plan, role } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    if (plan) filter.plan = plan;
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select('name email plan role emailVerified automationActive totalApplications createdAt')
        .lean(),
      User.countDocuments(filter),
    ]);

    return sendPaginated(res, users, page, limit, total);
  } catch (err) { next(err); }
};

/** GET /api/admin/users/:id — customer 360 detail view */
const getUserDetail = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, HTTP.NOT_FOUND, 'User not found');

    const [
      resume, applicationCounts, alertCount, referralsMade, referralRewards, referredByUser,
    ] = await Promise.all([
      Resume.findOne({ userId: user._id }).select('originalFileName version updatedAt').lean(),
      JobApplication.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      JobAlert.countDocuments({ userId: user._id }),
      User.countDocuments({ referredBy: user._id }),
      ReferralReward.find({ referrerId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
      user.referredBy ? User.findById(user.referredBy).select('name email referralCode').lean() : null,
    ]);

    return sendSuccess(res, HTTP.OK, 'User detail', {
      user,
      resume: resume || null,
      applicationsByStatus: Object.fromEntries(applicationCounts.map(a => [a._id, a.count])),
      totalAlerts: alertCount,
      referral: {
        code: user.referralCode,
        points: user.referralPoints,
        referredCount: referralsMade,
        referredBy: referredByUser,
        recentRewards: referralRewards,
      },
    });
  } catch (err) { next(err); }
};

/** PATCH /api/admin/users/:id — edit plan/role/dailyApplyLimit from the panel */
const updateUser = async (req, res, next) => {
  try {
    const { plan, role, dailyApplyLimit, automationActive } = req.body;
    const update = {};
    if (plan && Object.values(PLAN).includes(plan)) update.plan = plan;
    if (role && ['user', 'admin'].includes(role)) update.role = role;
    if (dailyApplyLimit !== undefined) update.dailyApplyLimit = Math.max(1, Number(dailyApplyLimit));
    if (automationActive !== undefined) update.automationActive = Boolean(automationActive);

    if (req.params.id === req.user._id.toString() && role && role !== 'admin') {
      return sendError(res, HTTP.BAD_REQUEST, "You can't remove your own admin access.");
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!user) return sendError(res, HTTP.NOT_FOUND, 'User not found');

    audit.record({
      action: 'admin_user_updated', userId: user._id, actorId: req.user._id, req,
      metadata: { changedFields: Object.keys(update) },
    });
    logger.info(`[Admin] ${req.user.email} updated user ${user.email}: ${JSON.stringify(update)}`);
    return sendSuccess(res, HTTP.OK, 'User updated', user);
  } catch (err) { next(err); }
};

/** GET /api/admin/settings — current SystemSetting overrides */
const getSettings = async (req, res, next) => {
  try {
    const overrides = await getAllSettings();
    return sendSuccess(res, HTTP.OK, 'System settings', {
      overrides,
      // Also return the coded/env defaults so the admin UI can show
      // "current effective value" vs "override" side by side.
      planDefaults: PLANS_CONFIG,
    });
  } catch (err) { next(err); }
};

/** PUT /api/admin/settings/:key — upsert a single override */
const putSetting = async (req, res, next) => {
  try {
    const { value, category } = req.body;
    if (value === undefined) return sendError(res, HTTP.BAD_REQUEST, 'value is required');
    const setting = await setSetting(req.params.key, value, category || 'general', req.user._id);
    return sendSuccess(res, HTTP.OK, 'Setting saved', setting);
  } catch (err) { next(err); }
};

/** DELETE /api/admin/settings/:key — revert to the env/coded default */
const removeSetting = async (req, res, next) => {
  try {
    await deleteSetting(req.params.key);
    return sendSuccess(res, HTTP.OK, 'Setting reverted to default');
  } catch (err) { next(err); }
};

// ── Feature flags (Session 37) ──────────────────────────────────────────────
// Dedicated endpoints rather than the generic settings path above, because
// these need to invalidate featureFlags.service's in-memory cache
// immediately on write — going through the generic setSetting() directly
// would leave the old value live for up to FEATURE_FLAG_CACHE_TTL_SECONDS.

/** GET /api/admin/features — current real, enforced toggle state */
const getFeatureFlagsAdmin = async (req, res, next) => {
  try {
    return sendSuccess(res, HTTP.OK, 'Feature flags', await getFlags());
  } catch (err) { next(err); }
};

/** PUT /api/admin/features — body: { paymentsEnabled?, referralsEnabled? } */
const putFeatureFlags = async (req, res, next) => {
  try {
    const { paymentsEnabled, referralsEnabled } = req.body;
    if (paymentsEnabled === undefined && referralsEnabled === undefined) {
      return sendError(res, HTTP.BAD_REQUEST, 'Provide paymentsEnabled and/or referralsEnabled');
    }
    if (paymentsEnabled !== undefined) {
      await setPaymentsEnabled(paymentsEnabled, req.user._id);
      logger.info(`[Admin] ${req.user.email} set payments.enabled = ${Boolean(paymentsEnabled)}`);
      audit.record({
        action: 'admin_payments_toggled', actorId: req.user._id, req,
        metadata: { enabled: Boolean(paymentsEnabled) },
      });
    }
    if (referralsEnabled !== undefined) {
      await setReferralsEnabled(referralsEnabled, req.user._id);
      logger.info(`[Admin] ${req.user.email} set referrals.enabled = ${Boolean(referralsEnabled)}`);
      audit.record({
        action: 'admin_referrals_toggled', actorId: req.user._id, req,
        metadata: { enabled: Boolean(referralsEnabled) },
      });
    }
    return sendSuccess(res, HTTP.OK, 'Feature flags updated', await getFlags());
  } catch (err) { next(err); }
};

// ── Coupons (Session 37) — real Stripe coupons + promotion codes ───────────
// A Stripe "coupon" is the underlying discount definition (percent/amount
// off, duration); a "promotion code" is the human-typeable code customers
// actually enter (e.g. "WELCOME20") that redeems a coupon. We always create
// both together so the admin only ever has to think in terms of one
// redeemable code. Checkout sessions have `allow_promotion_codes: true`
// (see subscription.routes.js) so any active code created here works
// immediately in Stripe's own hosted checkout UI — no extra wiring needed.

/** GET /api/admin/coupons — list active + recent promotion codes */
const listCoupons = async (req, res, next) => {
  try {
    const s = getStripe();
    if (!s) {
      return sendSuccess(res, HTTP.OK, 'Coupons (Stripe key not configured)', []);
    }

    const result = await s.promotionCodes.list({ limit: 100, expand: ['data.coupon'] });
    const coupons = result.data.map(pc => ({
      id:              pc.id,
      code:            pc.code,
      active:          pc.active,
      timesRedeemed:   pc.times_redeemed,
      maxRedemptions:  pc.max_redemptions,
      expiresAt:       pc.expires_at ? new Date(pc.expires_at * 1000) : null,
      createdAt:       new Date(pc.created * 1000),
      percentOff:      pc.coupon?.percent_off ?? null,
      amountOff:       pc.coupon?.amount_off ? pc.coupon.amount_off / 100 : null,
      currency:        pc.coupon?.currency || null,
      duration:        pc.coupon?.duration || null,
      durationInMonths:pc.coupon?.duration_in_months ?? null,
    }));
    return sendSuccess(res, HTTP.OK, 'Coupons', coupons);
  } catch (err) {
    if (err.type === 'StripeAuthenticationError' || err.statusCode === 401 || err.type?.startsWith('Stripe')) {
      logger.warn(`[Admin Coupons] Stripe unavailable or invalid key: ${err.message}`);
      return sendSuccess(res, HTTP.OK, 'Coupons unavailable (Stripe key invalid or unconfigured)', []);
    }
    next(err);
  }
};

/**
 * POST /api/admin/coupons
 * body: { code, percentOff? , amountOff?, duration ('once'|'repeating'|'forever'),
 *         durationInMonths? (required if duration='repeating'),
 *         maxRedemptions?, expiresAt? (ISO date) }
 * Exactly one of percentOff/amountOff is required. amountOff is in the
 * plan's currency's major unit (e.g. 100 = ₹100), converted to the
 * smallest unit for Stripe here, same convention as the referral-points
 * discount in subscription.routes.js.
 */
const createCoupon = async (req, res, next) => {
  try {
    const s = getStripe();
    if (!s) return sendError(res, HTTP.SERVER_ERROR, 'Stripe is not configured (STRIPE_SECRET_KEY unset)');

    const { code, percentOff, amountOff, duration = 'once', durationInMonths, maxRedemptions, expiresAt } = req.body;

    if (!code || !/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
      return sendError(res, HTTP.BAD_REQUEST, 'code is required: 3-40 characters, letters/numbers/underscore/hyphen only');
    }
    const hasPercent = percentOff !== undefined && percentOff !== null && percentOff !== '';
    const hasAmount  = amountOff  !== undefined && amountOff  !== null && amountOff  !== '';
    if (hasPercent === hasAmount) {
      return sendError(res, HTTP.BAD_REQUEST, 'Provide exactly one of percentOff or amountOff');
    }
    if (hasPercent && (Number(percentOff) <= 0 || Number(percentOff) > 100)) {
      return sendError(res, HTTP.BAD_REQUEST, 'percentOff must be between 1 and 100');
    }
    if (hasAmount && Number(amountOff) <= 0) {
      return sendError(res, HTTP.BAD_REQUEST, 'amountOff must be greater than 0');
    }
    if (!['once', 'repeating', 'forever'].includes(duration)) {
      return sendError(res, HTTP.BAD_REQUEST, "duration must be 'once', 'repeating', or 'forever'");
    }
    if (duration === 'repeating' && !(Number(durationInMonths) > 0)) {
      return sendError(res, HTTP.BAD_REQUEST, 'durationInMonths is required (and must be > 0) when duration is "repeating"');
    }

    const couponPayload = {
      duration,
      ...(duration === 'repeating' ? { duration_in_months: Number(durationInMonths) } : {}),
      ...(hasPercent ? { percent_off: Number(percentOff) } : { amount_off: Math.round(Number(amountOff) * 100), currency: (process.env.PLAN_CURRENCY || 'INR').toLowerCase() }),
      name: `Admin coupon: ${code.toUpperCase()}`,
    };
    const coupon = await s.coupons.create(couponPayload);

    const promoPayload = {
      coupon: coupon.id,
      code:   code.toUpperCase(),
      ...(maxRedemptions ? { max_redemptions: Number(maxRedemptions) } : {}),
      ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
    };
    const promotionCode = await s.promotionCodes.create(promoPayload);

    logger.info(`[Admin] ${req.user.email} created coupon ${promotionCode.code} (${hasPercent ? percentOff + '%' : amountOff + ' off'}, ${duration})`);
    audit.record({
      action: 'admin_coupon_created', actorId: req.user._id, req,
      metadata: { code: promotionCode.code, discount: hasPercent ? `${percentOff}%` : `${amountOff} off`, duration },
    });
    return sendSuccess(res, HTTP.CREATED, 'Coupon created', {
      id: promotionCode.id, code: promotionCode.code, couponId: coupon.id,
    });
  } catch (err) {
    // Stripe throws its own typed errors (e.g. a duplicate code) — surface
    // the real message rather than a generic 500 so the admin knows why.
    if (err.type?.startsWith('Stripe')) return sendError(res, HTTP.BAD_REQUEST, err.message);
    next(err);
  }
};

/** PATCH /api/admin/coupons/:id/deactivate — Stripe coupons can't be
 * deleted once a promotion code has redemptions against them, so
 * deactivating the promotion code (not deleting the coupon) is the
 * correct, real-world way to turn one off. */
const deactivateCoupon = async (req, res, next) => {
  try {
    const s = getStripe();
    if (!s) return sendError(res, HTTP.SERVER_ERROR, 'Stripe is not configured (STRIPE_SECRET_KEY unset)');
    const promotionCode = await s.promotionCodes.update(req.params.id, { active: false });
    logger.info(`[Admin] ${req.user.email} deactivated coupon ${promotionCode.code}`);
    audit.record({
      action: 'admin_coupon_deactivated', actorId: req.user._id, req,
      metadata: { code: promotionCode.code },
    });
    return sendSuccess(res, HTTP.OK, 'Coupon deactivated', { id: promotionCode.id, code: promotionCode.code });
  } catch (err) {
    if (err.type?.startsWith('Stripe')) return sendError(res, HTTP.BAD_REQUEST, err.message);
    next(err);
  }
};

/** POST /api/admin/brand-logo — Upload and activate a custom brand logo */
const uploadBrandLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, HTTP.BAD_REQUEST, 'Please upload a logo file');
    }

    let logoUrl = '';
    const cl = cloudinary.getClient();
    if (cl) {
      try {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataUri = `data:${req.file.mimetype};base64,${b64}`;
        const uploadRes = await cl.uploader.upload(dataUri, {
          folder: 'brand',
          public_id: 'custom_brand_logo',
          overwrite: true,
          resource_type: 'auto',
        });
        logoUrl = uploadRes.secure_url;
      } catch (cloudErr) {
        logger.warn(`[Admin] Cloudinary logo upload failed: ${cloudErr.message}`);
      }
    }

    if (!logoUrl) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      logoUrl = `data:${req.file.mimetype};base64,${b64}`;

      try {
        const ext = req.file.mimetype.includes('svg') ? '.svg' : req.file.mimetype.includes('png') ? '.png' : '.webp';
        const targetDir = path.resolve(__dirname, '../../../frontend/src/assets/logos');
        if (fs.existsSync(targetDir)) {
          const targetPath = path.join(targetDir, 'custom-brand-logo' + ext);
          fs.writeFileSync(targetPath, req.file.buffer);
          logoUrl = `assets/logos/custom-brand-logo${ext}?t=${Date.now()}`;
        }
      } catch (fsErr) {
        logger.debug(`[Admin] Local filesystem logo write note: ${fsErr.message}`);
      }
    }

    await setSetting('brand.customLogoUrl', logoUrl, 'brand', req.user._id);

    audit.record({
      action: 'admin_brand_logo_updated', actorId: req.user._id, req,
      metadata: { logoUrl },
    });

    return sendSuccess(res, HTTP.OK, 'Brand logo uploaded successfully', { logoUrl });
  } catch (err) {
    next(err);
  }
};

/** GET /api/admin/brand-logo — Retrieve the active custom brand logo */
const getBrandLogo = async (req, res, next) => {
  try {
    const doc = await SystemSetting.findOne({ key: 'brand.customLogoUrl' }).lean();
    return sendSuccess(res, HTTP.OK, 'Custom brand logo', { logoUrl: doc ? doc.value : null });
  } catch (err) { next(err); }
};

/** DELETE /api/admin/brand-logo — Revert custom logo back to default */
const deleteBrandLogo = async (req, res, next) => {
  try {
    await deleteSetting('brand.customLogoUrl');
    audit.record({ action: 'admin_brand_logo_reset', actorId: req.user._id, req });
    return sendSuccess(res, HTTP.OK, 'Brand logo reset to system default');
  } catch (err) { next(err); }
};

module.exports = {
  getStats, getUsers, getUserDetail, updateUser, getSettings, putSetting, removeSetting,
  getFeatureFlagsAdmin, putFeatureFlags, listCoupons, createCoupon, deactivateCoupon,
  uploadBrandLogo, getBrandLogo, deleteBrandLogo,
};
