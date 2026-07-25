/**
 * Notification Controller.
 * Read/manage the current user's in-app notification history.
 */
'use strict';
const Notification = require('../models/Notification');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { HTTP } = require('../utils/constants');

/** GET /api/notifications — paginated list */
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, unreadOnly } = req.query;
    const filter = { userId: req.user._id };
    if (type) filter.type = type;
    if (unreadOnly === 'true') filter.read = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return sendPaginated(res, notifications, page, limit, total);
  } catch (err) { next(err); }
};

/** GET /api/notifications/unread-count — for the header bell badge */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    return sendSuccess(res, HTTP.OK, 'Unread count', { count });
  } catch (err) { next(err); }
};

/** PATCH /api/notifications/:id/read */
const markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return sendError(res, HTTP.NOT_FOUND, 'Notification not found');
    return sendSuccess(res, HTTP.OK, 'Marked as read', notification);
  } catch (err) { next(err); }
};

/** PATCH /api/notifications/read-all */
const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    return sendSuccess(res, HTTP.OK, 'All notifications marked as read');
  } catch (err) { next(err); }
};

/** DELETE /api/notifications/:id */
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!notification) return sendError(res, HTTP.NOT_FOUND, 'Notification not found');
    return sendSuccess(res, HTTP.OK, 'Notification deleted');
  } catch (err) { next(err); }
};

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification };
