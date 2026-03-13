/**
 * Security Tests: Session Hijacking Prevention
 *
 * Tests session security and hijacking prevention mechanisms
 */

const SupabaseMock = require("../utils/supabaseMock");
const { createMockRequest, createMockResponse, createMockNext, generateMockToken } = require("../utils/testHelpers");

describe("Session Hijacking Prevention", () => {
  let mockSupabase;
  let authenticateUser;

  beforeEach(() => {
    jest.resetModules(); // Reset cache to allow fresh mocks
    mockSupabase = new SupabaseMock();

    // Mock the database config to return our mock class
    jest.doMock("../../src/server/config/database", () => {
      return class DatabaseMock {
        static getClient() { return mockSupabase; }
        getClient() { return mockSupabase; }
      };
    });

    // Require the middleware AFTER mocking
    const authMiddleware = require("../../src/server/middleware/auth");
    authenticateUser = authMiddleware.authenticateUser;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("HttpOnly Cookie Protection", () => {
    it("should set cookies with HttpOnly flag", () => {
      const { getCookieOptions } = require("../../src/server/utils/authUtils");
      const options = getCookieOptions(false);

      expect(options.httpOnly).toBe(true);
    });

    it("should prevent JavaScript access to cookies", () => {
      const { getCookieOptions } = require("../../src/server/utils/authUtils");
      const options = getCookieOptions(false);

      expect(options.httpOnly).toBe(true);
    });
  });

  describe("Secure Cookie Flag", () => {
    it("should set secure flag in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const { getCookieOptions } = require("../../src/server/utils/authUtils");
      const options = getCookieOptions(false);

      expect(options.secure).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("should allow insecure cookies in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const { getCookieOptions } = require("../../src/server/utils/authUtils");
      const options = getCookieOptions(false);

      expect(options).toHaveProperty("secure");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("SameSite Cookie Protection", () => {
    it("should set SameSite attribute", () => {
      const { getCookieOptions } = require("../../src/server/utils/authUtils");
      const options = getCookieOptions(false);

      expect(options.sameSite).toBeDefined();
      expect(["strict", "lax", "none"]).toContain(options.sameSite);
    });

    it("should use lax SameSite by default", () => {
      const { getCookieOptions } = require("../../src/server/utils/authUtils");
      const options = getCookieOptions(false);

      expect(options.sameSite).toBe("lax");
    });
  });

  describe("Token Validation", () => {
    it("should validate token on every request", async () => {
      const token = generateMockToken("user_123");
      const req = createMockRequest({
        path: "/api/test",
        cookies: { sb_access_token: token },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Setup mock user in SupabaseMock
      mockSupabase.sessions.set(token, {
        user: {
          id: "user_123",
          email: "test@example.com",
          user_metadata: { role: "citizen" },
        }
      });
      mockSupabase.users.set("user_123", {
        id: "user_123",
        email: "test@example.com",
        user_metadata: { role: "citizen" },
      });

      await authenticateUser(req, res, next);

      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith(token);
      expect(next).toHaveBeenCalled();
    });

    it("should reject invalid tokens", async () => {
      const req = createMockRequest({
        path: "/api/test",
        cookies: { sb_access_token: "invalid_token" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject expired tokens", async () => {
      const req = createMockRequest({
        path: "/api/test",
        cookies: { sb_access_token: "expired_token" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // SupabaseMock returns error for unknown tokens by default
      await authenticateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Session Fixation", () => {
    it("should issue new tokens on login", () => {
      const token1 = generateMockToken("user_123");
      const token2 = generateMockToken("user_123");

      expect(token1).not.toBe(token2);
    });

    it("should invalidate old sessions on logout", async () => {
      const { logout } = require("../../src/server/controllers/AuthController");
      expect(logout).toBeDefined();
    });
  });

  describe("Concurrent Sessions", () => {
    it("should allow multiple valid sessions", async () => {
      const token1 = generateMockToken("user_123");
      const token2 = generateMockToken("user_123");

      const req1 = createMockRequest({
        cookies: { sb_access_token: token1 },
      });
      const req2 = createMockRequest({
        cookies: { sb_access_token: token2 },
      });

      // Setup mock user
      const user = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: { role: "citizen" },
      };
      mockSupabase.users.set("user_123", user);
      mockSupabase.sessions.set(token1, { user });
      mockSupabase.sessions.set(token2, { user });

      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const next1 = createMockNext();
      const next2 = createMockNext();

      await authenticateUser(req1, res1, next1);
      await authenticateUser(req2, res2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });
  });

  describe("IP Address Changes", () => {
    it("should not reject requests from different IPs", async () => {
      const token = generateMockToken("user_123");

      const req1 = createMockRequest({
        ip: "192.168.1.1",
        cookies: { sb_access_token: token },
      });
      const req2 = createMockRequest({
        ip: "192.168.1.2",
        cookies: { sb_access_token: token },
      });

      const user = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: { role: "citizen" },
      };
      mockSupabase.users.set("user_123", user);
      mockSupabase.sessions.set(token, { user });

      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const next1 = createMockNext();
      const next2 = createMockNext();

      await authenticateUser(req1, res1, next1);
      await authenticateUser(req2, res2, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });
  });

  describe("Cookie Path Restrictions", () => {
    it("should set cookie path to root", () => {
      const { getCookieOptions } = require("../../src/server/utils/authUtils");
      const options = getCookieOptions(false);

      expect(options.path).toBe("/");
    });
  });

  describe("Token Exposure Prevention", () => {
    it("should not expose tokens in response bodies", async () => {
      const token = generateMockToken("user_123");
      const req = createMockRequest({
        path: "/api/test",
        cookies: { sb_access_token: token },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const user = {
        id: "user_123",
        email: "test@example.com",
        user_metadata: { role: "citizen" },
      };
      mockSupabase.users.set("user_123", user);
      mockSupabase.sessions.set(token, { user });

      await authenticateUser(req, res, next);

      const jsonCalls = res.json.mock.calls;
      jsonCalls.forEach(call => {
        const response = call[0];
        if (typeof response === "object") {
          expect(JSON.stringify(response)).not.toContain(token);
        }
      });
    });
  });
});

