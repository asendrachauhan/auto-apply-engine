'use strict';
jest.mock('../../../../src/models/User');
jest.mock('../../../../src/models/Resume');
jest.mock('../../../../src/models/JobApplication');
jest.mock('../../../../src/models/JobAlert');
jest.mock('../../../../src/models/JobWatch');
jest.mock('../../../../src/models/Notification');
jest.mock('../../../../src/models/AutomationSession');
jest.mock('../../../../src/models/ReferralReward');
jest.mock('../../../../src/models/AuditLog');
jest.mock('../../../../src/config/cloudinary');

const User = require('../../../../src/models/User');
const Resume = require('../../../../src/models/Resume');
const JobApplication = require('../../../../src/models/JobApplication');
const JobAlert = require('../../../../src/models/JobAlert');
const JobWatch = require('../../../../src/models/JobWatch');
const Notification = require('../../../../src/models/Notification');
const AutomationSession = require('../../../../src/models/AutomationSession');
const ReferralReward = require('../../../../src/models/ReferralReward');
const AuditLog = require('../../../../src/models/AuditLog');
const cloudinary = require('../../../../src/config/cloudinary');
const { purgeExpiredAccounts, purgeOneAccount } = require('../../../../src/services/automation/dataPurge.service');

const mockDeleteMany = () => jest.fn().mockResolvedValue({ deletedCount: 1 });

describe('dataPurge.service — purgeOneAccount (regression: GDPR erasure was never implemented)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Resume.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
    Resume.deleteMany = mockDeleteMany();
    JobApplication.deleteMany = mockDeleteMany();
    JobAlert.deleteMany = mockDeleteMany();
    JobWatch.deleteMany = mockDeleteMany();
    Notification.deleteMany = mockDeleteMany();
    AutomationSession.deleteMany = mockDeleteMany();
    ReferralReward.deleteMany = mockDeleteMany();
    AuditLog.updateMany = jest.fn().mockResolvedValue({});
    User.findByIdAndDelete = jest.fn().mockResolvedValue({});
    cloudinary.getClient = jest.fn().mockReturnValue(null);
  });

  test('deletes the actual data across every collection that references the user', async () => {
    await purgeOneAccount('u1');
    expect(Resume.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(JobApplication.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(JobAlert.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(JobWatch.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(Notification.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(AutomationSession.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(ReferralReward.deleteMany).toHaveBeenCalledWith({ $or: [{ referrerId: 'u1' }, { referredUserId: 'u1' }] });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u1');
  });

  test('anonymizes AuditLog entries rather than deleting them (GDPR Art. 17(3) security exception)', async () => {
    await purgeOneAccount('u1');
    expect(AuditLog.updateMany).toHaveBeenCalledWith({ userId: 'u1' }, { $set: { userId: null } });
  });

  test('regression (Session 41): also anonymizes actorId separately from userId', async () => {
    // Bug: this used to only touch userId. Since actorId === userId for
    // every self-service action (logins, logouts, password changes — the
    // schema's own comment confirms this), the real user ID was silently
    // surviving erasure on nearly every one of a typical user's own audit
    // records, despite the code's own comment claiming it anonymized "the
    // actor reference."
    await purgeOneAccount('u1');
    expect(AuditLog.updateMany).toHaveBeenCalledWith({ actorId: 'u1' }, { $set: { actorId: null } });
    expect(AuditLog.updateMany).toHaveBeenCalledTimes(2); // one call per field, not a single combined query
  });

  test('deletes the Cloudinary-hosted résumé file when one exists', async () => {
    Resume.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ cloudinaryId: 'resumes/abc123' }) }) });
    const destroy = jest.fn().mockResolvedValue({});
    cloudinary.getClient = jest.fn().mockReturnValue({ uploader: { destroy } });

    await purgeOneAccount('u1');
    expect(destroy).toHaveBeenCalledWith('resumes/abc123', { resource_type: 'raw' });
  });

  test('a Cloudinary failure does not block erasing the actual personal-data records', async () => {
    Resume.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ cloudinaryId: 'resumes/abc123' }) }) });
    cloudinary.getClient = jest.fn().mockReturnValue({ uploader: { destroy: jest.fn().mockRejectedValue(new Error('Cloudinary down')) } });

    await expect(purgeOneAccount('u1')).resolves.not.toThrow();
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u1');
  });

  test('skips Cloudinary entirely when the user never had a résumé', async () => {
    await purgeOneAccount('u1');
    expect(cloudinary.getClient).not.toHaveBeenCalled();
  });
});

describe('dataPurge.service — purgeExpiredAccounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Resume.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
    Resume.deleteMany = mockDeleteMany();
    JobApplication.deleteMany = mockDeleteMany();
    JobAlert.deleteMany = mockDeleteMany();
    JobWatch.deleteMany = mockDeleteMany();
    Notification.deleteMany = mockDeleteMany();
    AutomationSession.deleteMany = mockDeleteMany();
    ReferralReward.deleteMany = mockDeleteMany();
    AuditLog.updateMany = jest.fn().mockResolvedValue({});
    User.findByIdAndDelete = jest.fn().mockResolvedValue({});
  });

  test('only purges accounts where deletionRequestedAt is at or past the grace period', async () => {
    User.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
    const result = await purgeExpiredAccounts();

    // Confirms the query filter itself is querying by the cutoff, not just
    // "has deletionRequestedAt set at all" (which would purge someone who
    // requested deletion 5 minutes ago, defeating the whole grace period).
    const filterArg = User.find.mock.calls[0][0];
    expect(filterArg).toHaveProperty('deletionRequestedAt.$lte');
    expect(result).toEqual({ purged: 0, failed: 0 });
  });

  test('purges every account past the cutoff and reports the count', async () => {
    User.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: 'u1', email: 'a@x.com' }, { _id: 'u2', email: 'b@x.com' }]) }),
    });
    const result = await purgeExpiredAccounts();
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u1');
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('u2');
    expect(result).toEqual({ purged: 2, failed: 0 });
  });

  test('one account failing to purge does not stop the rest, and is reported as failed', async () => {
    User.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: 'u1', email: 'fails@x.com' }, { _id: 'u2', email: 'ok@x.com' }]) }),
    });
    User.findByIdAndDelete = jest.fn()
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({});

    const result = await purgeExpiredAccounts();
    expect(result).toEqual({ purged: 1, failed: 1 });
  });
});
