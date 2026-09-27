/**
 * Request validation middleware — uses express-validator.
 * Sanitizes all input before it reaches controllers.
 */
const { validationResult } = require('express-validator');
const { sendError }        = require('../utils/apiResponse');
const { HTTP }             = require('../utils/constants');
// isomorphic-dompurify exports differently depending on the JS environment:
// in Node/production, the top-level export has .sanitize directly.
// In some test environments (Jest jsdom) the export shape may differ.
// This pattern handles both by falling back to .default if needed.
const _dompurify           = require('isomorphic-dompurify');
const DOMPurify            = (_dompurify && typeof _dompurify.sanitize === 'function') ? _dompurify : (_dompurify.default || _dompurify);

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

/**
 * Recursively strip Mongo query-operator keys ($gt, $ne, $where, etc.) and
 * dotted paths from an object, in place. Prevents NoSQL operator injection:
 * without this, a login/register body like { "email": { "$ne": null } }
 * reaches `User.findOne({ email })` unchanged, since neither the previous
 * regex sanitizer nor express-validator's string-only checks ever inspected
 * object *keys* — only string *values*. Applied to body, query, and params.
 */
const stripMongoOperators = (input) => {
  if (Array.isArray(input)) {
    input.forEach(stripMongoOperators);
    return input;
  }
  if (!input || typeof input !== 'object') return input;

  for (const key of Object.keys(input)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete input[key];
      continue;
    }
    if (typeof input[key] === 'object') stripMongoOperators(input[key]);
  }
  return input;
};

/**
 * Sanitize string fields to prevent XSS (strips all HTML via DOMPurify —
 * previously a hand-rolled `<[^>]*>` regex was used here instead, even
 * though isomorphic-dompurify was already an installed dependency; the
 * regex approach misses cases like malformed/nested tags) and strips Mongo
 * operator keys from body/query/params to prevent NoSQL injection.
 */
const sanitizeBody = (req, res, next) => {
  const sanitizeStrings = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = DOMPurify.sanitize(obj[key], { ALLOWED_TAGS: [] }).trim();
      } else if (typeof obj[key] === 'object') {
        sanitizeStrings(obj[key]);
      }
    }
    return obj;
  };

  stripMongoOperators(req.body);
  stripMongoOperators(req.query);
  stripMongoOperators(req.params);
  sanitizeStrings(req.body);
  next();
};

module.exports = { validate, sanitizeBody, stripMongoOperators };
