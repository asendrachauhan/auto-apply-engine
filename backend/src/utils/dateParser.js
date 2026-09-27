'use strict';

/**
 * Universal Date & Relative Time Parser for Job Postings.
 * Handles strings like:
 * - "Just now", "moments ago", "today"
 * - "1 minute ago", "5 mins ago", "30 minutes ago", "1m ago"
 * - "1 hour ago", "4 hours ago", "12h ago"
 * - "1 day ago", "3 days ago", "yesterday", "2d ago"
 * - "1 week ago", "2 weeks ago"
 * - "1 month ago", "2 months ago"
 * - Arrays like Google Jobs' `extensions`: ['3 hours ago', 'Full-time']
 * - ISO strings, RFC 2822 & standard date formats
 *
 * @param {string|string[]|Date|number|null|undefined} input
 * @returns {Date}
 */
const parseRelativeDate = (input) => {
  if (!input) return new Date();
  if (input instanceof Date && !isNaN(input.getTime())) return input;
  if (typeof input === 'number' && !isNaN(input) && input > 0) {
    // Check if seconds instead of ms
    return input < 1e11 ? new Date(input * 1000) : new Date(input);
  }

  let str = '';
  if (Array.isArray(input)) {
    const found = input.find(x => typeof x === 'string' && /\b(just now|ago|today|yesterday|hour|hr|min|minute|day|week|month)\b/i.test(x));
    str = found || '';
  } else if (typeof input === 'string') {
    str = input;
  }

  str = str.trim().toLowerCase();
  const now = Date.now();

  if (!str) return new Date();
  if (str === 'just now' || str === 'moments ago' || str === 'today') return new Date(now);
  if (str === 'yesterday') return new Date(now - 86400000);

  // Minutes: "1 minute ago", "5 mins ago", "15m ago"
  const minMatch = str.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\s*ago/i);
  if (minMatch) return new Date(now - parseInt(minMatch[1], 10) * 60 * 1000);

  // Hours: "1 hour ago", "4 hrs ago", "2h ago"
  const hrMatch = str.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\s*ago/i);
  if (hrMatch) return new Date(now - parseInt(hrMatch[1], 10) * 3600 * 1000);

  // Days: "1 day ago", "3 days ago", "2d ago"
  const dayMatch = str.match(/(\d+)\s*(?:d|day|days)\s*ago/i);
  if (dayMatch) return new Date(now - parseInt(dayMatch[1], 10) * 86400 * 1000);

  // Weeks: "1 week ago", "2 weeks ago"
  const wkMatch = str.match(/(\d+)\s*(?:w|wk|week|weeks)\s*ago/i);
  if (wkMatch) return new Date(now - parseInt(wkMatch[1], 10) * 7 * 86400 * 1000);

  // Months: "1 month ago", "2 months ago"
  const moMatch = str.match(/(\d+)\s*(?:mo|month|months)\s*ago/i);
  if (moMatch) return new Date(now - parseInt(moMatch[1], 10) * 30 * 86400 * 1000);

  // Check if standard date string (e.g. "Sep 27, 2026", "2026-09-27T10:00:00Z")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return new Date();
};

/**
 * Format a Date or timestamp into a compact human-readable relative time string.
 * e.g. "Just now", "2m ago", "15m ago", "1h ago", "2d ago", "3w ago"
 *
 * @param {string|Date|number} date
 * @returns {string}
 */
const formatTimeAgo = (date) => {
  if (!date) return 'Recently';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Recently';

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'Just now';

  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

module.exports = {
  parseRelativeDate,
  formatTimeAgo,
};
