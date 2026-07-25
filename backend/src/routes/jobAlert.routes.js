const express = require('express');
const router  = express.Router();
const {
  getAlerts, getAlertStats, getAlert,
  updateStatus, deleteAlert,
  runNow, getResumePDF, getPrefillText,
} = require('../controllers/jobAlert.controller');
const { authenticate }             = require('../middleware/auth.middleware');
const { automationTriggerLimiter } = require('../middleware/rateLimit.middleware');

router.get('/',                          authenticate, getAlerts);
router.get('/stats',                     authenticate, getAlertStats);
router.post('/run',                      authenticate, automationTriggerLimiter, runNow);
router.get('/:id',                       authenticate, getAlert);
router.patch('/:id/status',              authenticate, updateStatus);
router.delete('/:id',                    authenticate, deleteAlert);
router.get('/:id/resume-pdf',            authenticate, getResumePDF);
router.get('/:id/prefill',              authenticate, getPrefillText);

module.exports = router;
