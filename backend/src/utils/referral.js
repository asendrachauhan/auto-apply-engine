/**
 * Referral code generation.
 * Format: first 4 letters of the user's name (uppercased, alpha-only,
 * padded if short) + 4 random alphanumeric chars, e.g. "ASEN7K2M".
 * Kept short and shareable — this is a link slug, not a secret.
 */
'use strict';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 — avoids ambiguity

const randomSuffix = (len = 4) => {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
};

const generateReferralCode = (name = '') => {
  const prefix = (name || '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .padEnd(4, 'X')
    .slice(0, 4) || 'USER';
  return `${prefix}${randomSuffix(4)}`;
};

module.exports = { generateReferralCode };
