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
const { getAllSettings, setSetting, deleteSetting } = require('../config/systemSettings.service');
const { PLANS_CONFIG }  = require('../config/plans.config');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { HTTP, PLAN } = require('../utils/constants');
const logger = require('../utils/logger');

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

module.exports = { getStats, getUsers, getUserDetail, updateUser, getSettings, putSetting, removeSetting };
