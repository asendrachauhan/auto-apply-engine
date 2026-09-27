'use strict';

/**
 * Combines every skill bucket the resume parser produces (technical, tools,
 * soft, languages — see resumeParser.service.js's PARSE_PROMPT) into one
 * flat list.
 *
 * Session 42 (2026-08-22): extracted from jobMatcher.service.js after the
 * same "only ever reads skills.technical" bug turned up independently in
 * coverLetter.service.js and formPrefill.service.js while fixing the
 * original one — this app was asked to genuinely support every job
 * category, not just technical roles, and every one of those three files
 * was silently invisible to non-technical candidates' actual skills
 * (a marketing candidate's HubSpot/SEO/communication skills, a BPO
 * candidate's CRM/multitasking skills, etc. — all real, all previously
 * dropped). Order matters a little: technical first (still the most
 * commonly decisive signal for the roles where it applies), then tools,
 * then soft skills, then languages — trimmed to the cap only after
 * combining, so a non-technical candidate with 0 technical skills but
 * several relevant tools/soft skills still gets a real profile instead of
 * an empty one.
 *
 * @param {object} skills - resumeData.skills, e.g. { technical, tools, soft, languages }
 * @param {number} cap - max total skills to return (default 20)
 * @returns {string[]}
 */
const getAllSkills = (skills = {}, cap = 20) => {
  const combined = [
    ...(skills.technical || []),
    ...(skills.tools || []),
    ...(skills.soft || []),
    ...(skills.languages || []),
  ];
  return combined.slice(0, cap);
};

module.exports = { getAllSkills };
