/**
 * JobWatch model.
 * Tracks real-time job monitoring state per user.
 * Pro/Elite users get jobs within seconds of posting.
 */
const mongoose = require('mongoose');

const jobWatchSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    active:       { type: Boolean, default: false },
    lastChecked:  { type: Date, default: Date.now },
    checkInterval:{ type: Number, default: 120 }, // seconds

    // Jobs seen — to prevent re-applying
    seenJobIds: { type: [String], default: [] },

    // Stats
    totalDetected: { type: Number, default: 0 },
    totalApplied:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

jobWatchSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('JobWatch', jobWatchSchema);
