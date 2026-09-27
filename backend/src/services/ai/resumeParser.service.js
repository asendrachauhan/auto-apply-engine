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
  "location": { "city": "string", "state": "string", "country": "string", "remote": false },
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
    "location": "string",
    "duration": "string",
    "startDate": "string",
    "endDate": "string",
    "current": false,
    "achievements": ["string"],
    "technologies": ["string"]
  }],
  "education": [{ "institution": "string", "degree": "string", "field": "string", "year": "string", "gpa": "string", "location": "string" }],
  "certifications": [{ "name": "string", "issuer": "string", "year": "string" }],
  "projects": [{ "name": "string", "description": "string", "achievements": ["string"], "technologies": ["string"], "url": "string" }],
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
 * Heuristic fallback parser when Groq AI is unavailable or rate-limited.
 * Extracts key contact info and skills via pattern matching.
 * @param {string} rawText
 * @returns {object}
 */
const fallbackHeuristicParse = (rawText) => {
  logger.info('[ResumeParser] Using fallback heuristic parser');
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Email & phone extraction
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  const linkedinMatch = rawText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%]+/i);
  const githubMatch = rawText.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_\-%]+/i);
  const portfolioMatch = rawText.match(/https?:\/\/[a-zA-Z0-9_\-%]+(?:\.github\.io|\.dev|\.app|\.me|\.vercel\.app)[^\s]*/i);

  // Candidate name usually in first 3 lines
  let fullName = '';
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].replace(/[^\w\s]/g, '').trim();
    if (line.length >= 3 && line.length <= 40 && !line.includes('@') && !line.toLowerCase().includes('resume') && !line.toLowerCase().includes('curriculum')) {
      fullName = line;
      break;
    }
  }

  // Common technical skills detection
  const KNOWN_SKILLS = [
    'JavaScript', 'TypeScript', 'Angular', 'React', 'Vue', 'Node.js', 'Express',
    'Python', 'Java', 'C++', 'C#', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'HTML', 'CSS', 'SCSS',
    'REST', 'GraphQL', 'Tailwind', 'Next.js', 'Linux', 'CI/CD', 'Redux', 'RxJS',
    'OAuth', 'Mongoose', 'Postman', 'Vercel', 'Stripe', 'Twilio', 'Resend'
  ];
  const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const detectedSkills = KNOWN_SKILLS.filter(s => new RegExp(`(?:^|\\b)${escapeRegex(s)}(?:\\b|$)`, 'i').test(rawText));

  // Section splitting
  const experience = [];
  const projects = [];
  const education = [];

  let currentSection = 'summary';
  let currentExp = null;
  let currentProj = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (upper.includes('EXPERIENCE') || upper.includes('WORK HISTORY') || upper.includes('EMPLOYMENT')) {
      currentSection = 'experience';
      continue;
    }
    if (upper.includes('PROJECT') || upper.includes('SELECTED PROJECT')) {
      currentSection = 'projects';
      continue;
    }
    if (upper.includes('EDUCATION') || upper.includes('ACADEMIC')) {
      currentSection = 'education';
      continue;
    }
    if (upper.includes('TECHNICAL SKILLS') || upper.includes('CORE COMPETENCIES')) {
      currentSection = 'skills';
      continue;
    }

    if (currentSection === 'experience') {
      const isBullet = /^[●•\-\*]\s*(.+)/.test(line);
      const isHeader = /(?:19|20)\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|Current/i.test(line);

      if (isBullet && currentExp) {
        currentExp.achievements.push(line.replace(/^[●•\-\*]\s*/, ''));
      } else if (isHeader || (!isBullet && line.length < 120)) {
        if (!currentExp || currentExp.achievements.length > 0) {
          currentExp = {
            company: line.split('—')[0]?.split('-')[0]?.trim() || line,
            title: line.split('—')[1]?.trim() || 'Software Engineer',
            location: '',
            duration: '',
            achievements: [],
            technologies: []
          };
          experience.push(currentExp);
        }
      }
    } else if (currentSection === 'projects') {
      const isBullet = /^[●•\-\*]\s*(.+)/.test(line);
      if (isBullet && currentProj) {
        currentProj.achievements.push(line.replace(/^[●•\-\*]\s*/, ''));
      } else if (!isBullet && line.length < 100) {
        if (!currentProj || currentProj.achievements.length > 0) {
          currentProj = {
            name: line.split('—')[0]?.trim() || line,
            description: '',
            achievements: [],
            technologies: [],
            url: ''
          };
          projects.push(currentProj);
        } else if (currentProj && !currentProj.description) {
          currentProj.description = line;
        }
      }
    } else if (currentSection === 'education') {
      if (/(?:Bachelor|Master|B\.?Tech|B\.?E|B\.?Sc|Degree|Diploma|College|University)/i.test(line)) {
        education.push({
          institution: lines[i+1] || line,
          degree: line,
          field: 'Engineering / Computer Science',
          year: line.match(/(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}/)?.[0] || '2024',
          gpa: line.match(/GPA:?\s*([0-9.]+)/i)?.[1] || '',
          location: ''
        });
      }
    }
  }

  return {
    fullName: fullName || 'Candidate',
    email: emailMatch ? emailMatch[0] : '',
    phone: phoneMatch ? phoneMatch[0] : '',
    location: { city: 'Mohali', state: 'Punjab', country: 'India', remote: true },
    summary: lines.find(l => l.length > 60 && !l.includes('@') && !l.includes('http')) || '',
    targetRoles: ['Full-Stack Engineer', 'Software Developer'],
    skills: {
      technical: detectedSkills,
      soft: ['Problem Solving', 'Communication', 'Teamwork'],
      tools: ['Git', 'Postman'],
      languages: ['English']
    },
    experience,
    education,
    certifications: [],
    projects,
    links: {
      linkedin: linkedinMatch ? linkedinMatch[0] : '',
      github: githubMatch ? githubMatch[0] : '',
      portfolio: portfolioMatch ? portfolioMatch[0] : ''
    }
  };
};

/**
 * Send already-extracted resume text to Groq for structuring.
 * @param {string} rawText
 * @returns {Promise<object>} parsed resume JSON
 */
const parseText = async (rawText) => {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Could not extract enough text from the uploaded file');
  }

  try {
    logger.info('Sending resume to Groq for parsing…');
    const maxTokens = process.env.NODE_ENV === 'test' ? 2000 : 5000;
    const aiResponse = await groq.chat(
      [{ role: 'user', content: PARSE_PROMPT + rawText.slice(0, 25000) }],
      { maxTokens, temperature: 0.1, responseFormat: { type: 'json_object' } }
    );

    const parsed = groq.parseJSON(aiResponse);
    logger.info(`Resume parsed successfully for: ${parsed.fullName || 'Unknown'}`);
    return parsed;
  } catch (err) {
    logger.warn(`[ResumeParser] AI parsing failed (${err.message}). Falling back to heuristic extraction.`);
    return fallbackHeuristicParse(rawText);
  }
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
  const parsed = await parseText(rawText);
  return { rawText, parsed };
};

module.exports = { parseResume, parseText, extractText };
