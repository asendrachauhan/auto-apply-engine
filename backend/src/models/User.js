const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { SECURITY, PLAN, PLAN_LIMITS, GDPR } = require('../utils/constants');

const gdprSchema = new mongoose.Schema({
  consentGiven:     { type: Boolean, required: true },
  consentTimestamp: { type: Date,    required: true },
  consentVersion:   { type: String,  default: GDPR.CONSENT_VERSION },
  ipAddress:        { type: String,  default: '' },
  userAgent:        { type: String,  default: '' },
  dataProcessing:   { type: Boolean, default: false },
  marketing:        { type: Boolean, default: false },
}, { _id: false });

const prefsSchema = new mongoose.Schema({
  jobTitles:               { type: [String], default: [] },
  locations:               { type: [String], default: [] },
  targetCountries:         { type: [String], default: [] },
  minSalary:               { type: Number,   default: 0 },
  currency:                { type: String,   default: 'INR', enum: ['INR','EUR','USD','GBP'] },
  jobTypes:                { type: [String], default: ['full-time','remote'] },
  remoteOnly:              { type: Boolean,  default: false },
  euMode:                  { type: Boolean,  default: false },
  visaSponsorshipRequired: { type: Boolean,  default: false },
  currentCtcLPA:           { type: Number,   default: null },
  ghostScoreMinimum:       { type: Number,   default: 40, min: 0, max: 100 },
  autoApplyThreshold:      { type: Number,   default: 80, min: 65, max: 99 },
  dealBreakerKeywords:     { type: [String], default: [] },
  mustHaveKeywords:        { type: [String], default: [] },
}, { _id: false });

const notifSchema = new mongoose.Schema({
  whatsappEnabled: { type: Boolean, default: false },
  emailEnabled:    { type: Boolean, default: true  },
  perApplication:  { type: Boolean, default: true  },
  dailySummary:    { type: Boolean, default: true  },
  weeklyDigest:    { type: Boolean, default: true  },
  whatsappNumber:  { type: String,  default: '' },
  emailAddress:    { type: String,  default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'] },
  password:     { type: String, required: true, minlength: 8, select: false },
  refreshToken: { type: String, select: false },

  // Email verification
  emailVerified:          { type: Boolean, default: false },
  emailVerifyToken:       { type: String,  select: false  },
  emailVerifyTokenExpiry: { type: Date,    select: false  },

  // Password reset
  passwordResetToken:  { type: String, select: false },
  passwordResetExpiry: { type: Date,   select: false },

  // Brute force protection
  loginAttempts: { type: Number, default: 0, select: false },
  lockUntil:     { type: Date,            select: false },

  // GDPR
  gdprConsent: { type: gdprSchema, default: null },

  // State
  automationActive:   { type: Boolean, default: false },
  onboardingComplete: { type: Boolean, default: false },
  dailyApplyLimit:    { type: Number,  default: 3 },

  // Links
  linkedinUrl:  { type: String, default: '' },
  githubUrl:    { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },

  // Sub-documents
  preferences:          { type: prefsSchema,  default: () => ({}) },
  notificationSettings: { type: notifSchema,  default: () => ({}) },

  // Stats
  lastAutomationRun: { type: Date },
  totalApplications: { type: Number, default: 0 },
  plan:              { type: String, default: PLAN.FREE, enum: Object.values(PLAN) },
  stripeCustomerId:  { type: String, select: false },

  // GDPR deletion
  deletionRequestedAt: { type: Date, default: null },
}, { timestamps: true });

// ── Pre-save: hash password ───────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SECURITY.BCRYPT_ROUNDS);
  next();
});

// ── Methods ───────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    // Reset after lockout expires
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= SECURITY.MAX_LOGIN_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + SECURITY.LOCKOUT_DURATION };
  }
  return this.updateOne(updates);
};

userSchema.methods.createEmailVerifyToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken       = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerifyTokenExpiry = Date.now() + SECURITY.VERIFY_TOKEN_EXPIRY;
  return token;
};

userSchema.methods.createPasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken  = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpiry = Date.now() + SECURITY.RESET_TOKEN_EXPIRY;
  return token;
};

// ── Virtual: plan limits ──────────────────────────────────────────────────────
userSchema.virtual('planLimits').get(function () {
  return PLAN_LIMITS[this.plan] || PLAN_LIMITS[PLAN.FREE];
});

// ── toJSON: strip sensitive fields ───────────────────────────────────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password; delete obj.refreshToken;
  delete obj.emailVerifyToken; delete obj.emailVerifyTokenExpiry;
  delete obj.passwordResetToken; delete obj.passwordResetExpiry;
  delete obj.loginAttempts; delete obj.lockUntil;
  delete obj.stripeCustomerId;
  return obj;
};

userSchema.index({ email: 1 });
userSchema.index({ emailVerifyToken: 1 });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ stripeCustomerId: 1 });

module.exports = mongoose.model('User', userSchema);
