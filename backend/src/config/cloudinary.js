const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

let _configured = false;
const getClient = () => {
  if (!_configured) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) { logger.warn('Cloudinary not configured'); return null; }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure:     true,
    });
    _configured = true;
  }
  return cloudinary;
};
module.exports = { getClient };
