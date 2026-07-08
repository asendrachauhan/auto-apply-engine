/**
 * General-purpose utility helpers.
 */

/**
 * Sleep for given milliseconds — used for rate limiting.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry an async function up to `retries` times with exponential backoff.
 * @param {Function} fn
 * @param {number} retries
 * @param {number} baseDelayMs
 */
const withRetry = async (fn, retries = 3, baseDelayMs = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(baseDelayMs * 2 ** i);
    }
  }
};

/**
 * Chunk an array into batches of `size`.
 * @param {Array} arr
 * @param {number} size
 * @returns {Array[]}
 */
const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

/**
 * Sanitise a string for safe logging (mask emails, tokens).
 * @param {string} str
 */
const sanitiseLog = (str) =>
  str
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g, '***@***.***')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1***');

module.exports = { sleep, withRetry, chunk, sanitiseLog };
