/**
 * Job matching service.
 * Scores how well a job listing matches the candidate profile using Groq AI.
 * Processes jobs in batches to respect rate limits.
 */

const groq = require('./groq.service');
const logger = require('../../utils/logger');

const MATCH_PROMPT = `You are an expert technical recruiter scoring job-candidate fit.
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
- Be honest; do not inflate scores`;

const BATCH_SIZE  = 8;
const BATCH_DELAY = 1200; // ms between batches to avoid rate limits

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Score a single job against a candidate profile.
 * @param {object} job - JobListing document
 * @param {object} resumeData - parsed/optimized resume
 * @returns {Promise<object>} scoring result
 */
const scoreJob = async (job, resumeData) => {
  const candidateSummary = {
    targetRoles: resumeData.targetRoles,
    skills:      resumeData.skills?.technical?.slice(0, 20),
    titles:      resumeData.experience?.map((e) => e.title),
    summary:     resumeData.summary,
  };

  const prompt = MATCH_PROMPT
    .replace('CANDIDATE_DATA', JSON.stringify(candidateSummary))
    .replace('JOB_TITLE',       job.title)
    .replace('JOB_COMPANY',     job.company)
    .replace('JOB_DESCRIPTION', (job.description || '').slice(0, 1200));

  const aiResponse = await groq.chat(
    [{ role: 'user', content: prompt }],
    { maxTokens: 400, temperature: 0.2 }
  );

  return groq.parseJSON(aiResponse);
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

    const batchResults = await Promise.allSettled(
      batch.map((job) => scoreJob(job, resumeData))
    );

    for (let i = 0; i < batch.length; i++) {
      const result = batchResults[i];
      if (result.status === 'fulfilled' && result.value.shouldApply) {
        results.push({ job: batch[i], score: result.value });
      } else if (result.status === 'rejected') {
        logger.warn(`Failed to score job "${batch[i].title}": ${result.reason?.message}`);
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
