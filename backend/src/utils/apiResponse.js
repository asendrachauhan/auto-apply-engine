/**
 * Standardized API response helpers.
 * Every endpoint returns the same shape — clients can rely on this.
 */

const sendSuccess = (res, statusCode, message, data = null, meta = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  if (meta !== null) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const sendError = (res, statusCode, message, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = Array.isArray(errors) ? errors : [errors];
  return res.status(statusCode).json(payload);
};

/**
 * Standardized paginated list response.
 * Shares the same { success, message, data, meta } envelope as sendSuccess
 * so clients only ever need to read `meta` for pagination info.
 */
const sendPaginated = (res, data, page = 1, limit = 20, total = 0) => {
  page = Number(page) || 1;
  limit = Number(limit) || 20;
  return res.status(200).json({
    success: true,
    message: 'OK',
    data,
    meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  });
};

module.exports = { sendSuccess, sendError, sendPaginated };
