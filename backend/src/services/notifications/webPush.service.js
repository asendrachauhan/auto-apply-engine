'use strict';

const webpush = require('web-push');
const PushSubscription = require('../../models/PushSubscription');
const logger = require('../../utils/logger');

let initialized = false;

const initVapid = () => {
  if (initialized) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@autoapply.ai';

  if (!publicKey || !privateKey) {
    logger.warn('[WebPush] VAPID keys not configured — web push disabled');
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    initialized = true;
    logger.info('[WebPush] VAPID initialized successfully');
    return true;
  } catch (err) {
    logger.error(`[WebPush] Failed to initialize VAPID: ${err.message}`);
    return false;
  }
};

/**
 * Get public key for frontend subscription.
 */
const getPublicKey = () => {
  initVapid();
  return process.env.VAPID_PUBLIC_KEY || null;
};

/**
 * Save or update a user's web push subscription.
 */
const saveSubscription = async (userId, subscription, userAgent = '') => {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid push subscription payload');
  }

  return await PushSubscription.findOneAndUpdate(
    { userId, endpoint: subscription.endpoint },
    {
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Remove a subscription when user opts out.
 */
const removeSubscription = async (userId, endpoint) => {
  return await PushSubscription.deleteMany({ userId, endpoint });
};

/**
 * Send web push notification to all active devices of a user.
 * Automatically purges expired/unregistered subscriptions (HTTP 404 / 410).
 *
 * @param {string} userId
 * @param {object} payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string} [payload.icon]
 * @param {string} [payload.url]
 * @param {object} [payload.data]
 */
const sendPushNotification = async (userId, payload) => {
  if (!initVapid()) return { sent: 0, failed: 0 };

  try {
    const subs = await PushSubscription.find({ userId });
    if (!subs.length) return { sent: 0, failed: 0 };

    const notificationPayload = JSON.stringify({
      title: payload.title || 'AutoApply AI',
      body: payload.body || 'You have a new update.',
      icon: payload.icon || '/assets/logos/08-favicon-32.svg',
      badge: '/assets/logos/08-favicon-32.svg',
      data: {
        url: payload.url || '/alerts',
        timestamp: Date.now(),
        ...(payload.data || {}),
      },
    });

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subs.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload);
          sent++;
        } catch (err) {
          failed++;
          // HTTP 404 Not Found or 410 Gone indicates the push subscription has expired or been revoked
          if (err.statusCode === 404 || err.statusCode === 410) {
            logger.info(`[WebPush] Removing expired subscription ${sub._id}`);
            await PushSubscription.findByIdAndDelete(sub._id).catch(() => {});
          } else {
            logger.warn(`[WebPush] Failed sending push to ${sub._id}: ${err.message}`);
          }
        }
      })
    );

    logger.info(`[WebPush] Dispatched push to user ${userId}: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  } catch (err) {
    logger.error(`[WebPush] Error during push notification dispatch: ${err.message}`);
    return { sent: 0, failed: 0 };
  }
};

module.exports = {
  getPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushNotification,
};
