/**
 * Form Prefill Service.
 * Generates a complete, copy-paste-ready application packet for the user.
 *
 * Output:
 * - All common form fields pre-filled
 * - Cover letter tailored to this specific job
 * - "Application Card" — formatted text the user pastes field by field
 * - Quick-apply instructions per platform
 */

const groq   = require('./groq.service');
const logger = require('../../utils/logger');

const PREFILL_PROMPT = `You are an expert job application coach.
Create a complete application packet for this candidate to manually apply to this job.

CANDIDATE:
CANDIDATE_DATA

JOB:
Title: JOB_TITLE
Company: JOB_COMPANY
Platform: JOB_SOURCE
Description (first 1500 chars): JOB_DESC

Generate the following. Return ONLY valid JSON:
{
  "coverLetter": "A compelling 200-word cover letter. No 'Dear Hiring Manager'. Start with a strong hook specific to this company. Paragraph 1: Why you want THIS company. Paragraph 2: Your specific relevant achievement. Paragraph 3: Clear call to action.",
  "oneLiner": "One compelling sentence about why you're perfect for this role (for LinkedIn Easy Apply headline field)",
  "fields": [
    { "fieldName": "Full Name",          "value": "...", "instructions": "Paste in the Name field" },
    { "fieldName": "Email",              "value": "...", "instructions": "Use as-is" },
    { "fieldName": "Phone",              "value": "...", "instructions": "Add country code if needed" },
    { "fieldName": "Years of Experience","value": "...", "instructions": "Select nearest option" },
    { "fieldName": "Current Salary",     "value": "...", "instructions": "Enter in LPA or leave blank" },
    { "fieldName": "Expected Salary",    "value": "...", "instructions": "Based on your target" },
    { "fieldName": "Notice Period",      "value": "...", "instructions": "Immediate/15/30 days" },
    { "fieldName": "LinkedIn URL",       "value": "...", "instructions": "Copy from your profile" },
    { "fieldName": "GitHub/Portfolio",   "value": "...", "instructions": "Link to portfolio" },
    { "fieldName": "Cover Letter",       "value": "...", "instructions": "Paste in the cover letter box" },
    { "fieldName": "Why this company?",  "value": "...", "instructions": "For dropdown/text fields" },
    { "fieldName": "Biggest Achievement","value": "...", "instructions": "Use in open-ended questions" }
  ],
  "applyInstructions": {
    "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
    "tipForThisPlatform": "Platform-specific tip"
  },
  "pitfalls": ["Common mistake to avoid on this platform"],
  "estimatedTime": "X minutes to apply"
}`;

const getPlatformInstructions = (source) => {
  const instructions = {
    'linkedin': {
      name:  'LinkedIn',
      steps: [
        'Click the job link → "Easy Apply" button',
        'Upload the tailored resume PDF (download below)',
        'Paste the cover letter in the message box',
        'Fill in the pre-filled fields one by one',
        'Click Submit — done in under 3 minutes',
      ],
      tip: 'LinkedIn tracks profile views after applying. Update your "Open to Work" status first.',
    },
    'naukri': {
      name:  'Naukri',
      steps: [
        'Click Apply on the job page',
        'Upload tailored resume PDF',
        'Fill in the cover letter field',
        'Answer any screening questions using the pre-filled answers below',
        'Click Submit',
      ],
      tip: 'Naukri\'s AI ranks profiles. Make sure your Naukri profile is updated with same keywords.',
    },
    'indeed': {
      name:  'Indeed',
      steps: [
        'Click Apply Now on Indeed',
        'Select "Upload Resume" and upload the tailored PDF',
        'Fill screening questions using answers below',
        'Add cover letter if prompted',
        'Submit application',
      ],
      tip: 'Indeed tracks days since last profile update. Refresh your Indeed profile before applying.',
    },
    'google-jobs': {
      name:  'Google Jobs',
      steps: [
        'Click the job link to go to the company/platform page',
        'Apply directly on that platform',
        'Use the pre-filled form data below',
      ],
      tip: 'Google Jobs redirects to the original posting. Check which platform it opens.',
    },
    'default': {
      name:  'Company Website',
      steps: [
        'Open the job link',
        'Click Apply / Apply Now',
        'Upload the tailored resume PDF',
        'Fill form fields using the pre-filled data below',
        'Submit',
      ],
      tip: 'Company websites often have ATS. Use exact keywords from the job description.',
    },
  };
  return instructions[source] || instructions['default'];
};

/**
 * Generate complete prefilled application packet.
 * @param {object} tailoredResume  - AI-tailored resume
 * @param {object} job             - job listing
 * @param {object} matchResult     - AI match score result
 * @returns {Promise<object>}
 */
const generatePrefill = async (tailoredResume, job, matchResult) => {
  logger.info(`Generating prefill packet: ${job.title} @ ${job.company}`);

  const candidateSummary = {
    name:        tailoredResume.fullName,
    email:       tailoredResume.email,
    phone:       tailoredResume.phone || 'Add your phone',
    summary:     tailoredResume.summary,
    topSkills:   tailoredResume.skills?.technical?.slice(0, 8).join(', '),
    experience:  tailoredResume.experience?.[0],
    yearsExp:    tailoredResume.experience?.length ? `${tailoredResume.experience.length}+` : '2+',
    linkedin:    tailoredResume.links?.linkedin || '',
    github:      tailoredResume.links?.github || '',
    portfolio:   tailoredResume.links?.portfolio || '',
    achievement: tailoredResume.experience?.[0]?.achievements?.[0] || '',
    appStrategy: matchResult?.applicationStrategy || '',
  };

  const prompt = PREFILL_PROMPT
    .replace('CANDIDATE_DATA', JSON.stringify(candidateSummary))
    .replace('JOB_TITLE',      job.title)
    .replace('JOB_COMPANY',    job.company)
    .replace('JOB_SOURCE',     job.source || 'company website')
    .replace('JOB_DESC',       (job.description || '').slice(0, 1500));

  const response = await groq.chat(
    [{ role: 'user', content: prompt }],
    { maxTokens: 2000, temperature: 0.4 }
  );

  const prefill = groq.parseJSON(response);

  // Add platform-specific instructions
  const platformInfo = getPlatformInstructions(job.source);
  prefill.platformInfo = platformInfo;

  // Generate formatted "Application Card" — plain text user can copy entirely
  prefill.applicationCard = formatApplicationCard(prefill, job, tailoredResume, matchResult);

  logger.info(`Prefill packet ready for ${job.company}`);
  return prefill;
};

/**
 * Format a copy-paste-ready text card with all application data.
 */
const formatApplicationCard = (prefill, job, resume, match) => {
  const divider = '─'.repeat(50);
  const fields  = (prefill.fields || [])
    .map(f => `  ${f.fieldName.padEnd(22)}: ${f.value}`)
    .join('\n');

  return `
${divider}
AutoApply AI — Application Packet
${divider}
Job     : ${job.title}
Company : ${job.company}
Link    : ${job.url}
Source  : ${(job.source || '').toUpperCase()}
Match   : ${match?.matchScore || 0}%
${divider}

PRE-FILLED FORM DATA
${divider}
${fields}
${divider}

COVER LETTER (copy-paste into the form)
${divider}
${prefill.coverLetter || ''}
${divider}

ONE-LINER (for LinkedIn headline / summary field)
${prefill.oneLiner || ''}
${divider}

HOW TO APPLY (${prefill.platformInfo?.name || 'Platform'})
${(prefill.applyInstructions?.steps || []).map((s,i) => `  ${i+1}. ${s}`).join('\n')}

PRO TIP: ${prefill.platformInfo?.tip || prefill.applyInstructions?.tipForThisPlatform || ''}
Estimated time: ${prefill.estimatedTime || '5-8 minutes'}
${divider}
Generated by AutoApply AI
`.trim();
};

module.exports = { generatePrefill };
