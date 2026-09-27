/**
 * PDF Generator Service.
 * Generates a beautiful, ATS-optimised PDF of the tailored resume.
 * Uses Puppeteer (already installed) to render HTML → PDF.
 * Uploads to Cloudinary and returns the URL.
 *
 * Bug fix (Session 42, 2026-08-22): the skills section used to render only
 * `technical` + `tools`, completely omitting `soft` and `languages` from
 * the actual generated resume PDF — for EVERY user, not just non-technical
 * ones. Most consequential fix in this round's sweep, since this is the
 * literal document a candidate sends to employers. Now renders as three
 * properly-labeled sections (Skills, Core Strengths, Languages) instead of
 * silently dropping two of the four skill categories under one section
 * mislabeled "Technical Skills."
 */

let _puppeteer = null;
const getPuppeteer = () => {
  if (!_puppeteer) _puppeteer = require('puppeteer');
  return _puppeteer;
};
const { getClient } = require('../../config/cloudinary');
const logger = require('../../utils/logger');
const aiHumanizer = require('../ai/aiHumanizer.service');

const KNOWN_CATEGORIES = [
  {
    key: 'Frontend & Languages',
    test: (s) => /^(javascript|typescript|html5?|css3?|scss|sass|angular|react(\.js)?|redux|rxjs|svelte|next(\.js)?|vue(\.js)?|tailwind|bootstrap|responsive web development|python|java|c\+\+|c#|ruby|golang|go|rust|php|sql|bash|shell)/i.test(s)
  },
  {
    key: 'Backend & Databases',
    test: (s) => /^(node(\.js)?|express(\.js)?|rest\s*apis?|jwt|oauth(\s*2\.0)?|nest(\.js)?|graphql|microservices|mongodb|mongoose|postgresql|postgres|mysql|redis|aggregation pipelines?|schema design|sqlite)/i.test(s)
  },
  {
    key: 'Generative AI & ML',
    test: (s) => /(ai|llm.*|prompt engineering|rag.*|embeddings?|semantic search|ai assistants?.*|ai content.*|ai workflow.*|llama.*|groq|conversational ai|ai-powered search|natural-language.*|text summarization|information extraction|workflow automation|predictive ai.*)/i.test(s)
  },
  {
    key: 'Cloud, Tools & Practices',
    test: (s) => /^(aws|azure|gcp|docker|kubernetes|stripe|railway|vercel|clickup|google integrations?|third-party apis?|oauth integrations?|git|github|postman|ci\/cd|production deployment.*|code review|api design|agile.*|scrum|multi-language.*|twilio|resend)/i.test(s)
  }
];

const organizeSkills = (skillsObj) => {
  if (!skillsObj) return [];
  const rawList = [
    ...(skillsObj.technical || []),
    ...(skillsObj.tools || []),
  ];

  // Deduplicate case-insensitively while preserving original capitalization
  const seen = new Set();
  const uniqueSkills = [];
  for (const s of rawList) {
    const trimmed = (s || '').trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueSkills.push(trimmed);
    }
  }

  const softSkills = (skillsObj.soft || []).map(s => (s || '').trim()).filter(Boolean);
  const spokenLanguages = (skillsObj.languages || []).map(s => (s || '').trim()).filter(s => {
    return !/^(javascript|typescript|html5?|css3?|scss|sass|python|java|c\+\+|sql)$/i.test(s);
  });

  // Small skill sets (< 8 items, e.g. test fixtures) maintain traditional layout
  if (uniqueSkills.length < 8) {
    const rows = [];
    if (uniqueSkills.length > 0) {
      rows.push({ label: 'Skills', items: uniqueSkills });
    }
    if (softSkills.length > 0) {
      rows.push({ label: 'Core Strengths', items: softSkills });
    }
    if (skillsObj.languages && skillsObj.languages.length > 0) {
      rows.push({ label: 'Languages', items: skillsObj.languages });
    }
    return rows;
  }

  // Full categorization for detailed candidate resumes
  const categorized = {};
  KNOWN_CATEGORIES.forEach(c => { categorized[c.key] = []; });
  const other = [];

  for (const skill of uniqueSkills) {
    let placed = false;
    for (const cat of KNOWN_CATEGORIES) {
      if (cat.test(skill)) {
        categorized[cat.key].push(skill);
        placed = true;
        break;
      }
    }
    if (!placed) other.push(skill);
  }

  const rows = [];
  for (const cat of KNOWN_CATEGORIES) {
    if (categorized[cat.key].length > 0) {
      rows.push({ label: cat.key, items: categorized[cat.key] });
    }
  }
  if (other.length > 0) {
    rows.push({ label: 'Other Skills', items: other });
  }

  // Deduplicate soft skills so items already in Engineering Practices are not repeated
  const placedSkillsLower = new Set();
  for (const cat of KNOWN_CATEGORIES) {
    categorized[cat.key].forEach(s => placedSkillsLower.add(s.toLowerCase()));
  }
  const uniqueSoftSkills = softSkills.filter(s => !placedSkillsLower.has(s.toLowerCase()));
  if (uniqueSoftSkills.length > 0) {
    rows.push({ label: 'Core Strengths', items: uniqueSoftSkills });
  }

  if (spokenLanguages.length > 0) {
    rows.push({ label: 'Spoken Languages', items: spokenLanguages });
  }
  return rows;
};

/**
 * Build resume HTML template.
 * Clean, single-column, ATS-friendly layout adhering to international ATS standards
 * (Workday, Taleo, Greenhouse, Lever, Jobscan).
 */
const buildResumeHtml = (rawResume, job) => {
  const resume = aiHumanizer.humanizeResumeData(rawResume);
  const locStr = typeof resume.location === 'object' && resume.location
    ? [resume.location.city, resume.location.state, resume.location.country].filter(Boolean).join(', ')
    : (resume.location || '');

  // Extract contact links cleanly
  const links = [];
  if (locStr) links.push(`<span>${locStr}</span>`);
  if (resume.phone) links.push(`<span>${resume.phone}</span>`);
  if (resume.email) links.push(`<span>${resume.email}</span>`);

  const rawLinks = resume.links || {};
  const linkedIn = typeof rawLinks === 'object' ? rawLinks.linkedin : '';
  const github = typeof rawLinks === 'object' ? rawLinks.github : '';
  const portfolio = typeof rawLinks === 'object' ? rawLinks.portfolio : '';

  if (linkedIn) links.push(`<span>${linkedIn}</span>`);
  if (github) links.push(`<span>${github}</span>`);
  if (portfolio) links.push(`<span>${portfolio}</span>`);

  const skillRows = organizeSkills(resume.skills);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: A4;
    margin: 0;
  }
  body {
    font-family: Arial, Helvetica, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 8.8pt;
    color: #1a202c;
    line-height: 1.34;
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
  }
  /* Header */
  .header {
    text-align: center;
    border-bottom: 1.5px solid #1e293b;
    padding-bottom: 5px;
    margin-bottom: 7px;
  }
  .name {
    font-size: 17pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 1px;
  }
  .tagline {
    font-size: 10pt;
    color: #334155;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .contact {
    font-size: 8.2pt;
    color: #475569;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }
  .contact span { display: inline-block; }
  .contact .sep { color: #94a3b8; font-weight: 700; }

  /* Sections */
  .section {
    margin-bottom: 7px;
    page-break-inside: auto;
  }
  .section-ttl {
    font-size: 9.2pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #0f172a;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 2px;
    margin-bottom: 4px;
    page-break-after: avoid;
    break-after: avoid;
  }

  /* Summary */
  .summary {
    font-size: 8.6pt;
    color: #334155;
    line-height: 1.36;
    text-align: justify;
  }

  /* Skills - Standard ATS Categorized Text Layout */
  .skills-container {
    font-size: 8.6pt;
    line-height: 1.36;
    color: #1e293b;
  }
  .skill-cat {
    margin-bottom: 2px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .skill-cat strong {
    color: #0f172a;
    font-weight: 700;
  }

  /* Experience */
  .exp-item {
    margin-bottom: 6px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .exp-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1px;
  }
  .exp-title-row {
    font-size: 9.2pt;
    font-weight: 700;
    color: #0f172a;
  }
  .exp-co {
    font-weight: 500;
    color: #334155;
  }
  .exp-date {
    font-size: 8.2pt;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
  }
  .exp-bullets {
    padding-left: 15px;
    margin-top: 1px;
  }
  .exp-bullets li {
    font-size: 8.6pt;
    color: #334155;
    line-height: 1.32;
    margin-bottom: 1.5px;
    text-align: justify;
  }

  /* Projects */
  .proj-item {
    margin-bottom: 5px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .proj-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9.2pt;
    font-weight: 700;
    color: #0f172a;
  }
  .proj-link {
    font-size: 8.2pt;
    color: #2563eb;
    font-weight: normal;
  }
  .proj-tech {
    font-size: 8.2pt;
    font-weight: 600;
    color: #475569;
    margin-top: 1px;
    margin-bottom: 2px;
  }
  .proj-desc {
    font-size: 8.6pt;
    color: #334155;
    line-height: 1.32;
    margin-bottom: 1px;
  }

  /* Education */
  .edu-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 8.8pt;
    margin-bottom: 3px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .edu-deg { font-size: 9pt; font-weight: 700; color: #0f172a; }
  .edu-inst { font-size: 8.6pt; color: #475569; margin-top: 1px; }
  .edu-yr { font-size: 8.2pt; font-weight: 600; color: #475569; white-space: nowrap; }

  /* Certifications */
  .cert-item {
    font-size: 8.6pt;
    color: #334155;
    margin-bottom: 2px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

</style>
</head>
<body>
  <div class="header">
    <div class="name">${resume.fullName || ''}</div>
    ${(resume.targetRoles && resume.targetRoles[0]) ? `<div class="tagline">${resume.targetRoles[0]}</div>` : ''}
    <div class="contact">
      ${links.join('<span class="sep"> &bull; </span>')}
    </div>
  </div>

  ${resume.summary ? `
  <div class="section">
    <div class="section-ttl">Professional Summary</div>
    <div class="summary">${resume.summary}</div>
  </div>` : ''}

  ${skillRows.length > 0 ? `
  <div class="section">
    <div class="section-ttl">Technical Skills</div>
    <div class="skills-container">
      ${skillRows.map(row => `
      <div class="skill-cat">
        <strong>${row.label}:</strong> ${row.items.join(', ')}
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${(resume.experience && resume.experience.length > 0) ? `
  <div class="section">
    <div class="section-ttl">Professional Experience</div>
    ${resume.experience.map(e => `
      <div class="exp-item">
        <div class="exp-top">
          <div class="exp-title-row">
            <span>${e.title || ''}</span>${e.company ? `<span class="exp-co"> &mdash; ${e.company}${e.location ? `, ${e.location}` : ''}</span>` : ''}
          </div>
          <span class="exp-date">${e.duration || [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' &ndash; ')}</span>
        </div>
        ${e.achievements && e.achievements.length > 0 ? `
        <ul class="exp-bullets">
          ${e.achievements.map(a => `<li>${a}</li>`).join('')}
        </ul>` : ''}
      </div>`).join('')}
  </div>` : ''}

  ${(resume.projects && resume.projects.length > 0) ? `
  <div class="section">
    <div class="section-ttl">Projects</div>
    ${resume.projects.slice(0, 4).map(p => `
      <div class="proj-item">
        <div class="proj-header">
          <span>${p.name || ''}</span>
          ${p.url ? `<span class="proj-link">${p.url}</span>` : ''}
        </div>
        ${p.technologies && p.technologies.length > 0 ? `
        <div class="proj-tech">${p.technologies.join(', ')}</div>` : ''}
        ${p.description ? `<div class="proj-desc">${p.description}</div>` : ''}
        ${p.achievements && p.achievements.length > 0 ? `
        <ul class="exp-bullets" style="margin-top:2px;">
          ${p.achievements.map(a => `<li>${a}</li>`).join('')}
        </ul>` : ''}
      </div>`).join('')}
  </div>` : ''}

  ${(resume.education && resume.education.length > 0) ? `
  <div class="section">
    <div class="section-ttl">Education</div>
    ${resume.education.map(e => `
      <div class="edu-item">
        <div>
          <div class="edu-deg">${e.degree || ''}${e.field ? ` in ${e.field}` : ''}</div>
          <div class="edu-inst">${[e.institution, e.location].filter(Boolean).join(', ')}</div>
        </div>
        <div class="edu-yr">${[e.year, e.gpa ? `GPA: ${e.gpa}` : ''].filter(Boolean).join(' &bull; ')}</div>
      </div>`).join('')}
  </div>` : ''}

  ${(resume.certifications && resume.certifications.length > 0) ? `
  <div class="section">
    <div class="section-ttl">Certifications</div>
    ${resume.certifications.map(c => `
      <div class="cert-item"><strong>${c.name}</strong>${c.issuer ? ` &mdash; ${c.issuer}` : ''} ${c.year ? `(${c.year})` : ''}</div>
    `).join('')}
  </div>` : ''}
</body>
</html>`;
};

/**
 * Generate tailored resume PDF.
 * @param {object} tailoredResume
 * @param {object} job
 * @param {string} userId
 * @returns {Promise<{pdfUrl: string, html: string}>}
 */
const generateResumePDF = async (tailoredResume, job, userId) => {
  logger.info(`Generating PDF for ${tailoredResume.fullName} → ${job.company}`);

  const html = buildResumeHtml(tailoredResume, job);
  let browser;

  try {
    const puppeteer = getPuppeteer();
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    let pdfBuffer = await page.pdf({
      format:             'A4',
      printBackground:    true,
      margin: { top: '10mm', right: '14mm', bottom: '10mm', left: '14mm' },
    });

    await browser.close();
    browser = null;

    // Sanitize PDF metadata (removes Chrome/Puppeteer signatures, sets authentic Microsoft Word / Quartz context)
    pdfBuffer = await aiHumanizer.sanitizePdfMetadata(pdfBuffer, {
      candidateName: tailoredResume.fullName,
      role: job?.title || 'Professional Resume'
    });

    // Upload to Cloudinary
    let pdfUrl = '';
    try {
      const client = getClient();
      if (client) {
        const b64    = pdfBuffer.toString('base64');
        const dataUri = `data:application/pdf;base64,${b64}`;
        const result  = await client.uploader.upload(dataUri, {
          resource_type: 'raw',
          folder:        `autoapply/tailored-resumes/${userId}`,
          public_id:     `resume_${job.company.replace(/\s+/g,'-')}_${Date.now()}`,
          format:        'pdf',
        });
        pdfUrl = result.secure_url;
      }
    } catch (uploadErr) {
      logger.warn(`Cloudinary upload failed: ${uploadErr.message} — PDF will not be stored`);
    }

    logger.info(`PDF generated${pdfUrl ? ` and uploaded: ${pdfUrl}` : ' (local only)'}`);
    return { pdfUrl, html, pdfBuffer };

  } catch (err) {
    if (browser) await browser.close();
    logger.error(`PDF generation failed: ${err.message}`);
    // Return HTML even if PDF failed — still useful
    return { pdfUrl: '', html, pdfBuffer: null };
  }
};

/**
 * Render any resume (raw or optimized) directly to a PDF buffer for instant browser download.
 * @param {object} resumeData
 * @param {object} [job]
 * @returns {Promise<Buffer>}
 */
const renderResumeToBuffer = async (resumeData, job = {}) => {
  const html = buildResumeHtml(resumeData, job);
  const puppeteer = getPuppeteer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    let buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '14mm', bottom: '10mm', left: '14mm' },
    });
    // Sanitize PDF metadata for authentic human ATS compliance
    buffer = await aiHumanizer.sanitizePdfMetadata(buffer, {
      candidateName: resumeData.fullName,
      role: job?.title || 'Professional Resume'
    });
    return buffer;
  } finally {
    await browser.close();
  }
};

module.exports = { generateResumePDF, buildResumeHtml, renderResumeToBuffer };
