'use strict';
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User   = require('../models/User');
const { sendSuccess, sendError }         = require('../utils/apiResponse');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/notifications/email.service');
const { HTTP, SECURITY }                 = require('../utils/constants');
const logger = require('../utils/logger');

const signAccess  = id => jwt.sign({ id }, process.env.JWT_SECRET,        { expiresIn: process.env.JWT_EXPIRES_IN  || '15m' });
const signRefresh = id => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

// ── Validation chains ─────────────────────────────────────────────────────────
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and a number'),
  body('gdprConsent').isBoolean().withMessage('GDPR consent is required'),
];
const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// ── Register ──────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, HTTP.UNPROCESSABLE, 'Validation failed', errors.array().map(e => e.msg));

    const { name, email, password, gdprConsent, marketingConsent = false } = req.body;
    if (!gdprConsent) return sendError(res, HTTP.UNPROCESSABLE, 'GDPR consent is required to create an account');

    if (await User.findOne({ email })) return sendError(res, HTTP.CONFLICT, 'An account with this email already exists');

    const user = await User.create({
      name, email, password,
      gdprConsent: {
        consentGiven: true, consentTimestamp: new Date(), consentVersion: '1.0',
        ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '',
        dataProcessing: true, marketing: Boolean(marketingConsent),
      },
    });

    const verifyToken = user.createEmailVerifyToken();
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `${process.env.APP_URL}/verify-email?token=${verifyToken}`;
    sendVerificationEmail(user.email, user.name, verifyUrl).catch(e => logger.warn(`Verify email failed: ${e.message}`));

    const accessToken  = signAccess(user._id);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    await user.save({ validateBeforeSave: false });

    logger.info(`New registration: ${email}`);
    return sendSuccess(res, HTTP.CREATED, 'Account created. Please verify your email.', { user, accessToken, refreshToken });
  } catch (err) { next(err); }
};

// ── Login ─────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, HTTP.UNPROCESSABLE, 'Validation failed', errors.array().map(e => e.msg));

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil +refreshToken');
    if (!user) return sendError(res, HTTP.UNAUTHORIZED, 'Invalid email or password');

    if (user.isLocked()) return sendError(res, HTTP.TOO_MANY, `Account locked due to too many failed attempts. Try again in 15 minutes.`);

    const valid = await user.comparePassword(password);
    if (!valid) {
      await user.incrementLoginAttempts();
      return sendError(res, HTTP.UNAUTHORIZED, 'Invalid email or password');
    }

    // Reset failed attempts on success
    if (user.loginAttempts > 0) await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });

    const accessToken  = signAccess(user._id);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    await user.save({ validateBeforeSave: false });

    logger.info(`Login: ${email}`);
    return sendSuccess(res, HTTP.OK, 'Login successful', { user, accessToken, refreshToken });
  } catch (err) { next(err); }
};

// ── Verify email ──────────────────────────────────────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return sendError(res, HTTP.BAD_REQUEST, 'Verification token is required');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ emailVerifyToken: hashed, emailVerifyTokenExpiry: { $gt: Date.now() } })
      .select('+emailVerifyToken +emailVerifyTokenExpiry');
    if (!user) return sendError(res, HTTP.BAD_REQUEST, 'Invalid or expired verification token');
    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    logger.info(`Email verified: ${user.email}`);
    return sendSuccess(res, HTTP.OK, 'Email verified successfully');
  } catch (err) { next(err); }
};

// ── Forgot password ───────────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, HTTP.BAD_REQUEST, 'Email is required');
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      const token  = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });
      const url = `${process.env.APP_URL}/reset-password?token=${token}`;
      sendPasswordResetEmail(user.email, user.name, url).catch(e => logger.error(`Reset email failed: ${e.message}`));
    }
    // Always 200 — never reveal if email exists
    return sendSuccess(res, HTTP.OK, 'If an account exists with that email, a reset link has been sent.');
  } catch (err) { next(err); }
};

// ── Reset password ────────────────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return sendError(res, HTTP.BAD_REQUEST, 'Token and new password are required');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password))
      return sendError(res, HTTP.UNPROCESSABLE, 'Password must be at least 8 characters with uppercase, lowercase, and number');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpiry: { $gt: Date.now() } })
      .select('+passwordResetToken +passwordResetExpiry');
    if (!user) return sendError(res, HTTP.BAD_REQUEST, 'Invalid or expired reset token');
    user.password           = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.refreshToken       = undefined;
    await user.save();
    logger.info(`Password reset: ${user.email}`);
    return sendSuccess(res, HTTP.OK, 'Password reset successfully. Please sign in.');
  } catch (err) { next(err); }
};

// ── Refresh token ─────────────────────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return sendError(res, HTTP.BAD_REQUEST, 'Refresh token required');
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET); }
    catch { return sendError(res, HTTP.UNAUTHORIZED, 'Invalid or expired refresh token'); }
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) return sendError(res, HTTP.UNAUTHORIZED, 'Refresh token revoked');
    const newAccess  = signAccess(user._id);
    const newRefresh = signRefresh(user._id);
    user.refreshToken = newRefresh;
    await user.save({ validateBeforeSave: false });
    return sendSuccess(res, HTTP.OK, 'Token refreshed', { accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) { next(err); }
};

// ── Logout ────────────────────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
    return sendSuccess(res, HTTP.OK, 'Logged out successfully');
  } catch (err) { next(err); }
};

// ── Get me ────────────────────────────────────────────────────────────────────
const getMe = (req, res) => sendSuccess(res, HTTP.OK, 'Profile', req.user);

// ── Update profile (name, links) ──────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'linkedinUrl', 'githubUrl', 'portfolioUrl'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.name !== undefined && !updates.name.trim()) {
      return sendError(res, HTTP.UNPROCESSABLE, 'Name cannot be empty');
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    return sendSuccess(res, HTTP.OK, 'Profile updated', user);
  } catch (err) { next(err); }
};

// ── Change password (while logged in) ─────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return sendError(res, HTTP.UNPROCESSABLE, 'Both current and new password are required');
    if (newPassword.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return sendError(res, HTTP.UNPROCESSABLE, 'New password must be 8+ characters with uppercase, lowercase and a number');
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) return sendError(res, HTTP.UNAUTHORIZED, 'Current password is incorrect');
    user.password = newPassword;
    await user.save();
    return sendSuccess(res, HTTP.OK, 'Password changed successfully');
  } catch (err) { next(err); }
};

// ── Delete account (GDPR right to erasure) ────────────────────────────────────
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return sendError(res, HTTP.UNAUTHORIZED, 'Incorrect password');
    user.deletionRequestedAt = new Date();
    await user.save({ validateBeforeSave: false });
    logger.info(`Account deletion requested: ${user.email}`);
    return sendSuccess(res, HTTP.OK, 'Account deletion scheduled. All data will be permanently deleted within 30 days.');
  } catch (err) { next(err); }
};

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword, refreshToken, logout, getMe, updateProfile, changePassword, deleteAccount, registerRules, loginRules };
