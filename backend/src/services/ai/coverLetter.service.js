'use strict';
const groq   = require('../../config/groq');
const logger = require('../../utils/logger');

const PROMPT = `Write a compelling cover letter (max 200 words) for this job application.
Be specific, professional, and reference real details from the candidate's background.
Do NOT use generic phrases like "I am a passionate professional" or "proven track record".
Return ONLY the cover letter text, no subject line, no formatting.

Candidate: NAME with YEARS years experience in FIELD.
Top skills: SKILLS
Best achievement: ACHIEVEMENT

Job: TITLE at COMPANY
Key requirement: REQUIREMENT

Cover letter:`;

const generateCoverLetter = async (resumeData, job, matchScore) => {
  try {
    const name        = resumeData.fullName || 'Candidate';
    const years       = (resumeData.experience || []).length;
    const field       = (resumeData.targetRoles || [])[0] || 'Software Development';
    const skills      = (resumeData.skills?.technical || []).slice(0, 6).join(', ');
    const achievement = (resumeData.experience?.[0]?.achievements || [])[0] || `${years} years of experience in ${field}`;
    const requirement = (matchScore?.matchedSkills || []).slice(0, 3).join(', ') || field;

    const prompt = PROMPT
      .replace('NAME', name).replace('YEARS', years).replace('FIELD', field)
      .replace('SKILLS', skills).replace('ACHIEVEMENT', achievement)
      .replace('TITLE', job.title).replace('COMPANY', job.company)
      .replace('REQUIREMENT', requirement);

    const raw = await groq.chat([{ role: 'user', content: prompt }], { maxTokens: 400, temperature: 0.5 });
    return raw.trim();
  } catch (err) {
    logger.warn(`Cover letter generation failed: ${err.message}`);
    return '';
  }
};

module.exports = { generateCoverLetter };
