const express = require('express');
const router  = express.Router();
const {
  getNotifications, getUnreadCount,
  markRead, markAllRead, deleteNotification,
  getVapidPublicKey, subscribePush, unsubscribePush, testPush,
} = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/',                 authenticate, getNotifications);
router.get('/unread-count',     authenticate, getUnreadCount);
router.patch('/read-all',       authenticate, markAllRead);
router.patch('/:id/read',       authenticate, markRead);
router.delete('/:id',           authenticate, deleteNotification);

// Web Push
router.get('/push-key',          authenticate, getVapidPublicKey);
router.post('/push-subscribe',   authenticate, subscribePush);
router.post('/push-unsubscribe', authenticate, unsubscribePush);
router.post('/push-test',        authenticate, testPush);

module.exports = router;
