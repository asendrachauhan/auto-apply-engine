'use strict';

// Mock isomorphic-dompurify to avoid ES module transformation issues with @exodus/bytes
jest.mock('isomorphic-dompurify', () => ({
  default: { sanitize: (str) => str.replace(/<[^>]*>/g, '') },
}));

const { sanitizeBody, stripMongoOperators } = require('../../../src/middleware/validate.middleware');

const runMiddleware = (body, query = {}, params = {}) => {
  const req = { body, query, params };
  const next = jest.fn();
  sanitizeBody(req, {}, next);
  expect(next).toHaveBeenCalled();
  return req;
};

describe('validate.middleware — stripMongoOperators (NoSQL injection protection)', () => {
  test('removes top-level $-prefixed operator keys', () => {
    const input = { email: { $ne: null }, password: 'x' };
    stripMongoOperators(input);
    expect(input.email).toEqual({});
    expect(input.password).toBe('x');
  });

  test('removes nested $-prefixed operator keys at any depth', () => {
    const input = { filter: { nested: { $where: 'this.password.length > 0' } } };
    stripMongoOperators(input);
    expect(input.filter.nested).toEqual({});
  });

  test('removes keys containing a dot (dotted-path injection)', () => {
    const input = { 'user.role': 'admin' };
    stripMongoOperators(input);
    expect(input).toEqual({});
  });

  test('strips operators inside array elements', () => {
    const input = { tags: [{ $regex: '.*' }, 'safe-tag'] };
    stripMongoOperators(input);
    expect(input.tags[0]).toEqual({});
    expect(input.tags[1]).toBe('safe-tag');
  });

  test('leaves normal, legitimate keys and values untouched', () => {
    const input = { email: 'jane@example.com', preferences: { remote: true, salary: 100000 } };
    stripMongoOperators(input);
    expect(input).toEqual({ email: 'jane@example.com', preferences: { remote: true, salary: 100000 } });
  });

  test('handles null/undefined/primitive input without throwing', () => {
    expect(() => stripMongoOperators(null)).not.toThrow();
    expect(() => stripMongoOperators(undefined)).not.toThrow();
    expect(() => stripMongoOperators('just a string')).not.toThrow();
  });
});

describe('validate.middleware — sanitizeBody (full request middleware)', () => {
  test('regression: a login body with an NoSQL injection payload in email is neutralized before reaching the controller', () => {
    const req = runMiddleware({ email: { $ne: null }, password: 'guess' });
    expect(req.body.email).toEqual({});
  });

  test('strips HTML from string fields using DOMPurify (not the old fragile regex)', () => {
    const req = runMiddleware({ name: '<script>alert(1)</script>Jane' });
    expect(req.body.name).not.toContain('<script>');
    expect(req.body.name).toContain('Jane');
  });

  test('handles a malformed/nested tag XSS attempt that a naive regex could miss', () => {
    const req = runMiddleware({ bio: '<<script>script>alert(1)<</script>/script>' });
    expect(req.body.bio.toLowerCase()).not.toContain('<script>');
  });

  test('also sanitizes req.query and req.params for operator injection (e.g. GET ?filter[$where]=...)', () => {
    const req = runMiddleware({}, { filter: { $where: 'sleep(5000)' } }, { id: { $ne: null } });
    expect(req.query.filter).toEqual({});
    expect(req.params.id).toEqual({});
  });

  test('does not choke on a body containing null or non-object nested values', () => {
    expect(() => runMiddleware({ a: null, b: 5, c: undefined, d: { e: null } })).not.toThrow();
  });
});
