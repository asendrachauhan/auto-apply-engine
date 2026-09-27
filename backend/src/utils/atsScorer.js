'use strict';

/**
 * Real ATS (Applicant Tracking System) Evaluation Engine
 *
 * Implements the standard evaluation rubric used by leading ATS platforms
 * (Workday, Greenhouse, Lever, Jobscan, Resumord):
 *  1. Hard Skills & Keyword Density (40%)
 *  2. Action Verbs & Measurable Quantification (25%)
 *  3. Contact & Profile Completeness (15%)
 *  4. Standard Section Architecture (10%)
 *  5. Readability & Formatting Compliance (10%)
 */

const STRONG_ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'administered', 'analyzed', 'architected', 'automated',
  'built', 'championed', 'collaborated', 'configured', 'constructed', 'converted',
  'created', 'decreased', 'delivered', 'deployed', 'designed', 'developed', 'devised',
  'directed', 'doubled', 'drove', 'eliminated', 'engineered', 'enhanced', 'established',
  'executed', 'expanded', 'expedited', 'facilitated', 'formulated', 'generated',
  'governed', 'guided', 'headed', 'identified', 'implemented', 'improved', 'increased',
  'initiated', 'innovated', 'installed', 'instituted', 'integrated', 'introduced',
  'launched', 'led', 'managed', 'maximized', 'mentored', 'migrated', 'minimized',
  'modeled', 'modernized', 'negotiated', 'optimized', 'orchestrated', 'overhauled',
  'oversaw', 'pioneered', 'planned', 'programmed', 'reduced', 'refactored', 'resolved',
  'restructured', 'revamped', 'scaled', 'secured', 'simplified', 'spearheaded',
  'standardized', 'streamlined', 'strengthened', 'supervised', 'surpassed', 'synthesized',
  'tested', 'transformed', 'upgraded', 'validated',
]);

const METRIC_PATTERNS = [
  /\b\d+(\.\d+)?%\b/g,                          // 25%, 99.9%
  /\b\$\d+([kmb])?\b/gi,                         // $50k, $2M
  /\b\d+([kmb])\b/gi,                            // 10k, 5M
  /\b\d+\s*(users|clients|customers|requests|transactions|rps|qps|ms|seconds|minutes|hours|days|weeks|months|years|engineers|developers|members)\b/gi,
  /\b(reduced|increased|improved|boosted|saved|cut)\s+(by\s+)?\d+/gi,
  /\b(10x|2x|3x|5x)\b/gi,
];

/**
 * Calculate genuine ATS score for a resume object.
 * @param {object} resumeData - structured resume data from parseResume or DB
 * @returns {object} { score, breakdown, feedback, strengths, improvements, actionVerbsFound, metricsFound }
 */
const calculateAtsScore = (resumeData = {}) => {
  const breakdown = {
    skills: 0,          // max 40
    quantification: 0,  // max 25
    contact: 0,         // max 15
    structure: 0,       // max 10
    formatting: 0,      // max 10
  };

  const strengths = [];
  const improvements = [];
  const actionVerbsFound = new Set();
  const metricsFound = new Set();

  // ── 1. Contact & Identity (15 pts) ─────────────────────────────────────────
  let contactPts = 0;
  if (resumeData.fullName && resumeData.fullName.trim().length > 2) {
    contactPts += 4;
  } else {
    improvements.push('Add your full name at the top of the resume');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (resumeData.email && emailRegex.test(resumeData.email.trim())) {
    contactPts += 4;
  } else {
    improvements.push('Add a valid, professional email address');
  }

  if (resumeData.phone && String(resumeData.phone).replace(/\D/g, '').length >= 8) {
    contactPts += 3;
  } else {
    improvements.push('Include a reachable phone number with country code');
  }

  // Normalize links — parsedData.links may be null, undefined, a string, or an
  // array depending on the AI parser output. Always coerce to a string array
  // before calling .some() to prevent "links.some is not a function" TypeError.
  const rawLinks = resumeData.links;
  const links = Array.isArray(rawLinks)
    ? rawLinks
    : (rawLinks && typeof rawLinks === 'string' ? [rawLinks] : []);
  const rawText = resumeData.rawText || '';
  const hasLinkedIn = links.some(l => /linkedin\.com/i.test(String(l))) || /linkedin\.com/i.test(rawText);
  const hasGitHubOrPortfolio = links.some(l => /github\.com|portfolio|\.dev|\.io/i.test(String(l))) || /github\.com/i.test(rawText);

  if (hasLinkedIn) {
    contactPts += 2;
    strengths.push('LinkedIn profile link detected for recruiter vetting');
  } else {
    improvements.push('Add your LinkedIn profile link to increase callback rates');
  }

  if (hasGitHubOrPortfolio) {
    contactPts += 2;
    strengths.push('Portfolio or GitHub link provided');
  }

  breakdown.contact = Math.min(15, contactPts);

  // ── 2. Hard Skills & Keyword Density (40 pts) ──────────────────────────────
  const skillsObj = resumeData.skills || {};
  const technical = Array.isArray(skillsObj.technical) ? skillsObj.technical : [];
  const tools = Array.isArray(skillsObj.tools) ? skillsObj.tools : [];
  const soft = Array.isArray(skillsObj.soft) ? skillsObj.soft : [];
  const languages = Array.isArray(skillsObj.languages) ? skillsObj.languages : [];
  const allSkills = [...new Set([...technical, ...tools, ...soft, ...languages])];

  let skillsPts = 0;
  if (allSkills.length >= 15) {
    skillsPts += 25;
    strengths.push(`Rich skill catalog with ${allSkills.length} recognized industry keywords`);
  } else if (allSkills.length >= 8) {
    skillsPts += 18;
    improvements.push('Expand skills list to at least 15 relevant technical competencies and tools');
  } else if (allSkills.length >= 3) {
    skillsPts += 10;
    improvements.push('Skill density is low — add core frameworks, libraries, and tools');
  } else {
    skillsPts += 4;
    improvements.push('Critical: Add a dedicated technical skills section');
  }

  // Categorization bonus
  if (technical.length > 0 && tools.length > 0) {
    skillsPts += 8;
    strengths.push('Skills are categorized cleanly into core competencies and tools');
  } else if (technical.length > 0) {
    skillsPts += 4;
  }

  // Target roles alignment
  const targetRoles = resumeData.targetRoles || [];
  if (targetRoles.length > 0) {
    skillsPts += 7;
    strengths.push(`Target roles defined: ${targetRoles.slice(0, 2).join(', ')}`);
  } else {
    improvements.push('Include specific target job titles in your header/summary');
  }

  breakdown.skills = Math.min(40, skillsPts);

  // ── 3. Action Verbs & Quantification (25 pts) ──────────────────────────────
  const experiences = Array.isArray(resumeData.experience) ? resumeData.experience : [];
  const allBullets = [];

  for (const exp of experiences) {
    const achs = Array.isArray(exp.achievements) ? exp.achievements : [];
    for (const b of achs) {
      if (typeof b === 'string' && b.trim()) allBullets.push(b.trim());
    }
  }

  // Scan bullets for action verbs and metrics
  for (const bullet of allBullets) {
    const words = bullet.toLowerCase().split(/\W+/).filter(Boolean);
    const firstWord = words[0] || '';
    if (STRONG_ACTION_VERBS.has(firstWord)) {
      actionVerbsFound.add(firstWord);
    }
    for (const w of words.slice(1, 4)) {
      if (STRONG_ACTION_VERBS.has(w)) actionVerbsFound.add(w);
    }

    for (const pat of METRIC_PATTERNS) {
      const matches = bullet.match(pat);
      if (matches) {
        matches.forEach(m => metricsFound.add(m.trim()));
      }
    }
  }

  let quantPts = 0;
  // Action verbs scoring (max 12 pts)
  if (actionVerbsFound.size >= 8) {
    quantPts += 12;
    strengths.push(`Strong active voice using ${actionVerbsFound.size} distinct action verbs`);
  } else if (actionVerbsFound.size >= 4) {
    quantPts += 8;
    improvements.push('Start every bullet point with strong action verbs (Engineered, Accelerated, Delivered)');
  } else if (actionVerbsFound.size >= 1) {
    quantPts += 4;
    improvements.push('Replace passive phrases like "worked on" or "responsible for" with powerful verbs');
  } else {
    improvements.push('No strong action verbs detected — lead each achievement with action-oriented verbs');
  }

  // Metrics scoring (max 13 pts)
  if (metricsFound.size >= 5) {
    quantPts += 13;
    strengths.push(`Excellent quantification with ${metricsFound.size} measurable business metrics`);
  } else if (metricsFound.size >= 2) {
    quantPts += 8;
    improvements.push('Quantify more achievements with measurable outcomes (%, revenue, speed, users)');
  } else if (metricsFound.size >= 1) {
    quantPts += 4;
    improvements.push('Only 1 metric found — ATS algorithms favor results quantified with %, $, or scale');
  } else {
    improvements.push('Add measurable results to your experience bullets (e.g. "reduced latency by 35%")');
  }

  breakdown.quantification = Math.min(25, quantPts);

  // ── 4. Standard Section Architecture (10 pts) ──────────────────────────────
  let structPts = 0;
  if (resumeData.summary && resumeData.summary.length >= 30) {
    structPts += 2.5;
    strengths.push('Professional summary included');
  } else {
    improvements.push('Add a 2-3 sentence executive summary tailored to your target profession');
  }

  if (experiences.length >= 1) {
    structPts += 3.5;
    const hasDates = experiences.some(e => e.duration || e.startDate || e.current);
    if (hasDates) structPts += 1.5;
  } else {
    improvements.push('Add work experience with company name, job title, dates, and achievements');
  }

  if (resumeData.education && (typeof resumeData.education === 'string' ? resumeData.education.length > 5 : Array.isArray(resumeData.education) ? resumeData.education.length > 0 : true)) {
    structPts += 2.5;
  } else {
    improvements.push('Include education details (degree, institution, graduation year)');
  }

  breakdown.structure = Math.min(10, Math.round(structPts));

  // ── 5. Readability & Formatting Compliance (10 pts) ────────────────────────
  let formatPts = 0;
  const rawWordCount = (resumeData.rawText || '').split(/\s+/).filter(Boolean).length;
  const bulletCount = allBullets.length;

  if (bulletCount >= 3 && bulletCount <= 25) {
    formatPts += 4;
    strengths.push(`Well-structured bullet point formatting (${bulletCount} total achievement bullets)`);
  } else if (bulletCount > 0) {
    formatPts += 2;
  }

  // Summary length check (30 - 120 words is ideal for ATS)
  const summaryWords = (resumeData.summary || '').split(/\s+/).filter(Boolean).length;
  if (summaryWords >= 25 && summaryWords <= 120) {
    formatPts += 3;
  } else if (summaryWords > 0) {
    formatPts += 1.5;
  }

  // Raw text parseability
  if (rawWordCount >= 200 || allBullets.length >= 5) {
    formatPts += 3;
    strengths.push('Clean text structure easily parsed by standard ATS scanners');
  } else {
    formatPts += 1;
  }

  breakdown.formatting = Math.min(10, Math.round(formatPts));

  // ── Total Score ────────────────────────────────────────────────────────────
  const rawTotal = breakdown.skills + breakdown.quantification + breakdown.contact + breakdown.structure + breakdown.formatting;
  const totalScore = Math.max(20, Math.min(100, Math.round(rawTotal)));

  return {
    score: totalScore,
    atsScore: totalScore,
    breakdown,
    strengths,
    improvements: improvements.slice(0, 5),
    actionVerbsFound: Array.from(actionVerbsFound),
    metricsFound: Array.from(metricsFound),
  };
};

module.exports = { calculateAtsScore, STRONG_ACTION_VERBS, METRIC_PATTERNS };
