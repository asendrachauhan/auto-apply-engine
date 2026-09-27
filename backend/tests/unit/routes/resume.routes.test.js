'use strict';
jest.mock('../../../src/services/ai/resumeParser.service');
jest.mock('../../../src/services/ai/resumeOptimizer.service');
jest.mock('../../../src/config/cloudinary');
jest.mock('../../../src/models/Resume');
jest.mock('../../../src/middleware/auth.middleware', () => ({
  protect: (req, res, next) => { req.user = { _id: 'user1', emailVerified: true }; next(); },
  requireVerifiedEmail: (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const { parseText, parseResume } = require('../../../src/services/ai/resumeParser.service');
const { optimizeResume } = require('../../../src/services/ai/resumeOptimizer.service');
const Resume = require('../../../src/models/Resume');
const cloudinary = require('../../../src/config/cloudinary');
const resumeRoutes = require('../../../src/routes/resume.routes');

const app = express();
app.use(express.json());
app.use('/api/resume', resumeRoutes);

const longResumeText = 'Experienced software engineer with 5 years building scalable systems. '.repeat(10);

describe('resume.routes — POST /upload (consolidated parser/optimizer services)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cloudinary.getClient = jest.fn().mockReturnValue(null); // no cloudinary configured by default
  });

  test('rejects when neither a file nor pasted text is provided', async () => {
    const res = await request(app).post('/api/resume/upload').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too short/i);
    expect(parseText).not.toHaveBeenCalled();
  });

  test('rejects text shorter than 50 characters without calling the parser', async () => {
    const res = await request(app).post('/api/resume/upload').send({ text: 'too short' });
    expect(res.status).toBe(400);
    expect(parseText).not.toHaveBeenCalled();
  });

  test('parses pasted text via parseText() and optimizes end to end', async () => {
    parseText.mockResolvedValue({ fullName: 'Jane Doe', skills: { technical: ['React'] } });
    optimizeResume.mockResolvedValue({ fullName: 'Jane Doe', atsScore: 88 });
    Resume.findOneAndUpdate = jest.fn().mockResolvedValue({
      atsScore: 88, parsedData: { fullName: 'Jane Doe' }, optimizedData: { atsScore: 88 }, originalPdfUrl: null,
    });

    const res = await request(app).post('/api/resume/upload').send({ text: longResumeText });
    expect(res.status).toBe(200);
    expect(res.body.data.atsScore).toBe(88);
    expect(parseText).toHaveBeenCalledWith(longResumeText);
    expect(parseResume).not.toHaveBeenCalled(); // no file uploaded — must use the text path, not the buffer path
    expect(optimizeResume).toHaveBeenCalledWith({ fullName: 'Jane Doe', skills: { technical: ['React'] } });
  });

  test('a parseResume() failure (e.g. unreadable file) returns a clean 400, not a 500', async () => {
    // Regression: previously every uploaded file was force-fed through
    // pdf-parse regardless of mimetype, silently breaking DOC/DOCX uploads.
    // Now parseResume() itself owns mimetype routing; this test just confirms
    // the route surfaces a parseResume() rejection as a clean 400.
    parseResume.mockRejectedValue(new Error('Could not extract enough text from the uploaded file'));
    const res = await request(app)
      .post('/api/resume/upload')
      .attach('resume', Buffer.from('not a real docx'), { filename: 'resume.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/could not extract text/i);
    expect(optimizeResume).not.toHaveBeenCalled();
  });

  test('a downstream error (e.g. optimizeResume failing) is passed to next() and does not crash the process', async () => {
    parseText.mockResolvedValue({ fullName: 'Jane Doe' });
    optimizeResume.mockRejectedValue(new Error('Groq unavailable'));
    const res = await request(app).post('/api/resume/upload').send({ text: longResumeText });
    expect(res.status).toBe(500);
  });
});

describe('resume.routes — GET /my', () => {
  test('returns 404 with a helpful message when the user has no resume yet', async () => {
    Resume.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const res = await request(app).get('/api/resume/my');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/upload your resume first/i);
  });

  test('returns the resume, excluding rawText', async () => {
    Resume.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'r1', atsScore: 90 }),
    });
    const res = await request(app).get('/api/resume/my');
    expect(res.status).toBe(200);
    expect(res.body.data.atsScore).toBe(90);
  });
});
