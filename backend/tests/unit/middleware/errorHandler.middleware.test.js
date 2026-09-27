'use strict';
const { errorHandler } = require('../../../src/middleware/errorHandler.middleware');

describe('errorHandler.middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      originalUrl: '/api/test',
      user: { id: 'user-123' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('JWT/Authentication errors', () => {
    test('returns 401 for JsonWebTokenError (real authentication failure)', () => {
      const err = new Error('Invalid token');
      err.name = 'JsonWebTokenError';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid token',
        })
      );
    });

    test('returns 401 for TokenExpiredError (real authentication failure)', () => {
      const err = new Error('Token expired');
      err.name = 'TokenExpiredError';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Token expired',
        })
      );
    });
  });

  describe('CRITICAL FIX: Non-auth 401s (external API failures)', () => {
    test('converts non-auth 401 to 502 — prevents false user logout on Stripe auth failures', () => {
      const err = new Error('Stripe API returned 401: Invalid API key');
      err.statusCode = 401;
      // NOT a JsonWebTokenError, so it's not a real auth failure

      errorHandler(err, mockReq, mockRes, mockNext);

      // CRITICAL: Should be 502, not 401
      expect(mockRes.status).toHaveBeenCalledWith(502);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('service we depend on'),
        })
      );
    });

    test('converts non-auth 401 from external API to 502 — prevents false logout on LinkedIn auth failures', () => {
      const err = new Error('LinkedIn API returned 401: Unauthorized');
      err.statusCode = 401;

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(502);
    });

    test('still returns 401 for JWT errors even if statusCode is 401', () => {
      const err = new Error('Invalid token');
      err.name = 'JsonWebTokenError';
      err.statusCode = 401;

      errorHandler(err, mockReq, mockRes, mockNext);

      // JWT error should still be 401, not converted to 502
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Other error types', () => {
    test('returns 422 for ValidationError', () => {
      const err = new Error('Validation failed');
      err.name = 'ValidationError';
      err.errors = {
        email: { message: 'Email is required' },
        password: { message: 'Password must be 8+ chars' },
      };

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Email is required'),
        })
      );
    });

    test('returns 409 for duplicate key error', () => {
      const err = new Error('Duplicate key');
      err.code = 11000;
      err.keyValue = { email: 'test@example.com' };

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Email already exists',
        })
      );
    });

    test('returns 400 for file size limit error', () => {
      const err = new Error('File too large');
      err.code = 'LIMIT_FILE_SIZE';

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'File too large — maximum 5MB',
        })
      );
    });

    test('returns 500 for unknown errors', () => {
      const err = new Error('Something unexpected happened');

      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Message safety in production', () => {
    test('hides internal error details for 500 in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const err = new Error('Database connection failed: timeout');
        err.statusCode = 500;

        errorHandler(err, mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Something went wrong. Please try again.',
          })
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
