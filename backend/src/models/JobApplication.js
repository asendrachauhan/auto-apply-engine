const mongoose = require('mongoose');
const { JOB_STATUS } = require('../utils/constants');

const appSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',       required: true },
  jobListingId:  { type: mongoose.Schema.Types.ObjectId, ref: 'JobListing', required: true },
  status:        { type: String, default: JOB_STATUS.APPLIED, enum: Object.values(JOB_STATUS) },
  appliedAt:     { type: Date, default: Date.now },
  jobTitle:      { type: String, required: true },
  company:       { type: String, required: true },
  jobUrl:        { type: String, required: true },
  matchScore:    { type: Number, min: 0, max: 100, default: null },
  matchDimensions:{ type: mongoose.Schema.Types.Mixed, default: null },
  coverLetter:   { type: String, default: '' },
  resumeVersion: { type: Number, default: 1 },
  source:        { type: String, default: '' },
  notificationSent: { type: Boolean, default: false },
  notes:         { type: String, default: '' },
  ghostScore:    { type: Number, default: null },
}, { timestamps: true });

appSchema.index({ userId: 1, appliedAt: -1 });
appSchema.index({ userId: 1, company: 1, jobTitle: 1 });
appSchema.index({ userId: 1, status: 1 });
module.exports = mongoose.model('JobApplication', appSchema);
