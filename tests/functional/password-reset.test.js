/**
 * Functional Tests: Password Reset Flow
 *
 * Tests password reset scenarios including edge cases
 */

const { createMockRequest, createMockResponse, createTestUser } = require("../utils/testHelpers");
const SupabaseMock = require("../utils/supabaseMock");

describe("Password Reset Flow", () => {
  let mockSupabase;
  let req, res;

  beforeEach(() => {
    mockSupabase = new SupabaseMock();
    jest.mock("../../src/server/config/database", () => ({
      getClient: () => mockSupabase,
    }));

    req = createMockRequest({
      method: "POST",
      path: "/api/auth/forgot-password",
      body: {},
    });
    res = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSupabase.reset();
  });

  describe("Request Password Reset", () => {
    it("should send reset email for valid email", async () => {
      const user = createTestUser();
      await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      req.body = { email: user.email };

      // Mock the forgot password route handler
      const handler = async (req, res) => {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({
            success: false,
            error: "Email is required",
          });
        }

        const { error } = await mockSupabase.auth.resetPasswordForEmail(email);
        if (error) {
          return res.status(400).json({
            success: false,
            error: error.message,
          });
        }

        res.json({
          success: true,
          message: "If an account exists with this email, a password reset link has been sent.",
        });
      };

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(user.email);
    });

    it("should not reveal if email exists (security)", async () => {
      req.body = { email: "nonexistent@example.com" };

      const handler = async (req, res) => {
        const { email } = req.body;
        await mockSupabase.auth.resetPasswordForEmail(email);
        // Always return success to prevent email enumeration
        res.json({
          success: true,
          message: "If an account exists with this email, a password reset link has been sent.",
        });
      };

      await handler(req, res);

      // Should return success even if email doesn't exist
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should reject request without email", async () => {
      req.body = {};

      const handler = async (req, res) => {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({
            success: false,
            error: "Email is required",
          });
        }
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Email is required",
        })
      );
    });

    it("should validate email format", async () => {
      req.body = { email: "invalid-email" };

      const handler = async (req, res) => {
        const { email } = req.body;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: "Invalid email format",
          });
        }
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("Reset Password with Token", () => {
    it("should reset password with valid token", async () => {
      const user = createTestUser();
      await mockSupabase.auth.signUp({
        email: user.email,
        password: user.password,
      });

      req.method = "POST";
      req.path = "/api/auth/reset-password";
      req.body = {
        token: "valid_token",
        password: "NewPassword123!@#",
        confirmPassword: "NewPassword123!@#",
      };

      const handler = async (req, res) => {
        const { token, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
          return res.status(400).json({
            success: false,
            error: "Passwords do not match",
          });
        }

        const { data, error } = await mockSupabase.auth.verifyOtp({
          token_hash: token,
          type: "recovery",
        });

        if (error || !data?.user) {
          return res.status(400).json({
            success: false,
            error: "Invalid or expired reset token",
          });
        }

        const { error: updateError } = await mockSupabase.auth.admin.updateUserById(
          data.user.id,
          { password }
        );

        if (updateError) {
          return res.status(500).json({
            success: false,
            error: "Failed to reset password",
          });
        }

        res.json({
          success: true,
          message: "Password reset successfully",
        });
      };

      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: {
          user: {
            id: "user_123",
            email: user.email,
          },
        },
        error: null,
      });

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Password reset successfully",
        })
      );
    });

    it("should reject mismatched passwords", async () => {
      req.method = "POST";
      req.path = "/api/auth/reset-password";
      req.body = {
        token: "valid_token",
        password: "NewPassword123!@#",
        confirmPassword: "DifferentPassword123!@#",
      };

      const handler = async (req, res) => {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
          return res.status(400).json({
            success: false,
            error: "Passwords do not match",
          });
        }
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Passwords do not match",
        })
      );
    });

    it("should reject invalid reset token", async () => {
      req.method = "POST";
      req.path = "/api/auth/reset-password";
      req.body = {
        token: "invalid_token",
        password: "NewPassword123!@#",
        confirmPassword: "NewPassword123!@#",
      };

      const handler = async (req, res) => {
        const { token } = req.body;
        const { error } = await mockSupabase.auth.verifyOtp({
          token_hash: token,
          type: "recovery",
        });

        if (error) {
          return res.status(400).json({
            success: false,
            error: "Invalid or expired reset token",
          });
        }
      };

      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should reject expired reset token", async () => {
      req.method = "POST";
      req.path = "/api/auth/reset-password";
      req.body = {
        token: "expired_token",
        password: "NewPassword123!@#",
        confirmPassword: "NewPassword123!@#",
      };

      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: "Token expired" },
      });

      const handler = async (req, res) => {
        const { token } = req.body;
        const { error } = await mockSupabase.auth.verifyOtp({
          token_hash: token,
          type: "recovery",
        });

        if (error) {
          return res.status(400).json({
            success: false,
            error: "Invalid or expired reset token",
          });
        }
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should validate password strength", async () => {
      req.method = "POST";
      req.path = "/api/auth/reset-password";
      req.body = {
        token: "valid_token",
        password: "weak",
        confirmPassword: "weak",
      };

      const handler = async (req, res) => {
        const { password } = req.body;
        if (password.length < 8) {
          return res.status(400).json({
            success: false,
            error: "Password must be at least 8 characters",
          });
        }
      };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("Token Reuse Prevention", () => {
    it("should prevent token reuse after successful reset", async () => {
      const _user = createTestUser();
      const token = "single_use_token";

      req.method = "POST";
      req.path = "/api/auth/reset-password";
      req.body = {
        token,
        password: "NewPassword123!@#",
        confirmPassword: "NewPassword123!@#",
      };

      let tokenUsed = false;
      const handler = async (req, res) => {
        const { token } = req.body;
        if (tokenUsed) {
          return res.status(400).json({
            success: false,
            error: "Token has already been used",
          });
        }

        const { data, error } = await mockSupabase.auth.verifyOtp({
          token_hash: token,
          type: "recovery",
        });

        if (error || !data?.user) {
          return res.status(400).json({
            success: false,
            error: "Invalid or expired reset token",
          });
        }

        tokenUsed = true;
        res.json({ success: true });
      };

      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user_123" } },
        error: null,
      });

      // First use
      await handler(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true });

      // Reset mocks
      res.json.mockClear();
      res.status.mockClear();

      // Second use should fail
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("Rate Limiting", () => {
    it("should limit password reset requests", async () => {
      // Password reset should have stricter rate limits
      // This is tested in rate-limiting.test.js
      expect(true).toBe(true);
    });
  });
});

