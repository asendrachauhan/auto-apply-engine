/**
 * JobAlert model.
 * Tracks every job found + tailoring status + notification sent.
 * User manually applies — we just prepare everything for them.
 */
const mongoose = require('mongoose');

const prefillFieldSchema = new mongoose.Schema(
  {
    fieldName:    String,   // "Full Name", "Email", "Years of Experience"
    fieldType:    String,   // "text", "textarea", "select", "file"
    value:        String,   // pre-filled value
    instructions: String,   // "Paste this in the 'Cover Letter' box"
    priority:     Number,   // display order
  },
  { _id: false }
);

const jobAlertSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // Job info
    title:       { type: String, required: true },
    company:     { type: String, required: true },
    location:    { type: String, default: 'Remote' },
    jobUrl:      { type: String, required: true },
    source:      { type: String }, // linkedin-rss, indeed-rss, serpapi, remotive…
    description: { type: String },
    salary:      { type: String },
    postedAt:    { type: Date },

    // Ghost-job legitimacy score (0-100) — computed during discovery
    ghostScore:   { type: Number, min: 0, max: 100, default: null },
    ghostVerdict: { type: String, default: null },

    // AI analysis
    matchScore:          { type: Number, min: 0, max: 100 },
    matchReasons:        [String],
    missingSkills:       [String],
    keywordsToHighlight: [String],  // keywords from JD to add to resume

    // Tailored resume
    tailoredResume: {
      summary:    String,
      skills:     mongoose.Schema.Types.Mixed,
      experience: mongoose.Schema.Types.Mixed,
      fullText:   String,
    },
    tailoredResumePdfUrl: String,   // Cloudinary URL
    tailoredResumeHtml:   { type: String, select: false },

    // Pre-filled form
    coverLetter:   String,
    prefillFields: [prefillFieldSchema],
    prefillCard:   String,  // formatted text card user can copy-paste

    // Status tracking
    status: {
      type:    String,
      enum:    ['pending', 'notified', 'opened', 'applied', 'ignored'],
      default: 'pending',
    },

    // Notification
    notificationSent:    { type: Boolean, default: false },
    notificationSentAt:  Date,
    whatsappSent:        { type: Boolean, default: false },
    emailSent:           { type: Boolean, default: false },

    // User action tracking
    linkOpenedAt:  Date,
    appliedAt:     Date,
    userNotes:     String,
  },
  { timestamps: true }
);

jobAlertSchema.index({ userId: 1, createdAt: -1 });
jobAlertSchema.index({ userId: 1, status: 1 });
// prevent duplicate alerts for same job
jobAlertSchema.index({ userId: 1, jobUrl: 1 }, { unique: true });

module.exports = mongoose.model('JobAlert', jobAlertSchema);
