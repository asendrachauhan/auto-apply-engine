'use strict';
jest.mock('../../../../src/models/AuditLog');
const AuditLog = require('../../../../src/models/AuditLog');
const { record, getHistory } = require('../../../../src/services/audit/auditLog.service');

describe('auditLog.service — record()', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates an entry with ip/userAgent pulled from the request', async () => {
    AuditLog.create = jest.fn().mockResolvedValue({});
    const req = { ip: '1.2.3.4', headers: { 'user-agent': 'TestAgent/1.0' } };
    await record({ action: 'login_success', userId: 'u1', req });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'login_success', userId: 'u1', actorId: 'u1', ip: '1.2.3.4', userAgent: 'TestAgent/1.0',
    }));
  });

  test('defaults actorId to userId when not explicitly provided (self-service actions)', async () => {
    AuditLog.create = jest.fn().mockResolvedValue({});
    await record({ action: 'password_changed', userId: 'u1' });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', actorId: 'u1' }));
  });

  test('uses a distinct actorId when provided (e.g. an admin acting on another user)', async () => {
    AuditLog.create = jest.fn().mockResolvedValue({});
    await record({ action: 'admin_user_updated', userId: 'target-user', actorId: 'admin-user' });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'target-user', actorId: 'admin-user' }));
  });

  test('never throws, even when the DB write fails — must not break the real action it accompanies', async () => {
    AuditLog.create = jest.fn().mockRejectedValue(new Error('DB unavailable'));
    await expect(record({ action: 'login_success', userId: 'u1' })).resolves.toBeUndefined();
  });

  test('works with no userId at all (e.g. a failed login for a non-existent email)', async () => {
    AuditLog.create = jest.fn().mockResolvedValue({});
    await record({ action: 'login_failed', metadata: { email: 'ghost@x.com', reason: 'no_such_account' } });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined, actorId: undefined }));
  });
});

describe('auditLog.service — getHistory()', () => {
  const mockChain = (result) => {
    const lean = jest.fn().mockResolvedValue(result);
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });
    AuditLog.find = jest.fn().mockReturnValue({ sort });
    return { sort, limit, lean };
  };

  test('returns the user\'s entries newest first, respecting the limit', async () => {
    const { sort, limit } = mockChain([{ action: 'login_success' }]);
    const result = await getHistory('u1', { limit: 10 });
    expect(AuditLog.find).toHaveBeenCalledWith({ userId: 'u1' });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toEqual([{ action: 'login_success' }]);
  });

  test('defaults to a limit of 50 when not specified', async () => {
    const { limit } = mockChain([]);
    await getHistory('u1');
    expect(limit).toHaveBeenCalledWith(50);
  });
});
