'use strict';
const express = require('express');
const router  = express.Router();
const { protect, requireVerifiedEmail } = require('../middleware/auth.middleware');
const { upload }   = require('../middleware/upload.middleware');
const Resume       = require('../models/Resume');
const groq         = require('../config/groq');
const cloudinary   = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP }     = require('../utils/constants');
const logger       = require('../utils/logger');
const pdfParse     = require('pdf-parse');

const PARSE_PROMPT = `You are an expert ATS resume parser. Extract ALL information from this resume text.
Return ONLY a valid JSON object with NO markdown, NO explanation:
{
  "fullName":"","email":"","phone":"","location":{"city":"","country":"","remote":false},
  "summary":"","targetRoles":[],
  "skills":{"technical":[],"soft":[],"tools":[],"languages":[]},
  "experience":[{"company":"","title":"","duration":"","startDate":"","endDate":"","current":false,"achievements":[],"technologies":[]}],
  "education":[{"institution":"","degree":"","field":"","year":"","gpa":""}],
  "certifications":[{"name":"","issuer":"","year":""}],
  "projects":[{"name":"","description":"","technologies":[],"url":""}],
  "links":{"linkedin":"","github":"","portfolio":""}
}
Resume text: `;

const OPTIMIZE_PROMPT = `You are a world-class ATS resume optimization expert.
Rewrite and optimize this resume to achieve maximum ATS score. Keep all facts TRUE.
Rules:
1. Use strong action verbs: Led, Built, Engineered, Optimized, Reduced, Delivered
2. Quantify ALL achievements with metrics (%, numbers, time saved)
3. Every bullet: [Action verb] + [What you did] + [Result/Impact]
4. Add relevant ATS keywords for the candidate's field
5. Remove weak phrases: "responsible for", "helped with", "worked on"
Return ONLY valid JSON with same structure plus:
"atsScore": number 0-100, "improvementSummary": string[], "keywordsAdded": string[]
Input: `;

// POST /api/resume/upload
router.post('/upload', protect, requireVerifiedEmail, upload.single('resume'), async (req, res, next) => {
  try {
    let rawText = req.body.text || '';

    if (req.file) {
      try {
        const parsed = await pdfParse(req.file.buffer);
        rawText = parsed.text;
      } catch (e) {
        logger.warn(`PDF parse error: ${e.message}`);
        if (!rawText) return sendError(res, HTTP.BAD_REQUEST, 'Could not extract text from PDF. Please paste your resume text instead.');
      }
    }

    if (!rawText || rawText.trim().length < 50)
      return sendError(res, HTTP.BAD_REQUEST, 'Resume content is too short. Please provide a complete resume.');

    // Parse with Groq
    const parseRaw  = await groq.chat([{ role: 'user', content: PARSE_PROMPT + rawText.slice(0, 8000) }], { maxTokens: 2000 });
    const parsedData = groq.parseJSON(parseRaw);

    // Optimize
    const optRaw      = await groq.chat([{ role: 'user', content: OPTIMIZE_PROMPT + JSON.stringify(parsedData) }], { maxTokens: 2000 });
    const optimizedData = groq.parseJSON(optRaw);

    // Upload PDF to Cloudinary if file provided
    let originalPdfUrl = null, cloudinaryId = null;
    if (req.file) {
      try {
        const cl = require('../config/cloudinary').getClient();
        if (cl) {
          const result = await new Promise((resolve, reject) => {
            cl.uploader.upload_stream({ resource_type: 'raw', folder: 'resumes', public_id: `resume_${req.user._id}` },
              (err, result) => err ? reject(err) : resolve(result)
            ).end(req.file.buffer);
          });
          originalPdfUrl = result.secure_url;
          cloudinaryId   = result.public_id;
        }
      } catch (e) { logger.warn(`Cloudinary upload failed: ${e.message}`); }
    }

    const resume = await require('../models/Resume').findOneAndUpdate(
      { userId: req.user._id },
      { userId: req.user._id, originalPdfUrl, cloudinaryId, parsedData, optimizedData,
        atsScore: optimizedData.atsScore || null, rawText: rawText.slice(0, 50000) },
      { upsert: true, new: true, runValidators: true }
    );

    return sendSuccess(res, HTTP.OK, 'Resume parsed and optimised', {
      atsScore:        resume.atsScore,
      parsedData:      resume.parsedData,
      optimizedData:   resume.optimizedData,
      originalPdfUrl:  resume.originalPdfUrl,
    });
  } catch (err) { next(err); }
});

// GET /api/resume/my
router.get('/my', protect, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id }).select('-rawText');
    if (!resume) return sendError(res, HTTP.NOT_FOUND, 'No resume found. Please upload your resume first.');
    return sendSuccess(res, HTTP.OK, 'Resume', resume);
  } catch (err) { next(err); }
});

module.exports = router;
