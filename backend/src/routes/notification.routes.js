const express = require('express');
const router  = express.Router();
const {
  getNotifications, getUnreadCount,
  markRead, markAllRead, deleteNotification,
} = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/',                 authenticate, getNotifications);
router.get('/unread-count',     authenticate, getUnreadCount);
router.patch('/read-all',       authenticate, markAllRead);
router.patch('/:id/read',       authenticate, markRead);
router.delete('/:id',           authenticate, deleteNotification);

module.exports = router;
