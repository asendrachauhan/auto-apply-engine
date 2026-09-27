'use strict';
const express = require('express');
const router  = express.Router();
const { protect, requireVerifiedEmail } = require('../middleware/auth.middleware');
const { upload }   = require('../middleware/upload.middleware');
const Resume       = require('../models/Resume');
const { parseText, parseResume } = require('../services/ai/resumeParser.service');
const { optimizeResume }         = require('../services/ai/resumeOptimizer.service');
const cloudinary   = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP }     = require('../utils/constants');
const logger       = require('../utils/logger');

// POST /api/resume/upload
router.post('/upload', protect, requireVerifiedEmail, upload.single('resume'), async (req, res, next) => {
  try {
    let rawText, parsedData;

    if (req.file) {
      // parseResume() routes to the correct extractor by mimetype (PDF via
      // pdf-parse, DOCX/DOC/TXT as text) — previously this route ran every
      // uploaded file through pdf-parse unconditionally, which silently
      // broke DOC/DOCX uploads (pdf-parse would throw on a non-PDF buffer,
      // producing a misleading "Could not extract text from PDF" error).
      try {
        ({ rawText, parsed: parsedData } = await parseResume(req.file.buffer, req.file.mimetype));
      } catch (e) {
        logger.warn(`Resume parse error: ${e.message}`);
        return sendError(res, HTTP.BAD_REQUEST, 'Could not extract text from that file. Please paste your resume text instead.');
      }
    } else {
      rawText = req.body.text || '';
      if (!rawText || rawText.trim().length < 50) {
        return sendError(res, HTTP.BAD_REQUEST, 'Resume content is too short. Please provide a complete resume.');
      }
      parsedData = await parseText(rawText);
    }

    const optimizedData = await optimizeResume(parsedData);

    // Upload PDF to Cloudinary if file provided
    let originalPdfUrl = null, cloudinaryId = null;
    if (req.file) {
      try {
        const cl = cloudinary.getClient();
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

    const resume = await Resume.findOneAndUpdate(
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

// POST /api/resume/reoptimize — Re-optimizes the user's existing saved resume without re-uploading
router.post('/reoptimize', protect, requireVerifiedEmail, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id }).select('+rawText');
    if (!resume) {
      return sendError(res, HTTP.NOT_FOUND, 'No resume found. Please upload a resume first.');
    }

    let parsedData = resume.parsedData;
    let rawText = resume.rawText;

    // If rawText exists, re-parse with high token budget if parsedData was incomplete
    if (rawText && (!parsedData?.experience?.length || !parsedData?.projects?.length)) {
      try {
        parsedData = await parseText(rawText);
      } catch (e) {
        logger.warn(`Re-parse error during reoptimize: ${e.message}`);
      }
    }

    if (!parsedData) {
      return sendError(res, HTTP.BAD_REQUEST, 'Resume data is missing. Please re-upload your resume.');
    }

    const optimizedData = await optimizeResume(parsedData);

    const prevScore = resume.atsScore || 0;
    if (optimizedData.atsScore < prevScore && resume.optimizedData) {
      logger.info(`[Reoptimize] Optimizer produced score ${optimizedData.atsScore} vs previous ${prevScore}. Protecting candidate score.`);
      optimizedData.atsScore = prevScore;
    }

    resume.parsedData = parsedData;
    resume.optimizedData = optimizedData;
    resume.atsScore = Math.max(prevScore, optimizedData.atsScore || 0);
    resume.version = (resume.version || 1) + 1;
    await resume.save();

    return sendSuccess(res, HTTP.OK, 'Resume re-optimised successfully', {
      atsScore: resume.atsScore,
      parsedData: resume.parsedData,
      optimizedData: resume.optimizedData,
      originalPdfUrl: resume.originalPdfUrl,
    });
  } catch (err) { next(err); }
});

// GET /api/resume/my
router.get('/my', protect, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id }).select('-rawText');
    if (!resume) return sendError(res, HTTP.NOT_FOUND, 'No resume found. Please upload your resume first.');

    // Ensure real ATS score is present and up to date
    const { calculateAtsScore } = require('../utils/atsScorer');
    const dataForAts = resume.optimizedData || resume.parsedData || {};
    const atsResult = calculateAtsScore(dataForAts);
    if (!resume.atsScore) {
      resume.atsScore = atsResult.score;
      await Resume.updateOne({ _id: resume._id }, { $set: { atsScore: atsResult.score } }).catch(() => {});
    }

    const resumeObj = resume.toObject ? resume.toObject() : { ...resume };
    resumeObj.atsBreakdown = atsResult.breakdown;
    resumeObj.atsStrengths = atsResult.strengths;
    resumeObj.atsImprovements = atsResult.improvements;

    return sendSuccess(res, HTTP.OK, 'Resume', resumeObj);
  } catch (err) { next(err); }
});

// GET /api/resume/download-pdf — instant download of optimized resume PDF
router.get('/download-pdf', protect, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume || (!resume.optimizedData && !resume.parsedData)) {
      return sendError(res, HTTP.NOT_FOUND, 'No resume found to download. Please upload your resume first.');
    }

    const { renderResumeToBuffer } = require('../services/resume/pdfGenerator.service');
    const resumeData = resume.optimizedData || resume.parsedData;
    const pdfBuffer = await renderResumeToBuffer(resumeData, null);

    const safeName = (resumeData.fullName || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_ATS_Optimized.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    logger.error(`Failed to generate resume PDF: ${err.message}`);
    next(err);
  }
});

// GET /api/resume/evaluate-ats — real-time ATS analysis
router.get('/evaluate-ats', protect, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume) return sendError(res, HTTP.NOT_FOUND, 'No resume found.');

    const { calculateAtsScore } = require('../utils/atsScorer');
    const atsResult = calculateAtsScore(resume.optimizedData || resume.parsedData || {});
    await Resume.updateOne({ _id: resume._id }, { $set: { atsScore: atsResult.score } });

    return sendSuccess(res, HTTP.OK, 'ATS Evaluation', atsResult);
  } catch (err) { next(err); }
});

module.exports = router;
