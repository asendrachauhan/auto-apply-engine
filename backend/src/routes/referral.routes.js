const express = require('express');
const router  = express.Router();
const { getMyReferral, getHistory } = require('../controllers/referral.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/me',      authenticate, getMyReferral);
router.get('/history', authenticate, getHistory);

module.exports = router;
