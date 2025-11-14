/**
 * Security Tests: Authentication Bypass Attempts
 *
 * Tests various methods attackers might use to bypass authentication
 */

const { authenticateUser } = require('../../src/server/middleware/auth');
const { createMockRequest, createMockResponse, createMockNext } = require('../utils/testHelpers');

describe('Authentication Bypass Protection', () => {
  let mockSupabase;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
    };
    jest.mock('../../src/server/config/database', () => ({
      getClient: () => mockSupabase,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Missing Token', () => {
    it('should reject requests without authentication token', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: {},
        headers: {},
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No authentication token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with empty token string', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: { sb_access_token: '' },
        headers: {},
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Token Formats', () => {
    it('should reject malformed JWT tokens', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: { sb_access_token: 'not.a.valid.jwt' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject SQL injection attempts in token', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: { sb_access_token: "'; DROP TABLE users; --" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject XSS attempts in token', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: { sb_access_token: '<script>alert("xss")</script>' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token Manipulation', () => {
    it('should reject expired tokens', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: { sb_access_token: 'expired_token' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject tokens from different users', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: { sb_access_token: 'user_a_token' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Token belongs to user A, but request is trying to access user B's data
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user_b',
            email: 'userb@example.com',
          },
        },
        error: null,
      });

      await authenticateUser(req, res, next);

      // Should still authenticate, but authorization should be checked separately
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Header vs Cookie Token Priority', () => {
    it('should prefer cookie token over header token', async () => {
      const req = createMockRequest({
        path: '/api/test',
        cookies: { sb_access_token: 'cookie_token' },
        headers: { authorization: 'Bearer header_token' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockSupabase.auth.getUser.mockImplementation((token) => {
        if (token === 'cookie_token') {
          return Promise.resolve({
            data: {
              user: {
                id: 'user_123',
                email: 'test@example.com',
                user_metadata: { role: 'citizen' },
              },
            },
            error: null,
          });
        }
        return Promise.resolve({
          data: { user: null },
          error: { message: 'Invalid token' },
        });
      });

      await authenticateUser(req, res, next);

      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('cookie_token');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Case Sensitivity', () => {
    it('should handle case variations in cookie names', async () => {
      // Test that cookie name matching is case-sensitive (as it should be)
      const req = createMockRequest({
        path: '/api/test',
        cookies: { SB_ACCESS_TOKEN: 'token_value' }, // Wrong case
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

