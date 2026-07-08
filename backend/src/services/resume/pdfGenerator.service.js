/**
 * PDF Generator Service.
 * Generates a beautiful, ATS-optimised PDF of the tailored resume.
 * Uses Puppeteer (already installed) to render HTML → PDF.
 * Uploads to Cloudinary and returns the URL.
 */

const puppeteer = require('puppeteer');
const { cloudinary } = require('../../config/cloudinary');
const logger = require('../../utils/logger');

/**
 * Build resume HTML template.
 * Clean, single-column, ATS-friendly layout.
 */
const buildResumeHtml = (resume, job) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 11pt; color: #1a202c; line-height: 1.5;
    padding: 36px 40px; background: #fff;
  }
  /* Header */
  .header    { border-bottom: 2px solid #6c63ff; padding-bottom: 12px; margin-bottom: 18px; }
  .name      { font-size: 22pt; font-weight: 700; color: #1a202c; letter-spacing: -.3px; }
  .tagline   { font-size: 11pt; color: #6c63ff; font-weight: 600; margin-top: 2px; }
  .contact   { font-size: 9.5pt; color: #4a5568; margin-top: 6px; }
  .contact span { margin-right: 18px; }
  /* Section */
  .section     { margin-bottom: 16px; }
  .section-ttl { font-size: 10.5pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: #6c63ff; border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px; margin-bottom: 10px; }
  /* Summary */
  .summary   { font-size: 10.5pt; color: #2d3748; line-height: 1.6; }
  /* Skills */
  .skills    { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill-tag { background: #f0f0ff; color: #6c63ff; padding: 2px 9px;
    border-radius: 4px; font-size: 9.5pt; font-weight: 500; }
  /* Experience */
  .exp-item  { margin-bottom: 14px; }
  .exp-top   { display: flex; justify-content: space-between; align-items: baseline; }
  .exp-title { font-size: 11pt; font-weight: 700; color: #1a202c; }
  .exp-co    { font-size: 10.5pt; color: #4a5568; }
  .exp-date  { font-size: 9.5pt; color: #718096; white-space: nowrap; }
  .exp-bullets { padding-left: 16px; margin-top: 4px; }
  .exp-bullets li { font-size: 10pt; color: #2d3748; margin-bottom: 3px; }
  .exp-tech  { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .tech-tag  { background: #f7fafc; border: 1px solid #e2e8f0; color: #4a5568;
    padding: 1px 7px; border-radius: 3px; font-size: 8.5pt; }
  /* Education */
  .edu-item  { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .edu-deg   { font-size: 10.5pt; font-weight: 600; }
  .edu-inst  { font-size: 10pt; color: #4a5568; }
  .edu-yr    { font-size: 9.5pt; color: #718096; }
  /* Tailored note */
  .tailored  { background: #f0f0ff; border-left: 3px solid #6c63ff;
    padding: 6px 10px; margin-bottom: 16px; font-size: 9pt; color: #4a5568; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">${resume.fullName || ''}</div>
    <div class="tagline">${(resume.targetRoles || [])[0] || ''}</div>
    <div class="contact">
      ${[
        resume.email ? resume.email : '',
        resume.phone ? resume.phone : '',
        resume.links?.linkedin ? resume.links.linkedin : '',
        resume.links?.github ? resume.links.github : '',
        resume.links?.portfolio ? resume.links.portfolio : '',
      ].filter(Boolean).map(v => `<span>${v}</span>`).join('<span class="sep"> &middot; </span>')}
    </div>
  </div>

  ${job ? `<div class="tailored">Tailored for: <strong>${job.title} at ${job.company}</strong> — ATS optimised to match job requirements</div>` : ''}

  <div class="section">
    <div class="section-ttl">Professional Summary</div>
    <div class="summary">${resume.summary || ''}</div>
  </div>

  ${(resume.skills?.technical?.length || resume.skills?.tools?.length) ? `
  <div class="section">
    <div class="section-ttl">Technical Skills</div>
    <div class="skills">
      ${[...(resume.skills?.technical || []), ...(resume.skills?.tools || [])]
        .map(s => `<span class="skill-tag">${s}</span>`).join('')}
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-ttl">Experience</div>
    ${(resume.experience || []).map(e => `
      <div class="exp-item">
        <div class="exp-top">
          <div>
            <span class="exp-title">${e.title || ''}</span>
            <span class="exp-co"> · ${e.company || ''}</span>
          </div>
          <span class="exp-date">${e.duration || ''}</span>
        </div>
        <ul class="exp-bullets">
          ${(e.achievements || []).map(a => `<li>${a}</li>`).join('')}
        </ul>
        ${e.technologies?.length ? `<div class="exp-tech">${e.technologies.map(t => `<span class="tech-tag">${t}</span>`).join('')}</div>` : ''}
      </div>`).join('')}
  </div>

  ${(resume.education?.length) ? `
  <div class="section">
    <div class="section-ttl">Education</div>
    ${(resume.education || []).map(e => `
      <div class="edu-item">
        <div>
          <div class="edu-deg">${e.degree || ''} ${e.field ? `in ${e.field}` : ''}</div>
          <div class="edu-inst">${e.institution || ''}</div>
        </div>
        <div class="edu-yr">${e.year || ''} ${e.gpa ? `· GPA: ${e.gpa}` : ''}</div>
      </div>`).join('')}
  </div>` : ''}

  ${(resume.certifications?.length) ? `
  <div class="section">
    <div class="section-ttl">Certifications</div>
    ${(resume.certifications || []).map(c => `<div style="font-size:10pt;margin-bottom:4px;"><strong>${c.name}</strong> · ${c.issuer || ''} ${c.year ? `(${c.year})` : ''}</div>`).join('')}
  </div>` : ''}

  ${(resume.projects?.length) ? `
  <div class="section">
    <div class="section-ttl">Projects</div>
    ${(resume.projects || []).slice(0,3).map(p => `
      <div style="margin-bottom:8px;">
        <strong>${p.name}</strong>${p.url ? ` · <span style="color:#6c63ff;">${p.url}</span>` : ''}
        <div style="font-size:9.5pt;color:#4a5568;margin-top:2px;">${p.description || ''}</div>
        ${p.technologies?.length ? `<div class="exp-tech" style="margin-top:4px;">${p.technologies.map(t=>`<span class="tech-tag">${t}</span>`).join('')}</div>` : ''}
      </div>`).join('')}
  </div>` : ''}
</body>
</html>`;

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
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format:             'A4',
      printBackground:    true,
      margin: { top:'20mm', right:'15mm', bottom:'20mm', left:'15mm' },
    });

    await browser.close();
    browser = null;

    // Upload to Cloudinary
    let pdfUrl = '';
    try {
      const b64    = pdfBuffer.toString('base64');
      const dataUri = `data:application/pdf;base64,${b64}`;
      const result  = await cloudinary.uploader.upload(dataUri, {
        resource_type: 'raw',
        folder:        `autoapply/tailored-resumes/${userId}`,
        public_id:     `resume_${job.company.replace(/\s+/g,'-')}_${Date.now()}`,
        format:        'pdf',
      });
      pdfUrl = result.secure_url;
    } catch (uploadErr) {
      logger.warn(`Cloudinary upload failed: ${uploadErr.message} — PDF will not be stored`);
    }

    logger.info(`PDF generated${pdfUrl ? ` and uploaded: ${pdfUrl}` : ' (local only)'}`);
    return { pdfUrl, html };

  } catch (err) {
    if (browser) await browser.close();
    logger.error(`PDF generation failed: ${err.message}`);
    // Return HTML even if PDF failed — still useful
    return { pdfUrl: '', html };
  }
};

module.exports = { generateResumePDF, buildResumeHtml };
