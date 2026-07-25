/**
 * Job Alert Controller.
 * CRUD for user's job alerts + manual trigger.
 */

const JobAlert    = require('../models/JobAlert');
const Resume      = require('../models/Resume');
const { runJobAlertPipeline } = require('../services/automation/jobAlertEngine.service');
const { generateResumePDF }   = require('../services/resume/pdfGenerator.service');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/** GET /api/alerts  — paginated list */
const getAlerts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const [alerts, total] = await Promise.all([
      JobAlert.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select('-tailoredResumeHtml -prefillCard -description') // exclude large fields from list
        .lean(),
      JobAlert.countDocuments(filter),
    ]);

    return sendPaginated(res, alerts, page, limit, total);
  } catch (err) { next(err); }
};

/** GET /api/alerts/stats */
const getAlertStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [total, pending, notified, applied, bySource] = await Promise.all([
      JobAlert.countDocuments({ userId }),
      JobAlert.countDocuments({ userId, status: 'pending' }),
      JobAlert.countDocuments({ userId, status: 'notified' }),
      JobAlert.countDocuments({ userId, status: 'applied' }),
      JobAlert.aggregate([
        { $match: { userId } },
        { $group: { _id: '$source', count: { $sum: 1 }, avgScore: { $avg: '$matchScore' } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const avgScore = await JobAlert.aggregate([
      { $match: { userId } },
      { $group: { _id: null, avg: { $avg: '$matchScore' } } },
    ]);

    return sendSuccess(res, 200, 'Alert stats', {
      total, pending, notified, applied,
      avgMatchScore: Math.round(avgScore[0]?.avg || 0),
      bySource,
    });
  } catch (err) { next(err); }
};

/** GET /api/alerts/:id  — full detail with prefill card */
const getAlert = async (req, res, next) => {
  try {
    const alert = await JobAlert.findOne({ _id: req.params.id, userId: req.user._id });
    if (!alert) return sendError(res, 404, 'Alert not found');

    // Mark as opened
    if (alert.status === 'notified') {
      alert.status      = 'opened';
      alert.linkOpenedAt= new Date();
      await alert.save();
    }

    return sendSuccess(res, 200, 'Alert detail', alert);
  } catch (err) { next(err); }
};

/** PATCH /api/alerts/:id/status */
const updateStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending','notified','opened','applied','ignored'];
    if (!validStatuses.includes(status)) return sendError(res, 400, 'Invalid status');

    const update = { status };
    if (notes)              update.userNotes = notes;
    if (status === 'applied') update.appliedAt = new Date();

    const alert = await JobAlert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      update,
      { new: true }
    );
    if (!alert) return sendError(res, 404, 'Alert not found');
    return sendSuccess(res, 200, 'Status updated', alert);
  } catch (err) { next(err); }
};

/** DELETE /api/alerts/:id */
const deleteAlert = async (req, res, next) => {
  try {
    await JobAlert.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    return sendSuccess(res, 200, 'Alert deleted');
  } catch (err) { next(err); }
};

/** POST /api/alerts/run  — manually trigger pipeline (rate limited) */
const runNow = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume?.parsedData && !resume?.optimizedData) {
      return sendError(res, 400, 'Upload your resume first');
    }

    logger.info(`Manual alert run: user ${req.user._id}`);

    // Fire-and-forget — return immediately
    runJobAlertPipeline(req.user._id.toString())
      .catch(err => logger.error(`Manual alert run failed: ${err.message}`));

    return sendSuccess(res, 202, 'Job discovery started. Check alerts in a few minutes.');
  } catch (err) { next(err); }
};

/** GET /api/alerts/:id/resume-pdf  — download tailored PDF */
const getResumePDF = async (req, res, next) => {
  try {
    const alert = await JobAlert.findOne({ _id: req.params.id, userId: req.user._id });
    if (!alert) return sendError(res, 404, 'Alert not found');

    if (alert.tailoredResumePdfUrl) {
      return sendSuccess(res, 200, 'PDF URL', { url: alert.tailoredResumePdfUrl });
    }

    // Regenerate if not available
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume) return sendError(res, 404, 'Resume not found');

    const { pdfUrl } = await generateResumePDF(
      { ...resume.optimizedData, ...alert.tailoredResume },
      { title: alert.title, company: alert.company },
      req.user._id
    );

    if (pdfUrl) {
      await JobAlert.findByIdAndUpdate(alert._id, { tailoredResumePdfUrl: pdfUrl });
    }

    return sendSuccess(res, 200, 'PDF generated', { url: pdfUrl });
  } catch (err) { next(err); }
};

/** GET /api/alerts/:id/prefill-text  — plain text application card */
const getPrefillText = async (req, res, next) => {
  try {
    const alert = await JobAlert.findOne(
      { _id: req.params.id, userId: req.user._id },
      'prefillCard prefillFields coverLetter title company jobUrl'
    );
    if (!alert) return sendError(res, 404, 'Alert not found');
    return sendSuccess(res, 200, 'Prefill data', {
      prefillCard:   alert.prefillCard,
      prefillFields: alert.prefillFields,
      coverLetter:   alert.coverLetter,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getAlerts, getAlertStats, getAlert,
  updateStatus, deleteAlert,
  runNow, getResumePDF, getPrefillText,
};
