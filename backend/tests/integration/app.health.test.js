'use strict';
const request = require('supertest');

// app.js only skips auto-boot (Mongo connect + listen) when NODE_ENV==='test',
// which tests/setup.js sets before this file's requires run.
const { app } = require('../../src/app');

describe('app.js — boot wiring & health check', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('unknown route returns a clean 404 JSON payload (never leaks a stack trace)', async () => {
    const res = await request(app).get('/api/definitely-not-a-real-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body).not.toHaveProperty('stack');
  });

  test('protected admin routes reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect([401, 403]).toContain(res.status);
  });

  test('security headers are present on every response (helmet)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
