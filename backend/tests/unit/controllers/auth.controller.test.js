'use strict';
jest.mock('../../../src/models/User');
jest.mock('../../../src/services/audit/auditLog.service', () => ({ record: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/services/notifications/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({}),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
}));

const jwt = require('jsonwebtoken');
const User = require('../../../src/models/User');
const audit = require('../../../src/services/audit/auditLog.service');
const {
  sendVerificationEmail, sendPasswordResetEmail,
} = require('../../../src/services/notifications/email.service');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockReq = (overrides = {}) => ({ body: {}, query: {}, headers: {}, ip: '127.0.0.1', ...overrides });

// express-validator's validationResult() reads metadata attached to req by
// the validation chains, which never ran in these controller-only tests
// (they're tested separately via supertest + real routes below is out of
// scope here) — so we stub validationResult to always report "valid" unless
// a test explicitly wants to simulate a validation failure.
jest.mock('express-validator', () => {
  const actual = jest.requireActual('express-validator');
  return { ...actual, validationResult: jest.fn(() => ({ isEmpty: () => true, array: () => [] })) };
});
const { validationResult } = require('express-validator');

const {
  register, login, verifyEmail, resendVerification, forgotPassword, resetPassword,
  refreshToken, logout, logoutAll, getSessions, revokeSession, getMe, updateProfile, changePassword, deleteAccount,
} = require('../../../src/controllers/auth.controller');

describe('auth.controller — register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects when GDPR consent is not given', async () => {
    const req = mockReq({ body: { name: 'Jane', email: 'jane@x.com', password: 'Passw0rd!', gdprConsent: false } });
    const res = mockRes();
    await register(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(User.create).not.toHaveBeenCalled();
  });

  test('rejects a duplicate email', async () => {
    User.findOne = jest.fn().mockResolvedValue({ _id: 'existing' });
    const req = mockReq({ body: { name: 'Jane', email: 'jane@x.com', password: 'Passw0rd!', gdprConsent: true } });
    const res = mockRes();
    await register(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('an invalid/unknown referral code does not block registration', async () => {
    User.findOne = jest.fn()
      .mockResolvedValueOnce(null) // no existing user with this email
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) }); // referral lookup finds nothing
    const fakeUser = { _id: 'u1', email: 'jane@x.com', name: 'Jane', createEmailVerifyToken: jest.fn().mockReturnValue('raw-token'), addSession: jest.fn(), save: jest.fn().mockResolvedValue({}) };
    User.create = jest.fn().mockResolvedValue(fakeUser);

    const req = mockReq({ body: { name: 'Jane', email: 'jane@x.com', password: 'Passw0rd!', gdprConsent: true, referralCode: 'BOGUS999' } });
    const res = mockRes();
    await register(req, res, jest.fn());

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ referredBy: null }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('happy path: creates user, signs both tokens, fires verification email without blocking the response', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const fakeUser = { _id: 'u1', email: 'jane@x.com', name: 'Jane', createEmailVerifyToken: jest.fn().mockReturnValue('raw-token'), addSession: jest.fn(), save: jest.fn().mockResolvedValue({}) };
    User.create = jest.fn().mockResolvedValue(fakeUser);

    const req = mockReq({ body: { name: 'Jane', email: 'jane@x.com', password: 'Passw0rd!', gdprConsent: true } });
    const res = mockRes();
    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0].data;
    expect(payload.accessToken).toBeDefined();
    expect(payload.refreshToken).toBeDefined();
    expect(sendVerificationEmail).toHaveBeenCalled();
    expect(fakeUser.addSession).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: payload.refreshToken }));
    expect(fakeUser.save).toHaveBeenCalledTimes(2); // once for verify token, once for the new session
  });
});

describe('auth.controller — login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a generic "invalid email or password" for a non-existent user (no enumeration)', async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const req = mockReq({ body: { email: 'nobody@x.com', password: 'x' } });
    const res = mockRes();
    await login(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].message).toBe('Invalid email or password');
  });

  test('rejects a locked account with a 429', async () => {
    const fakeUser = { isLocked: () => true };
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ body: { email: 'jane@x.com', password: 'x' } });
    const res = mockRes();
    await login(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'account_locked' }));
  });

  test('increments login attempts on a wrong password (same generic message as unknown user)', async () => {
    const incrementLoginAttempts = jest.fn().mockResolvedValue({});
    const fakeUser = { isLocked: () => false, comparePassword: jest.fn().mockResolvedValue(false), incrementLoginAttempts };
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ body: { email: 'jane@x.com', password: 'wrong' } });
    const res = mockRes();
    await login(req, res, jest.fn());
    expect(incrementLoginAttempts).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].message).toBe('Invalid email or password');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_failed', metadata: { reason: 'wrong_password' } }));
  });

  test('regression: an unknown email is ALSO audit-logged as login_failed (brute-force visibility), even though the response is identical to a wrong password', async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const req = mockReq({ body: { email: 'ghost@x.com', password: 'x' } });
    const res = mockRes();
    await login(req, res, jest.fn());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'login_failed', metadata: { email: 'ghost@x.com', reason: 'no_such_account' },
    }));
  });

  test('happy path: resets loginAttempts and returns fresh tokens', async () => {
    const fakeUser = {
      _id: 'u1', loginAttempts: 3, isLocked: () => false,
      comparePassword: jest.fn().mockResolvedValue(true),
      updateOne: jest.fn().mockResolvedValue({}),
      addSession: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ body: { email: 'jane@x.com', password: 'correct' } });
    const res = mockRes();
    await login(req, res, jest.fn());

    expect(fakeUser.updateOne).toHaveBeenCalledWith({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.accessToken).toBeDefined();
    expect(fakeUser.addSession).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: expect.any(String) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_success', userId: 'u1' }));
  });
});

describe('auth.controller — verifyEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('requires a token', async () => {
    const req = mockReq({ query: {} });
    const res = mockRes();
    await verifyEmail(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects an invalid/expired token', async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const req = mockReq({ query: { token: 'bad-token' } });
    const res = mockRes();
    await verifyEmail(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('marks the user verified and clears the token fields on success', async () => {
    const fakeUser = { emailVerified: false, save: jest.fn().mockResolvedValue({}), email: 'jane@x.com' };
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ query: { token: 'good-token' } });
    const res = mockRes();
    await verifyEmail(req, res, jest.fn());
    expect(fakeUser.emailVerified).toBe(true);
    expect(fakeUser.emailVerifyToken).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('auth.controller — resendVerification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 200 without sending an email if already verified (no-op, not an error)', async () => {
    const fakeUser = { _id: 'u1', emailVerified: true };
    User.findById = jest.fn().mockResolvedValue(fakeUser);
    const req = mockReq({ user: { _id: 'u1' } });
    const res = mockRes();
    await resendVerification(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].message).toBe('Email is already verified');
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('generates a fresh token and sends a new verification email when unverified', async () => {
    const fakeUser = {
      _id: 'u1', emailVerified: false, email: 'jane@x.com', name: 'Jane',
      createEmailVerifyToken: jest.fn().mockReturnValue('fresh-raw-token'),
      save: jest.fn().mockResolvedValue({}),
    };
    User.findById = jest.fn().mockResolvedValue(fakeUser);
    const req = mockReq({ user: { _id: 'u1' } });
    const res = mockRes();
    await resendVerification(req, res, jest.fn());

    expect(fakeUser.createEmailVerifyToken).toHaveBeenCalled();
    expect(fakeUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    expect(sendVerificationEmail).toHaveBeenCalledWith('jane@x.com', 'Jane', expect.stringContaining('fresh-raw-token'));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('auth.controller — forgotPassword (email enumeration protection)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('regression: returns the SAME 200 response whether or not the email exists', async () => {
    User.findOne = jest.fn().mockResolvedValue(null); // no such user
    const req = mockReq({ body: { email: 'ghost@x.com' } });
    const res = mockRes();
    await forgotPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    // Capture the message BEFORE clearing mocks (clearAllMocks resets mock.calls arrays)
    const firstMessage = res.json.mock.calls[0][0].message;

    jest.clearAllMocks();
    const fakeUser = { email: 'real@x.com', name: 'Jane', createPasswordResetToken: jest.fn().mockReturnValue('rt'), save: jest.fn().mockResolvedValue({}) };
    User.findOne = jest.fn().mockResolvedValue(fakeUser);
    const req2 = mockReq({ body: { email: 'real@x.com' } });
    const res2 = mockRes();
    await forgotPassword(req2, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(200);
    expect(sendPasswordResetEmail).toHaveBeenCalled();
    // Both paths return literally the same success message — confirms no enumeration signal
    expect(firstMessage).toBe(res2.json.mock.calls[0][0].message);
  });
});

describe('auth.controller — resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a weak new password before touching the database', async () => {
    const req = mockReq({ body: { token: 't', password: 'weak' } });
    const res = mockRes();
    await resetPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('rejects an invalid/expired reset token', async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const req = mockReq({ body: { token: 'bad', password: 'Passw0rd!' } });
    const res = mockRes();
    await resetPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('on success, clears ALL sessions — forces re-login on every device', async () => {
    const fakeUser = {
      save: jest.fn().mockResolvedValue({}), email: 'jane@x.com',
      sessions: [{ refreshToken: 'device-1-rt' }, { refreshToken: 'device-2-rt' }],
    };
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ body: { token: 'good', password: 'Passw0rd!' } });
    const res = mockRes();
    await resetPassword(req, res, jest.fn());
    expect(fakeUser.sessions).toEqual([]);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('auth.controller — refreshToken (rotation + revocation)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a malformed/invalid JWT', async () => {
    const req = mockReq({ body: { refreshToken: 'not-a-jwt' } });
    const res = mockRes();
    await refreshToken(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('rejects when the presented token matches no session on the user (revoked/reused)', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_REFRESH_SECRET);
    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'u1', sessions: [{ refreshToken: 'a-different-token' }] }),
    });
    const req = mockReq({ body: { refreshToken: token } });
    const res = mockRes();
    await refreshToken(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('rotates only the matching session\'s token on success, leaving other devices untouched', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_REFRESH_SECRET);
    const otherDeviceSession = { refreshToken: 'other-device-rt', lastUsedAt: new Date('2020-01-01') };
    const thisDeviceSession  = { refreshToken: token, lastUsedAt: new Date('2020-01-01') };
    const fakeUser = { _id: 'u1', sessions: [otherDeviceSession, thisDeviceSession], save: jest.fn().mockResolvedValue({}) };
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ body: { refreshToken: token } });
    const res = mockRes();
    await refreshToken(req, res, jest.fn());

    expect(thisDeviceSession.refreshToken).not.toBe(token); // rotated to a new value
    expect(otherDeviceSession.refreshToken).toBe('other-device-rt'); // untouched
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('auth.controller — logout / getMe / updateProfile / changePassword / deleteAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  test('logout with a refresh token pulls only that one session, leaving other devices logged in', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const req = mockReq({ user: { _id: 'u1' }, body: { refreshToken: 'this-device-rt' } });
    const res = mockRes();
    await logout(req, res, jest.fn());
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { $pull: { sessions: { refreshToken: 'this-device-rt' } } });
  });

  test('logout with no refresh token in the body falls back to clearing all sessions', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const req = mockReq({ user: { _id: 'u1' } });
    const res = mockRes();
    await logout(req, res, jest.fn());
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { $set: { sessions: [] } });
  });

  test('logoutAll clears every device\'s session', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const req = mockReq({ user: { _id: 'u1' } });
    const res = mockRes();
    await logoutAll(req, res, jest.fn());
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { $set: { sessions: [] } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'logout_all' }));
  });

  describe('getSessions / revokeSession (closes the flagged "user can never see their own sessions" gap)', () => {
    test('getSessions returns metadata only — never the raw refreshToken values', async () => {
      const fakeUser = {
        sessions: [
          { _id: 's1', refreshToken: 'secret-token-1', userAgent: 'Chrome/Mac', ip: '1.1.1.1', createdAt: new Date('2026-08-01'), lastUsedAt: new Date('2026-08-20') },
          { _id: 's2', refreshToken: 'secret-token-2', userAgent: 'Safari/iPhone', ip: '2.2.2.2', createdAt: new Date('2026-08-10'), lastUsedAt: new Date('2026-08-22') },
        ],
      };
      User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
      const req = mockReq({ user: { _id: 'u1' } });
      const res = mockRes();
      await getSessions(req, res, jest.fn());

      const sessions = res.json.mock.calls[0][0].data;
      expect(sessions.every(s => s.refreshToken === undefined)).toBe(true);
      expect(sessions[0].userAgent).toBe('Safari/iPhone'); // most-recently-used first
    });

    test('getSessions marks the caller\'s own current device via the optional refreshToken query hint', async () => {
      const fakeUser = {
        sessions: [
          { _id: 's1', refreshToken: 'this-device-token', userAgent: 'Chrome/Mac', createdAt: new Date(), lastUsedAt: new Date() },
          { _id: 's2', refreshToken: 'other-device-token', userAgent: 'Safari/iPhone', createdAt: new Date(), lastUsedAt: new Date() },
        ],
      };
      User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
      const req = mockReq({ user: { _id: 'u1' }, query: { refreshToken: 'this-device-token' } });
      const res = mockRes();
      await getSessions(req, res, jest.fn());

      const sessions = res.json.mock.calls[0][0].data;
      expect(sessions.find(s => s.id === 's1').current).toBe(true);
      expect(sessions.find(s => s.id === 's2').current).toBe(false);
    });

    test('getSessions never marks anything current when no refreshToken hint is provided', async () => {
      const fakeUser = { sessions: [{ _id: 's1', refreshToken: 'x', createdAt: new Date(), lastUsedAt: new Date() }] };
      User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
      const req = mockReq({ user: { _id: 'u1' } }); // no query.refreshToken
      const res = mockRes();
      await getSessions(req, res, jest.fn());
      expect(res.json.mock.calls[0][0].data[0].current).toBe(false);
    });

    test('revokeSession pulls only the specified session, scoped to the caller\'s own user id', async () => {
      User.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      const req = mockReq({ user: { _id: 'u1' }, params: { id: 's1' } });
      const res = mockRes();
      await revokeSession(req, res, jest.fn());
      expect(User.updateOne).toHaveBeenCalledWith({ _id: 'u1' }, { $pull: { sessions: { _id: 's1' } } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'logout', metadata: { sessionId: 's1', revokedByUser: true } }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('revokeSession returns 404 when the session id does not exist (or belongs to someone else)', async () => {
      User.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 0 });
      const req = mockReq({ user: { _id: 'u1' }, params: { id: 'nonexistent' } });
      const res = mockRes();
      await revokeSession(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  test('getMe returns req.user directly', () => {
    const req = mockReq({ user: { _id: 'u1', name: 'Jane' } });
    const res = mockRes();
    getMe(req, res);
    expect(res.json.mock.calls[0][0].data).toEqual({ _id: 'u1', name: 'Jane' });
  });

  test('updateProfile rejects an empty name', async () => {
    const req = mockReq({ user: { _id: 'u1' }, body: { name: '   ' } });
    const res = mockRes();
    await updateProfile(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
  });

  test('updateProfile only writes allow-listed fields (ignores unexpected keys like "role" or "plan")', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const req = mockReq({ user: { _id: 'u1' }, body: { name: 'New Name', role: 'admin', plan: 'elite' } });
    const res = mockRes();
    await updateProfile(req, res, jest.fn());
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { $set: { name: 'New Name' } }, { new: true, runValidators: true });
  });

  test('changePassword rejects an incorrect current password', async () => {
    const fakeUser = { comparePassword: jest.fn().mockResolvedValue(false) };
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ user: { _id: 'u1' }, body: { currentPassword: 'wrong', newPassword: 'Passw0rd!' } });
    const res = mockRes();
    await changePassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('changePassword rejects a weak new password before checking the DB', async () => {
    const req = mockReq({ user: { _id: 'u1' }, body: { currentPassword: 'x', newPassword: 'weak' } });
    const res = mockRes();
    await changePassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('changePassword on success clears all sessions too — same "log out everywhere" guarantee as resetPassword, in case the change was prompted by a compromised device', async () => {
    const fakeUser = {
      comparePassword: jest.fn().mockResolvedValue(true),
      sessions: [{ refreshToken: 'device-1-rt' }, { refreshToken: 'device-2-rt' }],
      save: jest.fn().mockResolvedValue({}),
    };
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ user: { _id: 'u1' }, body: { currentPassword: 'correct', newPassword: 'Passw0rd!' } });
    const res = mockRes();
    await changePassword(req, res, jest.fn());
    expect(fakeUser.sessions).toEqual([]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('deleteAccount requires the correct password and sets deletionRequestedAt (soft delete, GDPR)', async () => {
    const fakeUser = { comparePassword: jest.fn().mockResolvedValue(true), save: jest.fn().mockResolvedValue({}), email: 'jane@x.com' };
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ user: { _id: 'u1' }, body: { password: 'correct' } });
    const res = mockRes();
    await deleteAccount(req, res, jest.fn());
    expect(fakeUser.deletionRequestedAt).toBeInstanceOf(Date);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'account_deletion_requested' }));
  });

  test('deleteAccount rejects an incorrect password without touching deletionRequestedAt', async () => {
    const fakeUser = { comparePassword: jest.fn().mockResolvedValue(false) };
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ user: { _id: 'u1' }, body: { password: 'wrong' } });
    const res = mockRes();
    await deleteAccount(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(fakeUser.deletionRequestedAt).toBeUndefined();
  });
});
