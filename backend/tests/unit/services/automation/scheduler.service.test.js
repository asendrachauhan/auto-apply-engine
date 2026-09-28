'use strict';
jest.mock('node-cron');
jest.mock('../../../../src/models/User');
jest.mock('../../../../src/models/AutomationSession');
jest.mock('../../../../src/services/automation/automationEngine.service');
jest.mock('../../../../src/services/automation/dataPurge.service');

const cron = require('node-cron');
const User = require('../../../../src/models/User');
const AutomationSession = require('../../../../src/models/AutomationSession');
const { runForUser } = require('../../../../src/services/automation/automationEngine.service');
const { purgeExpiredAccounts } = require('../../../../src/services/automation/dataPurge.service');
const { startScheduler } = require('../../../../src/services/automation/scheduler.service');

describe('scheduler.service — startScheduler()', () => {
  // Captures BOTH registered jobs by their expression, rather than a single
  // variable the second cron.schedule() call would silently overwrite —
  // that exact bug bit the previous version of this test file when the
  // purge cron was added alongside the pre-existing automation cron.
  let registered;

  beforeEach(() => {
    jest.clearAllMocks();
    registered = {};
    cron.schedule.mockImplementation((expr, cb) => { registered[expr] = cb; });
    purgeExpiredAccounts.mockResolvedValue({ purged: 0, failed: 0 });
  });

  describe('automation cron', () => {
    test('registers using CRON_SCHEDULE env var, defaulting to every 1 hour', () => {
      delete process.env.CRON_SCHEDULE;
      startScheduler();
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
    });

    test('respects a custom CRON_SCHEDULE if set', () => {
      process.env.CRON_SCHEDULE = '*/15 * * * *';
      startScheduler();
      expect(cron.schedule).toHaveBeenCalledWith('*/15 * * * *', expect.any(Function));
      delete process.env.CRON_SCHEDULE;
    });

    test('runs automation for every active user when the cron fires', async () => {
      startScheduler();
      User.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: 'u1', email: 'a@a.com' }, { _id: 'u2', email: 'b@b.com' }]),
      });
      AutomationSession.create = jest.fn().mockResolvedValue({ _id: 'session1' });
      runForUser.mockResolvedValue(undefined);

      await registered['0 * * * *']();

      expect(User.find).toHaveBeenCalledWith({ automationActive: true });
      expect(runForUser).toHaveBeenCalledTimes(2);
      expect(runForUser).toHaveBeenNthCalledWith(1, 'u1', 'session1');
      expect(runForUser).toHaveBeenNthCalledWith(2, 'u2', 'session1');
    }, 15000);

    test('one user erroring does not stop the run for subsequent users', async () => {
      startScheduler();
      User.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: 'u1', email: 'fails@a.com' }, { _id: 'u2', email: 'ok@b.com' }]),
      });
      AutomationSession.create = jest.fn().mockResolvedValue({ _id: 'session1' });
      runForUser
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(undefined);

      await expect(registered['0 * * * *']()).resolves.not.toThrow();
      expect(runForUser).toHaveBeenCalledTimes(2);
    }, 15000);

    test('a failure in User.find does not throw out of the cron callback', async () => {
      startScheduler();
      User.find = jest.fn().mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('db down')) });

      await expect(registered['0 * * * *']()).resolves.not.toThrow();
    });
  });

  describe('GDPR purge cron (regression: was completely unwired before this session)', () => {
    test('registers using PURGE_CRON_SCHEDULE env var, defaulting to daily at 3am', () => {
      delete process.env.PURGE_CRON_SCHEDULE;
      startScheduler();
      expect(cron.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
    });

    test('respects a custom PURGE_CRON_SCHEDULE if set', () => {
      process.env.PURGE_CRON_SCHEDULE = '0 0 * * 0';
      startScheduler();
      expect(cron.schedule).toHaveBeenCalledWith('0 0 * * 0', expect.any(Function));
      delete process.env.PURGE_CRON_SCHEDULE;
    });

    test('calls purgeExpiredAccounts() when the cron fires', async () => {
      startScheduler();
      await registered['0 3 * * *']();
      expect(purgeExpiredAccounts).toHaveBeenCalledTimes(1);
    });

    test('a failure in purgeExpiredAccounts() does not throw out of the cron callback', async () => {
      startScheduler();
      purgeExpiredAccounts.mockRejectedValue(new Error('purge failed'));
      await expect(registered['0 3 * * *']()).resolves.not.toThrow();
    });
  });

  test('both crons are registered independently — one does not interfere with the other', () => {
    startScheduler();
    expect(cron.schedule).toHaveBeenCalledTimes(2);
    expect(Object.keys(registered)).toEqual(expect.arrayContaining(['0 * * * *', '0 3 * * *']));
  });
});
