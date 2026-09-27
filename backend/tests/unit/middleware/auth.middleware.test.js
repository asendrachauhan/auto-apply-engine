'use strict';
jest.mock('../../../src/models/User');
const jwt = require('jsonwebtoken');
const User = require('../../../src/models/User');
const {
  protect, requireVerifiedEmail, requirePlan, requireAdmin,
} = require('../../../src/middleware/auth.middleware');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth.middleware — protect()', () => {
  test('rejects requests with no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a header that is not "Bearer <token>"', async () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an invalid/malformed JWT', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-jwt' } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/invalid authentication token/i);
  });

  test('rejects an expired JWT with a distinct, user-friendly message', async () => {
    const expired = jwt.sign({ id: 'user1' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expired}` } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/session expired/i);
  });

  test('rejects a valid JWT whose user no longer exists', async () => {
    const token = jwt.sign({ id: 'ghost-user' }, process.env.JWT_SECRET);
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks accounts scheduled for deletion', async () => {
    const token = jwt.sign({ id: 'user1' }, process.env.JWT_SECRET);
    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'user1', deletionRequestedAt: new Date() }),
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches req.user and calls next() for a valid token + existing user', async () => {
    const token = jwt.sign({ id: 'user1' }, process.env.JWT_SECRET);
    const fakeUser = { _id: 'user1', email: 'a@b.com', plan: 'free', emailVerified: true };
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(fakeUser);
  });
});

describe('auth.middleware — requireVerifiedEmail()', () => {
  test('blocks unverified users', () => {
    const req = { user: { emailVerified: false } };
    const res = mockRes();
    const next = jest.fn();
    requireVerifiedEmail(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows verified users through', () => {
    const req = { user: { emailVerified: true } };
    const res = mockRes();
    const next = jest.fn();
    requireVerifiedEmail(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('auth.middleware — requirePlan()', () => {
  test('rejects users on a disallowed plan', () => {
    const req = { user: { plan: 'free' } };
    const res = mockRes();
    const next = jest.fn();
    requirePlan('pro', 'elite')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows users on an allowed plan', () => {
    const req = { user: { plan: 'pro' } };
    const res = mockRes();
    const next = jest.fn();
    requirePlan('pro', 'elite')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('auth.middleware — requireAdmin()', () => {
  test('rejects non-admin users', () => {
    const req = { user: { role: 'user' } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows admin users', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects when req.user is missing entirely (defensive)', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
