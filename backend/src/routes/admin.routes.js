const express = require('express');
const router  = express.Router();
const {
  getStats, getUsers, getUserDetail, updateUser,
  getSettings, putSetting, removeSetting,
  getFeatureFlagsAdmin, putFeatureFlags,
  listCoupons, createCoupon, deactivateCoupon,
  uploadBrandLogo, getBrandLogo, deleteBrandLogo,
} = require('../controllers/admin.controller');
const { protect, requireAdmin } = require('../middleware/auth.middleware');
const { imageUpload } = require('../middleware/upload.middleware');

// Every route here requires a verified admin session.
router.use(protect, requireAdmin);

router.get('/stats',            getStats);
router.get('/users',            getUsers);
router.get('/users/:id',        getUserDetail);
router.patch('/users/:id',      updateUser);
router.get('/settings',         getSettings);
router.put('/settings/:key',    putSetting);
router.delete('/settings/:key', removeSetting);

// Feature flags (Session 37) — real payments/referrals on-off switches
router.get('/features',         getFeatureFlagsAdmin);
router.put('/features',         putFeatureFlags);

// Coupons (Session 37) — real Stripe coupons + promotion codes
router.get('/coupons',                  listCoupons);
router.post('/coupons',                 createCoupon);
router.patch('/coupons/:id/deactivate', deactivateCoupon);

// Brand Logo upload & management
router.get('/brand-logo',               getBrandLogo);
router.post('/brand-logo',              imageUpload.single('logo'), uploadBrandLogo);
router.delete('/brand-logo',            deleteBrandLogo);

module.exports = router;
