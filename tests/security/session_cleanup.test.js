/**
 * Security Tests: Session Cleanup & Data Removal
 *
 * Tests that session data, cookies, and tokens are properly
 * removed/invalidated upon logout or session expiration.
 */

const SupabaseMock = require("../utils/supabaseMock");
const {
  createMockRequest,
  createMockResponse,
  _createMockNext,
} = require("../utils/testHelpers");

describe("Session Cleanup & Data Removal", () => {
  let mockSupabase;
  let AuthController;

  beforeEach(() => {
    jest.resetModules();
    mockSupabase = new SupabaseMock();

    // Mock the database config
    jest.doMock("../../src/server/config/database", () => {
      return class DatabaseMock {
        static getClient() {
          return mockSupabase;
        }
        getClient() {
          return mockSupabase;
        }
      };
    });

    // Require AuthController AFTER mocking
    AuthController = require("../../src/server/controllers/AuthController");

    // We need to attach the mock query builder methods to spy on them
    // The SupabaseMock from utility might create new instances on each 'from' call
    // So we'll spy on the prototype or the method behavior if needed.
    // However, looking at SupabaseMock.js, 'from' return a new object with jest.fn() props.
    // To properly spy, we might need to intercept the 'from' call.
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Logout Cleanup", () => {
    it("should clear the access token cookie upon logout", async () => {
      const req = createMockRequest({
        user: { id: "user_123" },
        cookies: {
          sb_access_token: "valid_token",
        },
      });
      const res = createMockResponse();

      // Spy on clearCookie
      res.clearCookie = jest.fn();

      // We also need to spy on the database calls to ensure session is invalidated
      // Since SupabaseMock 'from' returns a new object, filtering calls is tricky without
      // slightly modifying the mock setup or just checking if 'from' was called for 'user_sessions'.

      const updateMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockReturnThis();

      // Override the 'from' method for this specific test to capture the chain
      jest.spyOn(mockSupabase, "from").mockImplementation((table) => {
        if (table === "user_sessions") {
          return {
            update: updateMock,
            eq: eqMock,
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockReturnThis(),
        };
      });

      // Execute Logout
      await AuthController.logout(req, res);

      // Verify Cookie Cleanup
      expect(res.clearCookie).toHaveBeenCalledWith("sb_access_token");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Logged out successfully",
        })
      );

      // Verify Database Session Invalidation
      expect(mockSupabase.from).toHaveBeenCalledWith("user_sessions");

      // Verify update was called with active: false (or is_active: false based on schema)
      // Checking AuthController.js (from previous views):
      // await supabase.from('user_sessions').update({ is_active: false, ended_at: ... })
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );

      // Verify it targeted the correct user
      expect(eqMock).toHaveBeenCalledWith("user_id", "user_123");
      expect(eqMock).toHaveBeenCalledWith("is_active", true); // Should target only active sessions to close
    });

    it("should handle logout even if user session is missing (stateless/already invalid)", async () => {
      const req = createMockRequest({
        // No user object attached (e.g. auth middleware failed or skipped)
        cookies: {
          sb_access_token: "expired_token",
        },
      });
      const res = createMockResponse();
      res.clearCookie = jest.fn();

      await AuthController.logout(req, res);

      // Should still clear cookie to be safe
      expect(res.clearCookie).toHaveBeenCalledWith("sb_access_token");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe("Sensitive Data Exposure", () => {
    it("should not leak tokens in logout response", async () => {
      const req = createMockRequest({ user: { id: "u1" } });
      const res = createMockResponse();

      await AuthController.logout(req, res);

      const jsonResponse = res.json.mock.calls[0][0];
      const responseString = JSON.stringify(jsonResponse);

      expect(responseString).not.toContain("token");
      expect(responseString).not.toContain("sb_access_token");
    });
  });
});
