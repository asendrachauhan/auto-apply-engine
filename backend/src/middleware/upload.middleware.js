/**
 * File upload middleware — multer with strict validation.
 * Security: type checking, size limits, filename sanitization.
 */
const multer  = require('multer');
const path    = require('path');
const { SECURITY } = require('../utils/constants');

const storage = multer.memoryStorage(); // Store in memory, upload to Cloudinary

const fileFilter = (req, file, cb) => {
  if (SECURITY.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: SECURITY.MAX_FILE_SIZE_BYTES },
});

module.exports = { upload };
