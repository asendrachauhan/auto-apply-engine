'use strict';
/**
 * Ghost Job Detection Service — Our unique differentiator
 * Scores every job 0-100 for legitimacy before showing to user.
 * Research: 18-27% of job listings are ghost jobs (Clarify Capital 2025)
 */
const logger = require('../../utils/logger');

const WEIGHTS = {
  postingAge: 25, salaryTransparency: 20, descriptionQuality: 15,
  companySpecificity: 15, applicationPath: 10, repostSignal: 5,
  jobTitleQuality: 5, contactPresence: 5,
};

const scorePostingAge = (postedAt) => {
  if (!postedAt) return 30;
  const days = (Date.now() - new Date(postedAt).getTime()) / 86400000;
  if (days <= 1) return 100; if (days <= 3) return 95; if (days <= 7) return 85;
  if (days <= 14) return 70; if (days <= 30) return 50; if (days <= 60) return 30;
  if (days <= 90) return 15; return 5;
};

const scoreSalaryTransparency = (min, max, desc = '') => {
  if (min && max && min > 0) return 100;
  if (min && min > 0) return 80;
  if (/(\$|€|£|₹|lpa|salary|compensation|ctc)\s*[\d,k]+/i.test(desc)) return 60;
  return 20;
};

const scoreDescriptionQuality = (desc = '') => {
  if (!desc || desc.length < 100) return 10;
  let score = 0;
  if (desc.length > 2000) score += 25; else if (desc.length > 500) score += 10;
  if (/\d+\+?\s*years?\s*(of)?\s*experience/i.test(desc)) score += 10;
  if (/required|mandatory|must have/i.test(desc)) score += 10;
  if (/responsibilities|you will|role involves/i.test(desc)) score += 10;
  const tech = (desc.match(/\b(react|angular|vue|node|python|java|typescript|docker|aws|mongodb|redis)\b/gi) || []).length;
  if (tech >= 3) score += 15; else if (tech >= 1) score += 8;
  if (/always looking|talent pipeline|future opportunities/i.test(desc)) score -= 25;
  return Math.max(0, Math.min(100, score));
};

const scoreCompanySpecificity = (company = '') => {
  if (!company || company.length < 2) return 10;
  if (/^(company|employer|client|confidential|undisclosed)$/i.test(company.trim())) return 5;
  return 75;
};

const scoreApplicationPath = (url = '') => {
  if (!url) return 10;
  if (/greenhouse\.io|lever\.co|workday\.com|ashby\.io|smartrecruiters/i.test(url)) return 95;
  if (/careers\.|jobs\.|\/careers\/|\/jobs\//i.test(url)) return 85;
  if (/remotive\.com|himalayas\.app|arbeitnow\.com|adzuna/i.test(url)) return 75;
  return 50;
};

const scoreGhostJob = (job) => {
  const scores = {
    postingAge:         scorePostingAge(job.postedAt),
    salaryTransparency: scoreSalaryTransparency(job.salaryMin, job.salaryMax, job.description),
    descriptionQuality: scoreDescriptionQuality(job.description),
    companySpecificity: scoreCompanySpecificity(job.company),
    applicationPath:    scoreApplicationPath(job.url),
    repostSignal:       70,
    jobTitleQuality:    /ninja|rockstar|wizard|guru/i.test(job.title || '') ? 20 : 75,
    contactPresence:    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(job.description || '') ? 90 : 45,
  };

  const realJobScore = Math.round(
    Object.entries(WEIGHTS).reduce((t, [k, w]) => t + (scores[k] * w / 100), 0)
  );

  const verdict    = realJobScore >= 70 ? 'REAL' : realJobScore >= 40 ? 'UNCERTAIN' : 'LIKELY_GHOST';
  const confidence = realJobScore >= 70 ? 'HIGH'  : realJobScore >= 40 ? 'MEDIUM'    : 'LOW';

  const signals = [];
  if (scores.postingAge >= 85)        signals.push({ type: 'positive', text: 'Posted recently' });
  if (scores.postingAge <= 30)        signals.push({ type: 'warning',  text: 'Old listing — may be filled' });
  if (scores.salaryTransparency >= 80) signals.push({ type: 'positive', text: 'Salary disclosed' });
  if (scores.salaryTransparency <= 20) signals.push({ type: 'warning',  text: 'No salary info — common in ghost jobs' });
  if (scores.descriptionQuality >= 70) signals.push({ type: 'positive', text: 'Detailed job description' });
  if (scores.applicationPath >= 90)   signals.push({ type: 'positive', text: 'Direct career page link' });

  return { realJobScore, verdict, confidence, signals, shouldShow: realJobScore >= 40, requiresWarning: realJobScore < 70 && realJobScore >= 40 };
};

const filterGhostJobs = (jobs, { minScore = 40 } = {}) => {
  const scored = jobs.map(j => ({ ...j, ghostScore: scoreGhostJob(j) })).filter(j => j.ghostScore.realJobScore >= minScore);
  logger.info(`Ghost filter: ${scored.length}/${jobs.length} passed`);
  return scored.sort((a, b) => b.ghostScore.realJobScore - a.ghostScore.realJobScore);
};

module.exports = { scoreGhostJob, filterGhostJobs };
