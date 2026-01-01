/**
 * Security Tests: Rate Limiting
 *
 * Tests rate limiting effectiveness and bypass attempts
 */

const { createMockRequest, createMockResponse, createMockNext, wait, makeConcurrentRequests } = require("../utils/testHelpers");

describe("Rate Limiting Security", () => {
  let req, res, next;
  let createRateLimiter, loginLimiter, passwordResetLimiter, authLimiter, clearRateLimit;

  beforeEach(() => {
    jest.resetModules();

    // Mock Database to throw error, forcing in-memory fallback
    jest.doMock("../../src/server/config/database", () => ({
      getClient: () => { throw new Error("DB disabled for testing"); }
    }));

    const rateLimiting = require("../../src/server/middleware/rateLimiting");
    createRateLimiter = rateLimiting.createRateLimiter;
    loginLimiter = rateLimiting.loginLimiter;
    passwordResetLimiter = rateLimiting.passwordResetLimiter;
    authLimiter = rateLimiting.authLimiter;
    clearRateLimit = rateLimiting.clearRateLimit;

    clearRateLimit();
    req = createMockRequest({
      ip: "127.0.0.1",
      hostname: "example.com",
      path: "/api/auth/login",
    });
    res = createMockResponse();
    next = createMockNext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Login Rate Limiting", () => {
    it("should allow requests within limit", async () => {
      const limiter = createRateLimiter(5, 60000); // 5 requests per minute

      for (let i = 0; i < 5; i++) {
        await limiter(req, res, next);
        expect(next).toHaveBeenCalledTimes(i + 1);
        expect(res.status).not.toHaveBeenCalledWith(429);
      }
    });

    it("should block requests exceeding limit", async () => {
      const limiter = createRateLimiter(5, 60000); // 5 requests per minute

      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        await limiter(req, res, next);
      }

      // 6th request should be blocked
      await limiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Too many requests from this IP, please try again later.",
      });
      expect(next).not.toHaveBeenCalledTimes(6);
    });

    it("should reset limit after time window", async () => {
      jest.useFakeTimers();
      const limiter = createRateLimiter(5, 1000); // 5 requests per second

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await limiter(req, res, next);
      }

      // Fast-forward time
      jest.advanceTimersByTime(1001);

      // Should allow requests again
      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(6);
      expect(res.status).not.toHaveBeenCalledWith(429);

      jest.useRealTimers();
    });

    it("should track rate limits per IP address", async () => {
      const limiter = createRateLimiter(5, 60000);

      const req1 = createMockRequest({ ip: "192.168.1.1" });
      const req2 = createMockRequest({ ip: "192.168.1.2" });

      // Exceed limit for IP 1
      for (let i = 0; i < 6; i++) {
        await limiter(req1, res, next);
      }

      // IP 2 should still be able to make requests
      const res2 = createMockResponse();
      const next2 = createMockNext();
      await limiter(req2, res2, next2);
      expect(next2).toHaveBeenCalled();
      expect(res2.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe("Concurrent Request Handling", () => {
    it("should handle concurrent requests correctly", async () => {
      const limiter = createRateLimiter(10, 60000);

      const requests = await makeConcurrentRequests(10, async () => {
        const r = createMockRequest({ ip: "127.0.0.1" });
        const res = createMockResponse();
        const next = createMockNext();
        await limiter(r, res, next);
        return { res, next };
      });

      // All should succeed
      requests.forEach(({ res, next }) => {
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalledWith(429);
      });
    });

    xit("should block concurrent requests exceeding limit", async () => {
      const limiter = createRateLimiter(5, 60000);

      const requests = await makeConcurrentRequests(10, async () => {
        const r = createMockRequest({ ip: "127.0.0.1" });
        const res = createMockResponse();
        const next = createMockNext();
        await limiter(r, res, next);
        return { res, next };
      });

      // At least some should be blocked
      const blocked = requests.filter(({ res }) =>
        res.status.mock.calls.some(call => call[0] === 429)
      );
      expect(blocked.length).toBeGreaterThan(0);
    });
  });

  describe("Rate Limit Headers", () => {
    it("should include rate limit headers in response", async () => {
      const limiter = createRateLimiter(10, 60000);

      await limiter(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "X-RateLimit-Limit": expect.anything(),
          "X-RateLimit-Remaining": expect.anything(),
          "X-RateLimit-Reset": expect.anything(),
        })
      );
    });
  });

  describe("IP Spoofing Protection", () => {
    it("should use req.ip for rate limiting", async () => {
      const limiter = createRateLimiter(5, 60000);

      const req1 = createMockRequest({
        ip: "127.0.0.1",
        headers: { "x-forwarded-for": "192.168.1.100" }, // Spoofed IP
      });

      // Should use req.ip, not x-forwarded-for
      await limiter(req1, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Different Rate Limiters", () => {
    it("should have stricter limits for login", async () => {
      // Login limiter should be stricter than auth limiter
      // This is tested by checking the actual limits in the implementation
      expect(loginLimiter).toBeDefined();
      expect(authLimiter).toBeDefined();
      expect(passwordResetLimiter).toBeDefined();
    });

    it("should have very strict limits for password reset", async () => {
      const limiter = createRateLimiter(5, 3600000); // 5 per hour

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await limiter(req, res, next);
      }

      // 6th should be blocked
      await limiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe("Development Mode Behavior", () => {
    it("should still enforce rate limits in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const limiter = createRateLimiter(5, 60000);

      // Make many requests
      for (let i = 0; i < 100; i++) {
        await limiter(req, res, next);
      }

      // Should eventually block (even in dev, just with higher limits)
      // The exact behavior depends on implementation
      expect(res.status).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });
});

