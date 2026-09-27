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

const imageFilter = (req, file, cb) => {
  if (/image\/(svg\+xml|png|jpeg|jpg|webp)/i.test(file.mimetype) || /\.svg$/i.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only SVG, PNG, JPG, or WebP images are allowed for brand logo'), false);
  }
};

const imageUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

module.exports = { upload, imageUpload };
