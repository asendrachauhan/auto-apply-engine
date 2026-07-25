const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { startWatcher, stopWatcher, addClient, removeClient } = require('../services/realtime/jobWatcher.service');
const { getRealtimeInterval } = require('../config/plans.config');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/** SSE endpoint — client connects here to receive real-time updates */
router.get('/stream', authenticate, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write('event: connected\ndata: {"message":"SSE connected"}\n\n');

  const userId = req.user._id.toString();
  addClient(userId, res);

  req.on('close', () => removeClient(userId, res));
});

/** POST /api/watch/start */
router.post('/start', authenticate, async (req, res, next) => {
  try {
    const plan = req.user.plan;
    if (!['pro','elite'].includes(plan)) {
      return sendError(res, 403, 'Real-time job watching requires Pro or Elite plan');
    }
    const interval = getRealtimeInterval(plan);
    await startWatcher(req.user._id.toString(), interval);
    return sendSuccess(res, 200, `Real-time watcher started (every ${interval}s)`);
  } catch (err) { next(err); }
});

/** POST /api/watch/stop */
router.post('/stop', authenticate, async (req, res, next) => {
  try {
    await stopWatcher(req.user._id.toString());
    return sendSuccess(res, 200, 'Watcher stopped');
  } catch (err) { next(err); }
});

module.exports = router;
