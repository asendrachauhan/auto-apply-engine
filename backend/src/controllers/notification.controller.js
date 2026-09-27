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

// ── Web Push Notification Controller Endpoints ─────────────────────────
const webPushService = require('../services/notifications/webPush.service');

/** GET /api/notifications/push-key — get VAPID public key */
const getVapidPublicKey = async (req, res, next) => {
  try {
    const publicKey = webPushService.getPublicKey();
    return sendSuccess(res, HTTP.OK, 'VAPID public key retrieved', { publicKey });
  } catch (err) { next(err); }
};

/** POST /api/notifications/push-subscribe — register subscription */
const subscribePush = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return sendError(res, HTTP.BAD_REQUEST, 'Invalid subscription payload');
    }
    const userAgent = req.headers['user-agent'] || '';
    const record = await webPushService.saveSubscription(req.user._id, subscription, userAgent);
    return sendSuccess(res, HTTP.CREATED, 'Push subscription saved successfully', record);
  } catch (err) { next(err); }
};

/** POST /api/notifications/push-unsubscribe — deregister subscription */
const unsubscribePush = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return sendError(res, HTTP.BAD_REQUEST, 'Endpoint required');
    await webPushService.removeSubscription(req.user._id, endpoint);
    return sendSuccess(res, HTTP.OK, 'Push subscription removed');
  } catch (err) { next(err); }
};

/** POST /api/notifications/push-test — trigger test notification */
const testPush = async (req, res, next) => {
  try {
    const result = await webPushService.sendPushNotification(req.user._id, {
      title: 'AutoApply AI Notification Test',
      body: 'Web push is working properly! You will receive job match alerts even when this browser tab is closed.',
      url: '/alerts',
    });
    return sendSuccess(res, HTTP.OK, 'Test push dispatched', result);
  } catch (err) { next(err); }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  testPush,
};
