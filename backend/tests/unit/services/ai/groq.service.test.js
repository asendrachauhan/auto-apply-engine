'use strict';
jest.mock('axios');
const axios = require('axios');

// Force short retry delays in this test run so the suite stays fast —
// must be set before requiring the module under test.
process.env.GROQ_BASE_RETRY_DELAY_MS = '5';
process.env.GROQ_MAX_RETRIES = '3';
const groq = require('../../../../src/services/ai/groq.service');

const okResponse = (text) => ({ data: { choices: [{ message: { content: text } }] } });
const httpError = (status, headers = {}) => {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status, headers };
  return err;
};

describe('groq.service — chat() retry/backoff (regression: production 429 storm)', () => {
  test('returns content immediately on success, no retries', async () => {
    axios.post.mockResolvedValueOnce(okResponse('hello'));
    const result = await groq.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('hello');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('retries on 429 and eventually succeeds', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce(okResponse('recovered'));

    const result = await groq.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('recovered');
    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  test('honors retry-after header when present', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(okResponse('ok'));

    const result = await groq.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('ok');
  });

  test('retries on 5xx errors', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(okResponse('ok-after-5xx'));

    const result = await groq.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('ok-after-5xx');
  });

  test('does NOT retry on non-retryable 4xx errors (e.g. 400 bad request)', async () => {
    axios.post.mockRejectedValueOnce(httpError(400));
    await expect(groq.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('gives up after MAX_RETRIES and throws the last error', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(429));

    await expect(groq.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(/429/);
    // initial attempt + MAX_RETRIES(3) retries = 4 calls total
    expect(axios.post).toHaveBeenCalledTimes(4);
  });

  test('throws immediately if GROQ_API_KEY is not configured', async () => {
    const original = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    await expect(groq.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow('GROQ_API_KEY not configured');
    process.env.GROQ_API_KEY = original;
  });
});

describe('groq.service — parseJSON', () => {
  test('parses plain JSON', () => {
    expect(groq.parseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  test('strips markdown code fences before parsing', () => {
    expect(groq.parseJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test('throws a clear error on invalid JSON', () => {
    expect(() => groq.parseJSON('not json at all')).toThrow('AI returned invalid JSON');
  });
});
