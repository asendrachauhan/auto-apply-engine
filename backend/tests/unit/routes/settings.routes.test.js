'use strict';
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/JobApplication');
jest.mock('../../../src/services/audit/auditLog.service');
jest.mock('../../../src/middleware/auth.middleware', () => ({
  protect: (req, res, next) => {
    req.user = {
      _id: 'user1',
      preferences: { toObject: () => ({ remote: true, jobTitles: ['Engineer'] }) },
      notificationSettings: { toObject: () => ({ email: true }) },
      planLimits: { dailyApply: 10 },
    };
    next();
  },
}));

const express = require('express');
const request = require('supertest');
const User = require('../../../src/models/User');
const JobApplication = require('../../../src/models/JobApplication');
const audit = require('../../../src/services/audit/auditLog.service');
const settingsRoutes = require('../../../src/routes/settings.routes');

const app = express();
app.use(express.json());
app.use('/api/settings', settingsRoutes);

describe('settings.routes — PUT /preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  test('merges new preferences with existing ones rather than overwriting them entirely', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({ preferences: { remote: false, jobTitles: ['Engineer'], salary: 100000 } });
    await request(app).put('/api/settings/preferences').send({ preferences: { remote: false, salary: 100000 } });

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user1',
      { $set: { preferences: { remote: false, jobTitles: ['Engineer'], salary: 100000 } } },
      { new: true, runValidators: true }
    );
  });

  test('clamps dailyApplyLimit to the user\'s plan maximum (regression-style: prevents free users requesting unlimited applies)', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    await request(app).put('/api/settings/preferences').send({ dailyApplyLimit: 999 });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user1',
      { $set: { dailyApplyLimit: 10 } }, // clamped to planLimits.dailyApply = 10
      expect.anything()
    );
  });

  test('clamps dailyApplyLimit to a minimum of 1', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    await request(app).put('/api/settings/preferences').send({ dailyApplyLimit: -5 });
    // dailyApplyLimit of -5 is falsy-ish? No, -5 is truthy in JS (only 0/NaN/''/null/undefined are falsy)
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user1', { $set: { dailyApplyLimit: 1 } }, expect.anything());
  });

  test('coerces automationActive/onboardingComplete to booleans', async () => {
    User.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    await request(app).put('/api/settings/preferences').send({ automationActive: 'true', onboardingComplete: 0 });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user1',
      { $set: { automationActive: true, onboardingComplete: false } },
      expect.anything()
    );
  });
});

describe('settings.routes — GET /data-export (GDPR)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('exports only whitelisted user fields — never the password hash or tokens', async () => {
    User.findById = jest.fn().mockResolvedValue({
      name: 'Jane', email: 'jane@example.com', createdAt: new Date('2026-01-01'),
      plan: 'pro', preferences: { remote: true }, gdprConsent: { given: true },
      password: 'super-secret-hash', refreshToken: 'rt-abc', emailVerifyToken: 'evt-abc',
    });
    JobApplication.find = jest.fn().mockResolvedValue([
      { jobTitle: 'Engineer', company: 'Acme', status: 'applied', appliedAt: new Date(), matchScore: 88 },
    ]);

    const res = await request(app).get('/api/settings/data-export');
    expect(res.status).toBe(200);
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('refreshToken');
    expect(res.body.user).not.toHaveProperty('emailVerifyToken');
    expect(res.body.user.email).toBe('jane@example.com');
    expect(res.body.applications.length).toBe(1);
  });

  test('sets a Content-Disposition attachment header so the browser downloads it as a file', async () => {
    User.findById = jest.fn().mockResolvedValue({ name: 'Jane', email: 'jane@example.com', preferences: {} });
    JobApplication.find = jest.fn().mockResolvedValue([]);
    const res = await request(app).get('/api/settings/data-export');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});

describe('settings.routes — GET /security-log', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the current user\'s own audit history, newest first', async () => {
    const entries = [
      { action: 'login_success', createdAt: '2026-08-01T10:00:00.000Z', ip: '1.2.3.4' },
      { action: 'password_changed', createdAt: '2026-07-30T09:00:00.000Z', ip: '1.2.3.4' },
    ];
    audit.getHistory = jest.fn().mockResolvedValue(entries);

    const res = await request(app).get('/api/settings/security-log');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(entries);
    expect(audit.getHistory).toHaveBeenCalledWith('user1', { limit: 50 });
  });

  test('a failure fetching history is passed to next() rather than hanging or crashing the process', async () => {
    audit.getHistory = jest.fn().mockRejectedValue(new Error('DB unavailable'));
    const res = await request(app).get('/api/settings/security-log');
    expect(res.status).toBe(500);
  });
});
