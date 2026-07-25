/**
 * Resume parsing service.
 * Extracts raw text from PDF/DOC buffers, then uses Groq to structure it.
 */

const pdfParse = require('pdf-parse');
const groq = require('./groq.service');
const logger = require('../../utils/logger');

const PARSE_PROMPT = `You are an expert ATS resume parser with 20 years of HR experience.
Parse the resume text below and return ONLY a valid JSON object — no markdown, no explanation, no preamble.

JSON structure (all fields optional except fullName):
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "location": { "city": "string", "country": "string", "remote": false },
  "summary": "string",
  "targetRoles": ["string"],
  "skills": {
    "technical": ["string"],
    "soft": ["string"],
    "tools": ["string"],
    "languages": ["string"]
  },
  "experience": [{
    "company": "string",
    "title": "string",
    "duration": "string",
    "startDate": "string",
    "endDate": "string",
    "current": false,
    "achievements": ["string"],
    "technologies": ["string"]
  }],
  "education": [{ "institution": "string", "degree": "string", "field": "string", "year": "string", "gpa": "string" }],
  "certifications": [{ "name": "string", "issuer": "string", "year": "string" }],
  "projects": [{ "name": "string", "description": "string", "technologies": ["string"], "url": "string" }],
  "links": { "linkedin": "string", "github": "string", "portfolio": "string" }
}

Resume text:
`;

/**
 * Extract plain text from a PDF buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
const extractTextFromPDF = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};

/**
 * Extract plain text from a plain-text buffer (.txt).
 * @param {Buffer} buffer
 * @returns {string}
 */
const extractTextFromTxt = (buffer) => buffer.toString('utf-8');

/**
 * Route to the correct extractor based on MIME type.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>}
 */
const extractText = async (buffer, mimeType) => {
  if (mimeType === 'application/pdf') return extractTextFromPDF(buffer);
  if (mimeType === 'text/plain')       return extractTextFromTxt(buffer);
  // For DOCX: fall back to treating as text (proper DOCX parsing can be added with mammoth)
  return buffer.toString('utf-8');
};

/**
 * Full pipeline: buffer → raw text → structured JSON.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<object>}
 */
const parseResume = async (buffer, mimeType) => {
  logger.info('Extracting text from resume buffer…');
  const rawText = await extractText(buffer, mimeType);

  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Could not extract enough text from the uploaded file');
  }

  logger.info('Sending resume to Groq for parsing…');
  const aiResponse = await groq.chat(
    [{ role: 'user', content: PARSE_PROMPT + rawText.slice(0, 6000) }],
    { maxTokens: 2000, temperature: 0.1 }
  );

  const parsed = groq.parseJSON(aiResponse);
  logger.info(`Resume parsed successfully for: ${parsed.fullName || 'Unknown'}`);

  return { rawText, parsed };
};

module.exports = { parseResume };
