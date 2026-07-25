const mongoose = require('mongoose');
const { AUTO_SESSION_STATUS } = require('../utils/constants');

const sessionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  status:      { type: String, default: AUTO_SESSION_STATUS.RUNNING, enum: Object.values(AUTO_SESSION_STATUS) },
  stats: {
    jobsFound:             { type: Number, default: 0 },
    ghostFiltered:         { type: Number, default: 0 },
    jobsMatched:           { type: Number, default: 0 },
    applicationsAttempted: { type: Number, default: 0 },
    applicationsSent:      { type: Number, default: 0 },
    notificationsSent:     { type: Number, default: 0 },
  },
  errors: [String],
}, { timestamps: true });

sessionSchema.index({ userId: 1, startedAt: -1 });
module.exports = mongoose.model('AutomationSession', sessionSchema);
