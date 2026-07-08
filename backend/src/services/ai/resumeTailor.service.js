/**
 * Resume Tailor Service.
 * Takes a base resume + job description and produces a 100% tailored version.
 *
 * Strategy:
 * 1. Extract key requirements, skills, keywords from JD
 * 2. Rewrite resume summary to mirror JD language
 * 3. Reorder/reword experience bullets to match JD priorities
 * 4. Add JD-specific keywords naturally
 * 5. Score final ATS match against JD
 */

const groq   = require('./groq.service');
const logger = require('../../utils/logger');

const TAILOR_PROMPT = `You are a world-class resume writer with 20 years of experience.
Tailor this resume SPECIFICALLY for this job description. 

CRITICAL RULES:
1. Keep ALL facts TRUE — never invent experience, companies, or credentials
2. Extract top 10 keywords/phrases from the JD and weave them naturally into the resume
3. Rewrite the summary to directly address what this company is looking for
4. Reorder experience bullets so the most relevant accomplishments come first
5. Match the JD's terminology (if they say "microservices" not "distributed systems", use their term)
6. Calculate a realistic ATS keyword match % between tailored resume and JD
7. Keep everything concise — no padding

JOB DESCRIPTION:
JD_TEXT

CANDIDATE BASE RESUME:
RESUME_JSON

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary directly addressing this specific role",
  "keywordsExtracted": ["top 10 JD keywords"],
  "keywordsAdded": ["which ones were woven into resume"],
  "skills": {
    "technical": ["reordered with JD-relevant skills first"],
    "soft": ["same"],
    "tools": ["same"]
  },
  "experience": [{
    "company": "same",
    "title": "same",
    "duration": "same",
    "current": true/false,
    "achievements": ["reworded bullets matching JD language, most relevant first"],
    "technologies": ["same"]
  }],
  "tailoringNotes": ["what was changed and why"],
  "atsMatchScore": 0,
  "strengthsForThisRole": ["top 3 reasons candidate fits"],
  "gapsForThisRole": ["honest gaps, if any"]
}`;

/**
 * Tailor resume for a specific job.
 * @param {object} resumeData  - optimized resume from Resume model
 * @param {object} job         - job listing with title, company, description
 * @returns {Promise<object>}  - tailored resume data
 */
const tailorResume = async (resumeData, job) => {
  if (!job.description || job.description.length < 100) {
    logger.warn(`Job "${job.title}" has no description — returning base resume`);
    return {
      ...resumeData,
      summary:       resumeData.summary || '',
      atsMatchScore: 60,
      tailoringNotes:['No job description available — base resume used'],
      keywordsExtracted: [],
      keywordsAdded: [],
    };
  }

  logger.info(`Tailoring resume for: ${job.title} @ ${job.company}`);

  const baseResume = {
    summary:    resumeData.summary,
    targetRoles:resumeData.targetRoles,
    skills:     resumeData.skills,
    experience: resumeData.experience?.map(e => ({
      company:      e.company,
      title:        e.title,
      duration:     e.duration,
      current:      e.current,
      achievements: e.achievements,
      technologies: e.technologies,
    })),
    education:  resumeData.education,
    projects:   resumeData.projects,
  };

  const prompt = TAILOR_PROMPT
    .replace('JD_TEXT',     job.description.slice(0, 3000))
    .replace('RESUME_JSON', JSON.stringify(baseResume, null, 2).slice(0, 4000));

  const response = await groq.chat(
    [{ role: 'user', content: prompt }],
    { maxTokens: 2500, temperature: 0.2 }
  );

  const tailored = groq.parseJSON(response);
  logger.info(`Resume tailored for ${job.company} — ATS: ${tailored.atsMatchScore}%`);

  return {
    ...resumeData,
    ...tailored,
    // Preserve identity fields
    fullName:  resumeData.fullName,
    email:     resumeData.email,
    phone:     resumeData.phone,
    location:  resumeData.location,
    links:     resumeData.links,
    education: resumeData.education,
  };
};

/**
 * Extract key requirements from JD for quick display.
 * @param {string} jobDescription
 * @returns {Promise<object>}
 */
const extractJDRequirements = async (jobDescription) => {
  if (!jobDescription || jobDescription.length < 50) return { skills:[], experience:'', mustHave:[] };

  const prompt = `Extract key requirements from this job description. Return ONLY JSON:
{
  "mustHaveSkills": ["top 5 required technical skills"],
  "niceToHaveSkills": ["bonus skills"],
  "experienceRequired": "e.g. 2-4 years",
  "roleType": "remote/hybrid/onsite",
  "mustHave": ["3 absolute requirements"],
  "companyKeywords": ["3 words describing company culture/values"]
}

JD: ${jobDescription.slice(0, 2000)}`;

  try {
    const resp = await groq.chat([{ role:'user', content:prompt }], { maxTokens:400, temperature:0.1 });
    return groq.parseJSON(resp);
  } catch {
    return { mustHaveSkills:[], niceToHaveSkills:[], experienceRequired:'', mustHave:[] };
  }
};

module.exports = { tailorResume, extractJDRequirements };
