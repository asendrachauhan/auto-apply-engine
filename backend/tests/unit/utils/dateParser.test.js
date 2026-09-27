'use strict';

const { parseRelativeDate, formatTimeAgo } = require('../../../src/utils/dateParser');

describe('dateParser utility', () => {
  test('parses "Just now" and "today" as current timestamp', () => {
    const before = Date.now();
    const d1 = parseRelativeDate('Just now');
    const d2 = parseRelativeDate('today');
    const after = Date.now();

    expect(d1.getTime()).toBeGreaterThanOrEqual(before);
    expect(d1.getTime()).toBeLessThanOrEqual(after);
    expect(d2.getTime()).toBeGreaterThanOrEqual(before);
  });

  test('parses "1 minute ago" and "5 mins ago"', () => {
    const now = Date.now();
    const d1 = parseRelativeDate('1 minute ago');
    const d5 = parseRelativeDate('5 mins ago');

    expect(Math.abs(now - 60000 - d1.getTime())).toBeLessThan(1000);
    expect(Math.abs(now - 300000 - d5.getTime())).toBeLessThan(1000);
  });

  test('parses "2 hours ago" and "1 day ago"', () => {
    const now = Date.now();
    const d2h = parseRelativeDate('2 hours ago');
    const d1d = parseRelativeDate('1 day ago');

    expect(Math.abs(now - 2 * 3600000 - d2h.getTime())).toBeLessThan(1000);
    expect(Math.abs(now - 86400000 - d1d.getTime())).toBeLessThan(1000);
  });

  test('extracts relative date from Google Jobs extensions array', () => {
    const now = Date.now();
    const extensions = ['Full-time', '3 hours ago', 'Health insurance'];
    const d = parseRelativeDate(extensions);

    expect(Math.abs(now - 3 * 3600000 - d.getTime())).toBeLessThan(1000);
  });

  test('handles valid ISO dates and returns valid Date', () => {
    const iso = '2026-09-20T12:00:00.000Z';
    const d = parseRelativeDate(iso);
    expect(d.toISOString()).toBe(iso);
  });

  test('formatTimeAgo outputs compact relative time', () => {
    const now = Date.now();
    expect(formatTimeAgo(new Date(now - 30000))).toBe('Just now');
    expect(formatTimeAgo(new Date(now - 2 * 60000))).toBe('2m ago');
    expect(formatTimeAgo(new Date(now - 3 * 3600000))).toBe('3h ago');
    expect(formatTimeAgo(new Date(now - 2 * 86400000))).toBe('2d ago');
  });
});
