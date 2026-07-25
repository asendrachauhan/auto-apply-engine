/**
 * Resume optimization service.
 * Takes parsed resume data, rewrites it for maximum ATS score and
 * interview callback rate, returns enriched data with score and improvements.
 */

const groq = require('./groq.service');
const logger = require('../../utils/logger');

const OPTIMIZE_PROMPT = `You are a world-class resume writer and ATS optimization specialist.
Rewrite and optimize the resume data below to maximize ATS score and interview callback rate.

RULES — follow every one without exception:
1. Keep ALL facts TRUE — never fabricate experience, companies, dates, or credentials
2. Replace weak verbs: "responsible for" → "Led", "helped with" → "Supported", "worked on" → "Built"
3. Add strong action verbs: Led, Engineered, Architected, Optimized, Reduced, Delivered, Scaled
4. Quantify every achievement with metrics (%, $, users, time saved, requests/sec) where plausible
5. Professional summary: 3 sentences max, compelling, includes top 3 technical skills and years of experience
6. Every experience bullet: [Action verb] + [What] + [Measurable result]
7. Skills: include relevant ATS keywords for the candidate's field and target roles
8. Remove filler: "team player", "detail-oriented", "passionate about" unless followed by specifics
9. ATS score: estimate 0–100 based on keyword density, structure, quantification

Input resume data (JSON):
RESUME_DATA

Return ONLY valid JSON with this structure:
{
  "fullName": "same",
  "email": "same",
  "phone": "same",
  "location": "same",
  "summary": "optimized 3-sentence summary",
  "targetRoles": ["same or improved"],
  "skills": { "technical": [], "soft": [], "tools": [], "languages": [] },
  "experience": [{ "company": "", "title": "", "duration": "", "startDate": "", "endDate": "", "current": false, "achievements": ["optimized bullets"], "technologies": [] }],
  "education": "same",
  "certifications": "same",
  "projects": "same",
  "links": "same",
  "atsScore": 0,
  "improvements": ["list of specific improvements made"],
  "keywordsAdded": ["new ATS keywords inserted"]
}`;

/**
 * Optimize parsed resume data for ATS and human reviewers.
 * @param {object} parsedData - structured resume from parseResume()
 * @returns {Promise<object>} optimized resume data + score + improvements
 */
const optimizeResume = async (parsedData) => {
  logger.info(`Optimizing resume for: ${parsedData.fullName || 'user'}`);

  const prompt = OPTIMIZE_PROMPT.replace(
    'RESUME_DATA',
    JSON.stringify(parsedData, null, 2).slice(0, 5000)
  );

  const aiResponse = await groq.chat(
    [{ role: 'user', content: prompt }],
    { maxTokens: 2500, temperature: 0.2 }
  );

  const optimized = groq.parseJSON(aiResponse);
  logger.info(`Resume optimized. ATS score: ${optimized.atsScore}`);

  return optimized;
};

module.exports = { optimizeResume };
