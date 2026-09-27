'use strict';
jest.mock('../../../../src/models/Notification');
const Notification = require('../../../../src/models/Notification');
const { notify } = require('../../../../src/services/notifications/notification.service');

describe('notification.service — notify()', () => {
  test('creates a notification with all required fields', async () => {
    Notification.create = jest.fn().mockResolvedValue({ _id: 'n1' });
    const result = await notify({ userId: 'u1', type: 'billing', title: 'Upgraded', message: 'You are now Pro' });
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', type: 'billing', title: 'Upgraded', message: 'You are now Pro', channels: ['in-app'], link: '', metadata: {},
    }));
    expect(result).toEqual({ _id: 'n1' });
  });

  test('skips (returns null, no DB call) when a required field is missing', async () => {
    Notification.create = jest.fn();
    const result = await notify({ userId: 'u1', type: 'billing', title: '', message: 'x' });
    expect(Notification.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('never throws — swallows DB errors so the caller\'s real send is not broken', async () => {
    Notification.create = jest.fn().mockRejectedValue(new Error('DB write failed'));
    await expect(notify({ userId: 'u1', type: 'system', title: 'x', message: 'y' })).resolves.toBeNull();
  });

  test('passes through custom channels, link, and metadata when provided', async () => {
    Notification.create = jest.fn().mockResolvedValue({ _id: 'n2' });
    await notify({
      userId: 'u1', type: 'referral', title: 'Points earned', message: 'msg',
      channels: ['in-app', 'email'], link: '/referral', metadata: { points: 100 },
    });
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      channels: ['in-app', 'email'], link: '/referral', metadata: { points: 100 },
    }));
  });
});
