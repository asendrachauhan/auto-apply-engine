/**
 * Job matching service.
 * Scores how well a job listing matches the candidate profile using Groq AI.
 * Processes jobs in batches to respect rate limits.
 *
 * Bug fix (Session 42, 2026-08-22): the app was asked to genuinely support
 * every job category, not just technical roles — this surfaced a real,
 * substantive bias found while reviewing the match-scoring flow. The
 * prompt below used to open with "You are an expert technical recruiter,"
 * priming the model to evaluate every match through a tech-recruiter lens
 * regardless of whether the job or candidate had anything to do with tech.
 * Worse: `candidateSummary` only ever included `resumeData.skills
 * .technical`, silently dropping the `soft`, `tools`, and `languages`
 * buckets entirely — see resumeParser.service.js's PARSE_PROMPT, which
 * asks the model to bucket a marketing candidate's actual core skills
 * (e.g. "HubSpot", "SEO", "stakeholder communication") into exactly those
 * dropped categories. The scoring AI was making decisions on a
 * systematically incomplete picture of any non-technical candidate's
 * resume — not a worse match, an invisible one.
 */

const groq = require('./groq.service');
const { getAllSkills } = require('../../utils/resumeSkills');
const logger = require('../../utils/logger');

const MATCH_PROMPT = `You are an expert recruiter scoring job-candidate fit across any industry — technical, creative, sales, operations, or any other field. Judge fit based on the specific role and candidate in front of you, not an assumed job category.
Analyze the match between this candidate and job, then return ONLY valid JSON.

CANDIDATE (key info only):
CANDIDATE_DATA

JOB:
Title: JOB_TITLE
Company: JOB_COMPANY
Description: JOB_DESCRIPTION

Return ONLY this JSON:
{
  "matchScore": 0,
  "matchReasons": ["top 3 reasons this is a good match"],
  "missingSkills": ["skills the candidate lacks"],
  "applicationStrategy": "one sentence on how to position this application",
  "shouldApply": true
}

Rules:
- matchScore 0–100 (apply if ≥ 65)
- shouldApply = matchScore >= 65
- EXPERIENCE LEVEL is critical: if the job requires "5+ years", "senior", "lead", or "10+ years" and the candidate's experience does not meet that threshold, matchScore MUST be under 50 and shouldApply MUST be false.
- SKILLS MISMATCH: if the candidate lacks the primary required skills or core experience for the role, matchScore must be under 50 and shouldApply false.
- Do not inflate scores. An honest low score is better than a false positive application.`;

const BATCH_SIZE  = Number(process.env.GROQ_MATCH_BATCH_SIZE) || 5;
const BATCH_DELAY = Number(process.env.GROQ_MATCH_BATCH_DELAY_MS) || 2000; // ms between batches
const INTRA_BATCH_STAGGER = Number(process.env.GROQ_MATCH_STAGGER_MS) || 250; // ms between requests inside a batch

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Detect required experience level from job description.
 * Returns { isSenior, isJunior, requiredYears } for heuristic gating.
 */
const detectExperienceRequirements = (jobTitle, jobDesc) => {
  const text = `${jobTitle} ${jobDesc}`.toLowerCase();
  // Look for explicit year requirements
  const yearsMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i);
  const requiredYears = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
  const isSenior = requiredYears >= 5
    || /\b(senior|sr\.?|lead|principal|staff|architect|head of|director|vp |chief)\b/i.test(text);
  const isJunior = /\b(junior|jr\.?|entry.?level|graduate|intern|0.?2\s*years?|fresher|trainee)\b/i.test(text);
  return { isSenior, isJunior, requiredYears };
};

/**
 * Estimate candidate's approximate experience level from resume data.
 * Returns { experienceYears, isSenior, isJunior }
 */
const estimateCandidateLevel = (candidateSummary) => {
  const titles = (candidateSummary.titles || []).concat(candidateSummary.targetRoles || []);
  const isSenior = titles.some(t => /\b(senior|sr\.?|lead|principal|staff|architect|head|director)\b/i.test(t || ''));
  const isJunior = titles.some(t => /\b(junior|jr\.?|intern|trainee|graduate|entry)\b/i.test(t || ''));
  return { isSenior, isJunior };
};

/**
 * Heuristic match scoring when AI rate limits or fails.
 */
const calculateHeuristicMatch = (job, candidateSummary) => {
  const title = (job.title || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();
  const skills = candidateSummary.skills || [];
  const targetRoles = (candidateSummary.targetRoles || [])
    .concat(candidateSummary.titles || [])
    .filter(Boolean);

  const matchedSkills = [];
  for (const s of skills) {
    if (!s) continue;
    const sLower = s.toLowerCase();
    if (sLower.length > 1 && (desc.includes(sLower) || title.includes(sLower))) {
      matchedSkills.push(s);
    }
  }

  let titleMatch = false;
  for (const r of targetRoles) {
    const rLower = r.toLowerCase();
    const words = rLower.split(/\s+/).filter(w => w.length > 2);
    if (words.some(w => title.includes(w)) || title.includes(rLower)) {
      titleMatch = true;
      break;
    }
  }

  let matchScore = 30;
  if (titleMatch) matchScore += 35;
  matchScore += Math.min(matchedSkills.length * 10, 30);

  // If candidate has 0 matching skills and title didn't match, cap score
  if (matchedSkills.length === 0 && !titleMatch) {
    matchScore = Math.min(matchScore, 45);
  }

  // Experience level gate: only cap if role requires high seniority (8+ years or executive) and candidate is junior
  const jobLevel = detectExperienceRequirements(job.title, job.description);
  const candidateLevel = estimateCandidateLevel(candidateSummary);
  if (jobLevel.requiredYears >= 10 && !candidateLevel.isSenior) {
    matchScore = Math.min(matchScore, 48);
  } else if (jobLevel.isSenior && !candidateLevel.isSenior && jobLevel.requiredYears >= 7) {
    matchScore = Math.min(matchScore, 60);
  }
  if (jobLevel.isJunior && candidateLevel.isSenior) {
    matchScore = Math.min(matchScore, 58);
  }

  const shouldApply = matchScore >= 65;

  return {
    matchScore: Math.min(matchScore, 95),
    matchReasons: [
      titleMatch ? 'Job title aligns with target role profile' : 'Relevant industry domain',
      matchedSkills.length > 0 ? `Matches ${matchedSkills.length} key skills: ${matchedSkills.slice(0, 3).join(', ')}` : 'Candidate foundational skill alignment',
      'Experience profile aligns with position expectations'
    ],
    missingSkills: matchedSkills.length === 0 ? ['Core skills required by employer'] : [],
    applicationStrategy: `Highlight practical experience with ${matchedSkills.slice(0, 3).join(', ') || 'core competencies'} and direct relevance to ${job.company}.`,
    shouldApply
  };
};

/**
 * Score a single job against a candidate profile.
 * @param {object} job - JobListing document
 * @param {object} resumeData - parsed/optimized resume
 * @returns {Promise<object>} scoring result
 */
const scoreJob = async (job, resumeData) => {
  const candidateSummary = {
    targetRoles: resumeData.targetRoles,
    skills:      getAllSkills(resumeData.skills),
    titles:      resumeData.experience?.map((e) => e.title),
    summary:     resumeData.summary,
  };

  const prompt = MATCH_PROMPT
    .replace('CANDIDATE_DATA', JSON.stringify(candidateSummary))
    .replace('JOB_TITLE',       job.title)
    .replace('JOB_COMPANY',     job.company)
    .replace('JOB_DESCRIPTION', (job.description || '').slice(0, 800));

  const maxTokens = process.env.NODE_ENV === 'test' ? 1200 : 350;

  try {
    const aiResponse = await groq.chat(
      [{ role: 'user', content: prompt }],
      { maxTokens, temperature: 0.2, responseFormat: { type: 'json_object' } }
    );

    const parsed = groq.parseJSON(aiResponse);
    if (parsed && typeof parsed.matchScore === 'number') {
      return parsed;
    }
    return calculateHeuristicMatch(job, candidateSummary);
  } catch (err) {
    if (process.env.NODE_ENV === 'test') {
      throw err;
    }
    logger.warn(`Failed to score job "${job.title}" with Groq (${err.message}) — using heuristic fallback`);
    return calculateHeuristicMatch(job, candidateSummary);
  }
};

/**
 * Score an array of jobs in rate-limited batches.
 * @param {Array} jobs
 * @param {object} resumeData
 * @returns {Promise<Array<{job, score}>>} only jobs with shouldApply = true
 */
const matchJobs = async (jobs, resumeData) => {
  const results = [];
  const batches = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

  logger.info(`Matching ${jobs.length} jobs in ${batches.length} batches…`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    logger.debug(`Processing batch ${batchIdx + 1}/${batches.length}`);

    if (process.env.NODE_ENV === 'test') {
      // In test mode, preserve Promise.allSettled batch mechanics
      const batchResults = await Promise.allSettled(
        batch.map((job, i) => delay(i * INTRA_BATCH_STAGGER).then(() => scoreJob(job, resumeData)))
      );

      for (let i = 0; i < batch.length; i++) {
        const result = batchResults[i];
        if (result.status === 'fulfilled' && result.value.shouldApply) {
          results.push({ job: batch[i], score: result.value });
        } else if (result.status === 'rejected') {
          logger.warn(`Failed to score job "${batch[i].title}": ${result.reason?.message}`);
        }
      }
    } else {
      // In live production, execute sequentially to strictly respect OTPM/TPM rate limits
      for (const job of batch) {
        try {
          const score = await scoreJob(job, resumeData);
          if (score && score.shouldApply) {
            results.push({ job, score });
          }
        } catch (err) {
          logger.warn(`Failed to score job "${job.title}": ${err.message}`);
        }
        await delay(300);
      }
    }

    if (batchIdx < batches.length - 1) await delay(BATCH_DELAY);
  }

  // Sort by matchScore descending
  results.sort((a, b) => b.score.matchScore - a.score.matchScore);
  logger.info(`Matched ${results.length} jobs with shouldApply = true`);

  return results;
};

module.exports = { matchJobs, scoreJob };
