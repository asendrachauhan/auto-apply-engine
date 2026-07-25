/**
 * Request validation middleware — uses express-validator.
 * Sanitizes all input before it reaches controllers.
 */
const { validationResult } = require('express-validator');
const { sendError }        = require('../utils/apiResponse');
const { HTTP }             = require('../utils/constants');
const createDOMPurify      = require('isomorphic-dompurify');

/** Run after express-validator chains */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, HTTP.UNPROCESSABLE, 'Validation failed',
      errors.array().map(e => `${e.path}: ${e.msg}`)
    );
  }
  next();
};

/** Sanitize string fields to prevent XSS */
const sanitizeBody = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        // Strip HTML tags from all string inputs
        obj[key] = obj[key].replace(/<[^>]*>/g, '').trim();
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };
  sanitize(req.body);
  next();
};

module.exports = { validate, sanitizeBody };
