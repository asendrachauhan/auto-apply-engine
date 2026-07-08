const mongoose = require('mongoose');
const { SOURCES, GHOST_VERDICT } = require('../utils/constants');

const jobSchema = new mongoose.Schema({
  source:      { type: String, required: true, enum: Object.values(SOURCES) },
  externalId:  { type: String, required: true },
  title:       { type: String, required: true, trim: true },
  company:     { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  url:         { type: String, required: true },
  location:    { type: String, default: '' },
  remote:      { type: Boolean, default: false },
  jobType:     { type: String, default: 'full-time' },
  salaryMin:   { type: Number, default: null },
  salaryMax:   { type: Number, default: null },
  skills:      [String],
  postedAt:    { type: Date, default: Date.now },
  scrapedAt:   { type: Date, default: Date.now },
  // Ghost scoring
  ghostScore:   { type: Number, min: 0, max: 100, default: null },
  ghostVerdict: { type: String, enum: [...Object.values(GHOST_VERDICT), null], default: null },
  // EU metadata
  euMeta: {
    visaSponsorship: { type: Boolean, default: false },
    relocation:      { type: Boolean, default: false },
    country:         { type: String, default: '' },
  },
}, { timestamps: true });

jobSchema.index({ source: 1, externalId: 1 }, { unique: true });
jobSchema.index({ postedAt: -1 });
jobSchema.index({ ghostScore: -1 });
jobSchema.index({ remote: 1, postedAt: -1 });
module.exports = mongoose.model('JobListing', jobSchema);
