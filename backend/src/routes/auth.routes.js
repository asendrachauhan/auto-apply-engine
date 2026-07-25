'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/auth.controller');
const { protect }     = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

router.post('/register',        authLimiter, ctrl.registerRules, ctrl.register);
router.post('/login',           authLimiter, ctrl.loginRules,    ctrl.login);
router.get( '/verify-email',                                     ctrl.verifyEmail);
router.post('/forgot-password', authLimiter,                     ctrl.forgotPassword);
router.post('/reset-password',  authLimiter,                     ctrl.resetPassword);
router.post('/refresh',                                          ctrl.refreshToken);
router.post('/logout',          protect,                         ctrl.logout);
router.get( '/me',              protect,                         ctrl.getMe);
router.patch('/profile',        protect,                         ctrl.updateProfile);
router.patch('/password',       protect,                         ctrl.changePassword);
router.delete('/account',       protect,                         ctrl.deleteAccount);

module.exports = router;
