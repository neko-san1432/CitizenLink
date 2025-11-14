/**
 * Security Tests: CSRF Protection
 *
 * Tests CSRF token validation and bypass attempts
 */

const { csrfProtection, generateCsrfToken } = require('../../src/server/middleware/csrf');
const { createMockRequest, createMockResponse, createMockNext } = require('../utils/testHelpers');
const crypto = require('crypto');

describe('CSRF Protection', () => {
  let req, res, next;

  beforeEach(() => {
    req = createMockRequest({
      method: 'POST',
      path: '/api/test',
      cookies: {},
      body: {},
      headers: {},
    });
    res = createMockResponse();
    next = createMockNext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Safe Methods', () => {
    it('should allow GET requests without CSRF token', () => {
      req.method = 'GET';
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow HEAD requests without CSRF token', () => {
      req.method = 'HEAD';
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow OPTIONS requests without CSRF token', () => {
      req.method = 'OPTIONS';
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Unsafe Methods', () => {
    it('should require CSRF token for POST requests', () => {
      req.method = 'POST';
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should require CSRF token for PUT requests', () => {
      req.method = 'PUT';
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should require CSRF token for DELETE requests', () => {
      req.method = 'DELETE';
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should require CSRF token for PATCH requests', () => {
      req.method = 'PATCH';
      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token Validation', () => {
    it('should accept valid CSRF token in header', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const signedToken = signToken(token);

      req.method = 'POST';
      req.headers['x-csrf-token'] = signedToken;
      req.cookies['csrf-token'] = signedToken;

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept valid CSRF token in body', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const signedToken = signToken(token);

      req.method = 'POST';
      req.body._csrf = signedToken;
      req.cookies['csrf-token'] = signedToken;

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should accept valid CSRF token in cookie', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const signedToken = signToken(token);

      req.method = 'POST';
      req.cookies['csrf-token'] = signedToken;
      req.body._csrf = signedToken;

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid CSRF token signature', () => {
      req.method = 'POST';
      req.headers['x-csrf-token'] = 'invalid.token.signature';
      req.cookies['csrf-token'] = 'valid.token.signature';

      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid CSRF token',
      });
    });

    it('should reject tampered CSRF token', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const signedToken = signToken(token);
      const tamperedToken = `${signedToken.slice(0, -5)  }xxxxx`;

      req.method = 'POST';
      req.headers['x-csrf-token'] = tamperedToken;
      req.cookies['csrf-token'] = signedToken;

      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject CSRF token mismatch', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');
      const signedToken1 = signToken(token1);
      const signedToken2 = signToken(token2);

      req.method = 'POST';
      req.headers['x-csrf-token'] = signedToken1;
      req.cookies['csrf-token'] = signedToken2;

      csrfProtection(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token mismatch',
      });
    });
  });

  describe('Token Generation', () => {
    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();
        generateCsrfToken(req, res, next);
        const token = res.cookie.mock.calls[0]?.[1];
        if (token) tokens.add(token);
      }
      expect(tokens.size).toBeGreaterThan(90); // Most should be unique
    });

    it('should set CSRF token cookie with correct options', () => {
      generateCsrfToken(req, res, next);
      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: expect.any(Boolean),
          sameSite: 'strict',
          path: '/',
          maxAge: 30 * 60 * 1000,
        })
      );
    });

    it('should add CSRF token to response headers', () => {
      generateCsrfToken(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-CSRF-Token',
        expect.any(String)
      );
    });
  });

  describe('Token Replay Attacks', () => {
    it('should allow token reuse within validity period', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const signedToken = signToken(token);

      req.method = 'POST';
      req.headers['x-csrf-token'] = signedToken;
      req.cookies['csrf-token'] = signedToken;

      // First request
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();

      // Reset mocks
      next.mockClear();
      res.status.mockClear();

      // Second request with same token
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Token Extraction Priority', () => {
    it('should prefer header token over body token', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const signedToken = signToken(token);

      req.method = 'POST';
      req.headers['x-csrf-token'] = signedToken;
      req.body._csrf = 'different_token';
      req.cookies['csrf-token'] = signedToken;

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});

// Helper function to sign token (matches implementation)
function signToken(token) {
  const CSRF_SECRET = process.env.CSRF_SECRET || 'test-secret';
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

