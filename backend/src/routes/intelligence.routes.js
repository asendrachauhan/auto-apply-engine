'use strict';
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { convertCTCToEuropean, checkVisaEligibility, getEuropeanResumeGuidance, getAllPathways } = require('../services/intelligence/indiaToEurope.service');
const Resume  = require('../models/Resume');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { HTTP } = require('../utils/constants');

router.get('/eu/pathways', protect, (req, res) =>
  sendSuccess(res, HTTP.OK, 'EU visa pathways', getAllPathways())
);
router.post('/eu/ctc-convert', protect, (req, res) => {
  const { ctcLPA, targetCountry = 'DE' } = req.body;
  if (!ctcLPA || isNaN(ctcLPA)) return sendError(res, HTTP.BAD_REQUEST, 'ctcLPA (number) is required');
  try { return sendSuccess(res, HTTP.OK, 'CTC conversion', convertCTCToEuropean(parseFloat(ctcLPA), targetCountry)); }
  catch (e) { return sendError(res, HTTP.BAD_REQUEST, e.message); }
});
router.get('/eu/visa/:country', protect, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume?.parsedData) return sendError(res, HTTP.NOT_FOUND, 'Upload your resume first');
    return sendSuccess(res, HTTP.OK, 'Visa eligibility', checkVisaEligibility(resume.parsedData, req.params.country.toUpperCase()));
  } catch (err) { next(err); }
});
router.get('/eu/resume-guide/:country', protect, async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume?.parsedData) return sendError(res, HTTP.NOT_FOUND, 'Upload your resume first');
    return sendSuccess(res, HTTP.OK, 'EU resume guidance', getEuropeanResumeGuidance(resume.parsedData, req.params.country.toUpperCase()));
  } catch (err) { next(err); }
});

module.exports = router;
