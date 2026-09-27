'use strict';
jest.mock('../../../../src/models/JobWatch');
jest.mock('../../../../src/models/User');
jest.mock('../../../../src/services/automation/jobAlertEngine.service', () => ({
  runJobAlertPipeline: jest.fn().mockResolvedValue({ discovered: 0, notified: 0 }),
}));

const JobWatch = require('../../../../src/models/JobWatch');
const User = require('../../../../src/models/User');
const { resumeAllWatchers, stopWatcher } = require('../../../../src/services/realtime/jobWatcher.service');

const proUser = (id) => ({ _id: { toString: () => id } });

describe('jobWatcher.service — resumeAllWatchers (regression: boot-time N+1 query)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    JobWatch.findOneAndUpdate = jest.fn().mockResolvedValue({});
  });

  afterEach(async () => {
    // startWatcher() sets a real (faked) interval per resumed user — stop
    // them all so nothing leaks between tests.
    await stopWatcher('u1'); await stopWatcher('u2'); await stopWatcher('u3');
    jest.useRealTimers();
  });

  test('does nothing and makes zero JobWatch queries when there are no Pro/Elite users', async () => {
    User.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
    JobWatch.find = jest.fn();
    await resumeAllWatchers();
    expect(JobWatch.find).not.toHaveBeenCalled();
  });

  test('makes exactly ONE batched JobWatch query regardless of how many Pro/Elite users exist', async () => {
    const users = [proUser('u1'), proUser('u2'), proUser('u3')];
    User.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(users) }) });
    JobWatch.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    await resumeAllWatchers();
    expect(JobWatch.find).toHaveBeenCalledTimes(1);
    expect(JobWatch.find).toHaveBeenCalledWith({ userId: { $in: [users[0]._id, users[1]._id, users[2]._id] }, active: true });
  });

  test('only resumes watchers for users that actually have an active JobWatch record', async () => {
    const users = [proUser('u1'), proUser('u2'), proUser('u3')];
    User.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(users) }) });
    JobWatch.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ userId: 'u1', checkInterval: 90, active: true }]), // only u1 has one
    });

    await resumeAllWatchers();
    // u1 should have had its watcher started (JobWatch.findOneAndUpdate called via startWatcher)
    expect(JobWatch.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' }, { active: true, checkInterval: 90 }, { upsert: true }
    );
    // Only one user resumed, not all three
    expect(JobWatch.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
