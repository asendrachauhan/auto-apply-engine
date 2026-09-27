/**
 * Resume optimization service.
 * Takes parsed resume data, rewrites it for maximum ATS score and
 * interview callback rate, returns enriched data with score and improvements.
 */

const groq = require('./groq.service');
const logger = require('../../utils/logger');
const aiHumanizer = require('./aiHumanizer.service');

const OPTIMIZE_PROMPT = `You are a world-class resume writer and ATS optimization specialist.
Rewrite and optimize the resume data below to maximize ATS score and interview callback rate.

RULES — follow every one without exception:
1. Keep ALL facts TRUE — never fabricate experience, companies, dates, or credentials.
2. Replace weak verbs: "responsible for" → "Led", "helped with" → "Supported", "worked on" → "Built".
3. Strong action verbs: Every single bullet MUST start with an authentic past-tense action verb (Engineered, Architected, Automated, Accelerated, Delivered, Optimized, Scaled, Built, Launched, Developed, Designed).
4. Quantify achievements: Every single bullet MUST include measurable business or technical metrics (e.g., 25%, 99.9%, 10k users, 2x speedup, 40% reduction, $50k) where plausible.
5. Professional summary: 3–4 sentences, compelling, includes top technical skills, domain expertise, and years of experience.
6. Skills catalog: Maintain a rich density of at least 15 distinct, recognized technical skills and tools across technical, tools, soft, and languages without dropping candidate skills.
7. Retain and enhance all projects and education without dropping any existing entries.
8. Remove filler fluff like "hard worker", "team player" unless backed by specific evidence.
9. ZERO-AI WATERMARKS & ANTI-DETECTION: Never use dead-giveaway AI resume buzzwords like "spearheaded", "orchestrated", "fostered", "delved", "testament", "tapestry", or "seamlessly". Use natural, punchy human candidate verbs. Avoid uniform robotic sentence lengths.

Input resume data (JSON):
RESUME_DATA

Return ONLY valid JSON matching this exact structure:
{
  "fullName": "Candidate full name",
  "email": "Candidate email",
  "phone": "Candidate phone",
  "location": "City, State, Country",
  "summary": "Compelling optimized summary",
  "targetRoles": ["Target Role 1", "Target Role 2"],
  "skills": {
    "technical": ["Languages, Frameworks, Core technologies"],
    "soft": ["Leadership, Agile, Cross-functional collaboration"],
    "tools": ["Git, Docker, AWS, Stripe, CI/CD, Postman, etc."],
    "languages": ["English, Hindi, etc."]
  },
  "experience": [{
    "company": "Company Name",
    "title": "Role Title",
    "location": "Company Location",
    "duration": "Duration (e.g. Aug 2025 – Sep 2026)",
    "achievements": ["Impact-driven bullet 1", "Impact-driven bullet 2"],
    "technologies": ["Tech stack used"]
  }],
  "projects": [{
    "name": "Project Name",
    "description": "Project overview",
    "achievements": ["Key project achievement or architectural highlights"],
    "technologies": ["Technologies used"],
    "url": "Project or repository URL"
  }],
  "education": [{
    "institution": "College or University",
    "degree": "Degree and field",
    "year": "Graduation year or date range",
    "gpa": "GPA or score",
    "location": "Location"
  }],
  "certifications": [{ "name": "Certification name", "issuer": "Issuer", "year": "Year" }],
  "links": { "linkedin": "LinkedIn URL", "github": "GitHub URL", "portfolio": "Portfolio URL" },
  "atsScore": 0,
  "improvements": ["Specific improvements made to optimize this resume"],
  "keywordsAdded": ["Specific ATS keywords inserted"]
}`;

/**
 * Optimize parsed resume data for ATS and human reviewers.
 * @param {object} parsedData - structured resume from parseResume()
 * @returns {Promise<object>} optimized resume data + score + improvements
 */
const { calculateAtsScore } = require('../../utils/atsScorer');

const optimizeResume = async (parsedData) => {
  logger.info(`Optimizing resume for: ${parsedData.fullName || 'user'}`);

  const sliceLimit = process.env.NODE_ENV === 'test' ? 3500 : 25000;
  const prompt = OPTIMIZE_PROMPT.replace(
    'RESUME_DATA',
    JSON.stringify(parsedData, null, 2).slice(0, sliceLimit)
  );

  let optimized;
  try {
    const maxTokens = process.env.NODE_ENV === 'test' ? 2500 : 5000;
    const temperature = process.env.NODE_ENV === 'test' ? 0.2 : 0.05;
    const aiResponse = await groq.chat(
      [{ role: 'user', content: prompt }],
      { maxTokens, temperature, responseFormat: { type: 'json_object' } }
    );
    optimized = groq.parseJSON(aiResponse);
  } catch (err) {
    if (process.env.NODE_ENV === 'test') throw err;
    logger.warn(`[ResumeOptimizer] AI optimization failed (${err.message}). Using parsed data.`);
    optimized = { ...parsedData };
  }

  if (process.env.NODE_ENV !== 'test') {
    // Safety merge: Never allow the AI response to drop existing candidate experience, projects, or education
    if (Array.isArray(parsedData.experience) && parsedData.experience.length > 0) {
      if (!Array.isArray(optimized.experience) || optimized.experience.length === 0) {
        optimized.experience = parsedData.experience;
      }
    }
    if (Array.isArray(parsedData.projects) && parsedData.projects.length > 0) {
      if (!Array.isArray(optimized.projects) || optimized.projects.length === 0) {
        optimized.projects = parsedData.projects;
      }
    }
    if (Array.isArray(parsedData.education) && parsedData.education.length > 0) {
      if (!Array.isArray(optimized.education) || optimized.education.length === 0) {
        optimized.education = parsedData.education;
      }
    }
    if (Array.isArray(parsedData.certifications) && parsedData.certifications.length > 0) {
      if (!Array.isArray(optimized.certifications) || optimized.certifications.length === 0) {
        optimized.certifications = parsedData.certifications;
      }
    }
    if (!optimized.links && parsedData.links) {
      optimized.links = parsedData.links;
    }
    if (!optimized.location && parsedData.location) {
      optimized.location = parsedData.location;
    }
    if (!optimized.phone && parsedData.phone) {
      optimized.phone = parsedData.phone;
    }
    if (!optimized.email && parsedData.email) {
      optimized.email = parsedData.email;
    }
    if (!optimized.fullName && parsedData.fullName) {
      optimized.fullName = parsedData.fullName;
    }

    // Skill density preservation: Ensure candidate's original skills are never dropped
    if (parsedData.skills) {
      optimized.skills = optimized.skills || {};
      for (const cat of ['technical', 'tools', 'soft', 'languages']) {
        const existing = Array.isArray(parsedData.skills[cat]) ? parsedData.skills[cat] : [];
        const opt = Array.isArray(optimized.skills[cat]) ? optimized.skills[cat] : [];
        optimized.skills[cat] = [...new Set([...opt, ...existing])];
      }
    }

    // Calculate genuine ATS score based on verifiable industry criteria
    const atsResult = calculateAtsScore(optimized || parsedData);
    optimized.atsScore = atsResult.score;
    optimized.atsBreakdown = atsResult.breakdown;
    optimized.improvements = (optimized.improvements && optimized.improvements.length > 0)
      ? optimized.improvements
      : atsResult.improvements;
    logger.info(`Resume optimized. Real ATS score: ${optimized.atsScore} (Skills: ${atsResult.breakdown.skills}/40, Quant: ${atsResult.breakdown.quantification}/25)`);
  }

  // Deep anti-detection & watermark removal
  return aiHumanizer.humanizeResumeData(optimized);
};

module.exports = { optimizeResume };
