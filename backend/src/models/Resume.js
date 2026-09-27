const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  originalPdfUrl: { type: String, default: null },
  cloudinaryId:   { type: String, default: null },
  parsedData:   { type: mongoose.Schema.Types.Mixed, default: null },
  optimizedData:{ type: mongoose.Schema.Types.Mixed, default: null },
  atsScore:     { type: Number, min: 0, max: 100, default: null },
  version:      { type: Number, default: 1 },
  rawText:      { type: String, select: false },
}, { timestamps: true });

// `userId` already declares `unique: true` at the field level above, which
// creates its own index — an explicit resumeSchema.index({ userId: 1 }) here
// caused a Mongoose "Duplicate schema index" warning on every boot.
module.exports = mongoose.model('Resume', resumeSchema);
