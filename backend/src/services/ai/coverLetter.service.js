'use strict';
// Consolidated onto the canonical Groq client (see resume.routes.js comment
// for why) — cover letter generation during live automation runs previously
// had none of the Session 2 429-retry protection.
const groq   = require('../ai/groq.service');
const { getAllSkills } = require('../../utils/resumeSkills');
const logger = require('../../utils/logger');
const aiHumanizer = require('./aiHumanizer.service');

const PROMPT = `Write a compelling cover letter (max 200 words) for this job application.
Be specific, professional, and reference real details from the candidate's background.
Do NOT use generic phrases like "I am a passionate professional" or "proven track record".
Do NOT use dead-giveaway AI resume buzzwords like "spearheaded", "orchestrated", "fostered", "delved", "testament", "tapestry", or "seamlessly".
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
    // Bug fix (Session 42): this used to default to 'Software Development'
    // specifically when targetRoles was empty — a false, tech-specific
    // claim that would have landed in an actual marketing/BPO/sales
    // candidate's real cover letter. Falls back to the job's own title
    // instead, which is always a true statement regardless of field.
    const field       = (resumeData.targetRoles || [])[0] || job.title || 'their field';
    // Bug fix (Session 42): this used to only read skills.technical,
    // silently dropping tools/soft/language skills — meaning a candidate
    // with zero technical skills but real, relevant ones (e.g. a marketing
    // candidate's HubSpot/SEO expertise) got a cover letter with an empty
    // skills line. See utils/resumeSkills.js.
    const skills      = getAllSkills(resumeData.skills).slice(0, 6).join(', ');
    const achievement = (resumeData.experience?.[0]?.achievements || [])[0] || `${years} years of experience in ${field}`;
    const requirement = (matchScore?.matchedSkills || []).slice(0, 3).join(', ') || field;

    const prompt = PROMPT
      .replace('NAME', name).replace('YEARS', years).replace('FIELD', field)
      .replace('SKILLS', skills).replace('ACHIEVEMENT', achievement)
      .replace('TITLE', job.title).replace('COMPANY', job.company)
      .replace('REQUIREMENT', requirement);

    const raw = await groq.chat([{ role: 'user', content: prompt }], { maxTokens: 400, temperature: 0.5 });
    const clean = aiHumanizer.replaceAiCliches(aiHumanizer.stripZeroWidthWatermarks(raw.trim()));
    return clean;
  } catch (err) {
    logger.warn(`Cover letter generation failed: ${err.message}`);
    return '';
  }
};

module.exports = { generateCoverLetter };
