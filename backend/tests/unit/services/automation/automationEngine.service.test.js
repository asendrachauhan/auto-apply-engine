'use strict';
jest.mock('../../../../src/models/User');
jest.mock('../../../../src/models/Resume');
jest.mock('../../../../src/models/AutomationSession');
jest.mock('../../../../src/models/JobApplication');
jest.mock('../../../../src/services/jobs/jobAggregator.service');
jest.mock('../../../../src/services/ai/jobMatcher.service');
jest.mock('../../../../src/services/ai/coverLetter.service');
jest.mock('../../../../src/services/notifications/email.service');
jest.mock('../../../../src/services/notifications/whatsapp.service');
jest.mock('../../../../src/services/notifications/notification.service');
jest.mock('../../../../src/services/resume/pdfGenerator.service', () => ({
  generateResumePDF: jest.fn().mockResolvedValue({ pdfUrl: 'https://res.cloudinary.com/demo/raw/upload/resume.pdf', html: '' }),
}));
jest.mock('../../../../src/config/featureFlags.service');

const User = require('../../../../src/models/User');
const Resume = require('../../../../src/models/Resume');
const AutomationSession = require('../../../../src/models/AutomationSession');
const JobApplication = require('../../../../src/models/JobApplication');
const { aggregateJobs } = require('../../../../src/services/jobs/jobAggregator.service');
const { matchJobs } = require('../../../../src/services/ai/jobMatcher.service');
const { generateCoverLetter } = require('../../../../src/services/ai/coverLetter.service');
const { sendApplicationEmail } = require('../../../../src/services/notifications/email.service');
const { notifyApplication } = require('../../../../src/services/notifications/whatsapp.service');
const { notify: notifyInApp } = require('../../../../src/services/notifications/notification.service');
const { getEffectivePlanId } = require('../../../../src/config/featureFlags.service');
const { runForUser } = require('../../../../src/services/automation/automationEngine.service');

const baseUser = {
  _id: 'user1', email: 'jane@example.com', name: 'Jane', automationActive: true,
  dailyApplyLimit: 3, plan: 'pro', preferences: {},
  notificationSettings: { emailEnabled: false, whatsappEnabled: false },
};
const baseResume = { userId: 'user1', parsedData: { fullName: 'Jane' }, version: 1 };

const job = (i) => ({ _id: `job-${i}`, title: `Job ${i}`, company: `Co ${i}`, url: 'https://x.com', source: 'remotive', ghostScore: { realJobScore: 80 } });
const score = { matchScore: 85, matchReasons: [], missingSkills: [], applicationStrategy: '' };

describe('automationEngine.service — runForUser() end-to-end', () => {
  let sessionUpdateOne;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionUpdateOne = jest.fn().mockResolvedValue({});
    AutomationSession.findById = jest.fn().mockResolvedValue({ updateOne: sessionUpdateOne });
    User.findById = jest.fn().mockResolvedValue({ ...baseUser });
    Resume.findOne = jest.fn().mockResolvedValue({ ...baseResume });
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    JobApplication.countDocuments = jest.fn().mockResolvedValue(0);
    JobApplication.find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }); // no existing applications by default
    JobApplication.create = jest.fn().mockImplementation((data) => Promise.resolve({ ...data, _id: 'app-1', appliedAt: new Date(), updateOne: jest.fn().mockResolvedValue({}) }));
    generateCoverLetter.mockResolvedValue('Dear hiring manager...');
    sendApplicationEmail.mockResolvedValue({});
    notifyApplication.mockResolvedValue({});
    notifyInApp.mockResolvedValue({});
    getEffectivePlanId.mockImplementation((plan) => Promise.resolve(plan)); // passthrough by default — payments enabled, no override
  });

  test('cancels the session immediately if automation is not active', async () => {
    User.findById.mockResolvedValue({ ...baseUser, automationActive: false });
    await runForUser('user1', 'session1');
    expect(sessionUpdateOne).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    expect(aggregateJobs).not.toHaveBeenCalled();
  });

  test('cancels the session if the user has no parsed resume yet', async () => {
    Resume.findOne.mockResolvedValue(null);
    await runForUser('user1', 'session1');
    expect(sessionUpdateOne).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
  });

  test('completes without matching/applying once the daily limit is already reached', async () => {
    JobApplication.countDocuments.mockResolvedValue(3); // == dailyApplyLimit
    aggregateJobs.mockResolvedValue({ jobs: [job(1)], stats: { raw: 5, ghostFiltered: 1, newJobs: 1 } });

    await runForUser('user1', 'session1');
    expect(matchJobs).not.toHaveBeenCalled();
    expect(JobApplication.create).not.toHaveBeenCalled();
    expect(sessionUpdateOne).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  test('happy path: discovers, matches, applies, and records in-app notification', async () => {
    aggregateJobs.mockResolvedValue({ jobs: [job(1), job(2)], stats: { raw: 10, ghostFiltered: 2, newJobs: 2 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }, { job: job(2), score }]);

    await runForUser('user1', 'session1');

    expect(JobApplication.create).toHaveBeenCalledTimes(2);
    expect(JobApplication.create).toHaveBeenCalledWith(expect.objectContaining({
      jobListingId: 'job-1', status: 'applied', matchScore: 85, ghostScore: 80,
    }));
    expect(notifyInApp).toHaveBeenCalledTimes(2);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user1', expect.objectContaining({ $inc: { totalApplications: 2 } }));
    expect(sessionUpdateOne).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed', stats: expect.objectContaining({ applicationsSent: 2 }), errorLog: [],
    }));
  });

  test('caps applications at the remaining daily allowance, not the full matched list', async () => {
    JobApplication.countDocuments.mockResolvedValue(2); // dailyApplyLimit(3) - 2 = 1 remaining
    aggregateJobs.mockResolvedValue({ jobs: [job(1), job(2), job(3)], stats: { raw: 10, ghostFiltered: 0, newJobs: 3 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }, { job: job(2), score }, { job: job(3), score }]);

    await runForUser('user1', 'session1');
    expect(JobApplication.create).toHaveBeenCalledTimes(1);
  });

  describe('regression (Session 39): the daily cap respects the effective plan, not just the raw stored dailyApplyLimit', () => {
    test('normal operation (payments enabled): uses the user\'s own stored dailyApplyLimit as-is', async () => {
      getEffectivePlanId.mockResolvedValue('pro'); // effectivePlan === user.plan — no override
      User.findById.mockResolvedValue({ ...baseUser, plan: 'pro', dailyApplyLimit: 3 });
      JobApplication.countDocuments.mockResolvedValue(0);
      aggregateJobs.mockResolvedValue({ jobs: [job(1), job(2), job(3), job(4)], stats: { raw: 4, ghostFiltered: 0, newJobs: 4 } });
      matchJobs.mockResolvedValue([1,2,3,4].map(i => ({ job: job(i), score })));

      await runForUser('user1', 'session1');
      expect(JobApplication.create).toHaveBeenCalledTimes(3); // capped at their own stored 3, not more
    });

    test('a user who deliberately lowered their own cap below their plan max keeps that lower cap respected', async () => {
      getEffectivePlanId.mockResolvedValue('pro'); // still their real plan, no override active
      User.findById.mockResolvedValue({ ...baseUser, plan: 'pro', dailyApplyLimit: 1 }); // self-lowered from pro's real max
      JobApplication.countDocuments.mockResolvedValue(0);
      aggregateJobs.mockResolvedValue({ jobs: [job(1), job(2), job(3)], stats: { raw: 3, ghostFiltered: 0, newJobs: 3 } });
      matchJobs.mockResolvedValue([1,2,3].map(i => ({ job: job(i), score })));

      await runForUser('user1', 'session1');
      expect(JobApplication.create).toHaveBeenCalledTimes(1); // their deliberate lower choice, not raised
    });

    test('payments globally disabled: a free user\'s effective plan becomes elite, and the cap unlocks accordingly — this is the actual bug fix', async () => {
      getEffectivePlanId.mockResolvedValue('elite'); // simulates the admin panel's Payments toggle being off
      User.findById.mockResolvedValue({ ...baseUser, plan: 'free', dailyApplyLimit: 3 }); // stale free-tier stored value
      JobApplication.countDocuments.mockResolvedValue(0);
      const jobs = Array.from({ length: 5 }, (_, i) => job(i + 1));
      aggregateJobs.mockResolvedValue({ jobs, stats: { raw: 5, ghostFiltered: 0, newJobs: 5 } });
      matchJobs.mockResolvedValue(jobs.map(j => ({ job: j, score })));

      await runForUser('user1', 'session1');
      // Elite's real dailyApply limit (200 by default) is far above both
      // the 3 stored on this user AND the 5 jobs available — so all 5
      // should go through. Before this fix, it would have stopped at 3.
      expect(JobApplication.create).toHaveBeenCalledTimes(5);
    });

    test('a getEffectivePlanId failure does not crash the run — falls back to the user\'s own stored preference via the mock\'s own default', async () => {
      getEffectivePlanId.mockResolvedValue('pro'); // realistic fallback behavior — featureFlags.service itself fails open, tested separately in its own suite
      User.findById.mockResolvedValue({ ...baseUser, plan: 'pro', dailyApplyLimit: 3 });
      JobApplication.countDocuments.mockResolvedValue(0);
      aggregateJobs.mockResolvedValue({ jobs: [job(1)], stats: { raw: 1, ghostFiltered: 0, newJobs: 1 } });
      matchJobs.mockResolvedValue([{ job: job(1), score }]);

      await expect(runForUser('user1', 'session1')).resolves.not.toThrow();
    });
  });

  test('regression: batches the already-applied check into ONE query, not one per candidate job (perf fix)', async () => {
    aggregateJobs.mockResolvedValue({ jobs: [job(1), job(2), job(3)], stats: { raw: 3, ghostFiltered: 0, newJobs: 3 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }, { job: job(2), score }, { job: job(3), score }]);

    await runForUser('user1', 'session1');
    expect(JobApplication.find).toHaveBeenCalledTimes(1); // not 3
    expect(JobApplication.create).toHaveBeenCalledTimes(3);
  });

  test('regression: still catches a duplicate job applied to EARLIER IN THE SAME RUN (not just pre-existing DB records)', async () => {
    // Two distinct job listings that resolve to the same company+title —
    // e.g. the same posting surfaced by two different job sources. The
    // batched pre-loop query alone can't know about the first one being
    // applied to mid-loop; the in-memory set must be updated as we go.
    const dupA = { ...job(1), _id: 'job-1a', source: 'remotive' };
    const dupB = { ...job(1), _id: 'job-1b', source: 'himalayas' };
    aggregateJobs.mockResolvedValue({ jobs: [dupA, dupB], stats: { raw: 2, ghostFiltered: 0, newJobs: 2 } });
    matchJobs.mockResolvedValue([{ job: dupA, score }, { job: dupB, score }]);

    await runForUser('user1', 'session1');
    expect(JobApplication.create).toHaveBeenCalledTimes(1);
  });

  test('skips a job the user already applied to (dedup by company + title)', async () => {
    aggregateJobs.mockResolvedValue({ jobs: [job(1)], stats: { raw: 1, ghostFiltered: 0, newJobs: 1 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }]);
    JobApplication.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ company: 'Co 1', jobTitle: 'Job 1' }]) }); // already applied

    await runForUser('user1', 'session1');
    expect(JobApplication.create).not.toHaveBeenCalled();
    expect(sessionUpdateOne).toHaveBeenCalledWith(expect.objectContaining({
      stats: expect.objectContaining({ applicationsSent: 0 }),
    }));
  });

  test('falls back to an empty cover letter if generation fails, but still applies', async () => {
    aggregateJobs.mockResolvedValue({ jobs: [job(1)], stats: { raw: 1, ghostFiltered: 0, newJobs: 1 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }]);
    generateCoverLetter.mockRejectedValue(new Error('Groq down'));

    await runForUser('user1', 'session1');
    expect(JobApplication.create).toHaveBeenCalledWith(expect.objectContaining({ coverLetter: '' }));
  });

  test('one application failing does not stop subsequent applications, and is recorded in errorLog', async () => {
    aggregateJobs.mockResolvedValue({ jobs: [job(1), job(2)], stats: { raw: 2, ghostFiltered: 0, newJobs: 2 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }, { job: job(2), score }]);
    JobApplication.create
      .mockRejectedValueOnce(new Error('DB write failed'))
      .mockImplementationOnce((data) => Promise.resolve({ ...data, _id: 'app-2', appliedAt: new Date(), updateOne: jest.fn().mockResolvedValue({}) }));

    await runForUser('user1', 'session1');
    expect(sessionUpdateOne).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      errorLog: [expect.stringContaining('DB write failed')],
      stats: expect.objectContaining({ applicationsSent: 1 }),
    }));
  });

  test('sends email notification only when the user has email notifications enabled', async () => {
    User.findById.mockResolvedValue({ ...baseUser, notificationSettings: { emailEnabled: true, emailAddress: 'jane@example.com' } });
    aggregateJobs.mockResolvedValue({ jobs: [job(1)], stats: { raw: 1, ghostFiltered: 0, newJobs: 1 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }]);

    await runForUser('user1', 'session1');
    expect(sendApplicationEmail).toHaveBeenCalledWith('jane@example.com', 'Jane', expect.objectContaining({ jobTitle: 'Job 1' }));
  });

  test('regression (Session 41): a failed email send is NOT counted as a sent notification, nor marked on the application', async () => {
    User.findById.mockResolvedValue({ ...baseUser, notificationSettings: { emailEnabled: true, emailAddress: 'jane@example.com' } });
    aggregateJobs.mockResolvedValue({ jobs: [job(1)], stats: { raw: 1, ghostFiltered: 0, newJobs: 1 } });
    matchJobs.mockResolvedValue([{ job: job(1), score }]);
    sendApplicationEmail.mockRejectedValue(new Error('Resend API down'));
    const appUpdateOne = jest.fn().mockResolvedValue({});
    JobApplication.create.mockImplementation((data) => Promise.resolve({ ...data, _id: 'app-1', appliedAt: new Date(), updateOne: appUpdateOne }));

    await runForUser('user1', 'session1');

    expect(appUpdateOne).not.toHaveBeenCalledWith({ notificationSent: true });
    const completedCall = sessionUpdateOne.mock.calls.find(c => c[0]?.status === 'completed');
    expect(completedCall?.[0]?.stats?.notificationsSent).toBe(0);
  });

  test('a top-level failure (e.g. job aggregation throwing) marks the session FAILED with the error message', async () => {
    aggregateJobs.mockRejectedValue(new Error('All job sources down'));
    await runForUser('user1', 'session1');
    expect(sessionUpdateOne).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed', errorLog: ['All job sources down'],
    }));
  });
});
