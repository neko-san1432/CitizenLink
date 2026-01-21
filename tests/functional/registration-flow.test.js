const { createMockRequest, createMockResponse } = require("../utils/testHelpers");
// AuthController required inside beforeEach for mocking support

// Mocks
const mockHRService = {
  validateSignupCode: jest.fn(),
  markSignupCodeUsed: jest.fn()
};

const mockUserService = {
  createUser: jest.fn(),
  updateUser: jest.fn()
};

// Mocks setup moved to beforeEach
let mockSupabase;
let AuthController;

describe("Registration Flow (Signup with Code)", () => {
  let req, res;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        admin: {
          getUserById: jest.fn(),
          updateUserById: jest.fn(),
          getUserByEmail: jest.fn()
        }
      }
    };

    // Mock Database
    jest.doMock("../../src/server/config/database", () => ({
      getClient: () => mockSupabase
    }));

    // Setup Service mocks again because resetModules clears them
    jest.doMock("../../src/server/services/HRService", () => {
      return jest.fn().mockImplementation(() => mockHRService);
    });

    jest.doMock("../../src/server/services/UserService", () => mockUserService);

    jest.doMock("../../src/shared/passwordValidation", () => ({
      validatePasswordStrength: jest.fn().mockReturnValue({ isValid: true })
    }));

    jest.doMock("../../src/server/utils/roleValidation", () => ({
      normalizeRole: jest.fn(r => r || "citizen"),
      validateUserRole: jest.fn().mockReturnValue({ isValid: true })
    }));

    // Re-import Controller after mocks
    AuthController = require("../../src/server/controllers/AuthController");

    req = createMockRequest({
      method: "POST",
      body: {
        email: "test@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
        name: "Test User",
        signupCode: "VALID_CODE",
        agreedToTerms: true
      }
    });

    res = createMockResponse();

    // Default successful mocks
    mockHRService.validateSignupCode.mockResolvedValue({
      valid: true,
      data: { role: "admin", department_code: "IT" }
    });

    mockUserService.createUser.mockResolvedValue({
      id: "user-123",
      email: "test@example.com"
    });

    mockUserService.updateUser.mockResolvedValue({
      id: "user-123",
      status: "pending_approval"
    });
  });

  it("should register successfully with valid code", async () => {
    await AuthController.signupWithCode(req, res);

    expect(mockHRService.validateSignupCode).toHaveBeenCalledWith("VALID_CODE");
    expect(mockUserService.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "test@example.com",
      role: "citizen" // It creates as citizen first
    }));
    // Check if metadata update was attempted (pending_approval)
    expect(mockUserService.updateUser).toHaveBeenCalledWith("user-123", expect.objectContaining({
      status: "pending_approval",
      pending_role: "admin"
    }), "user-123");

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));
  });

  it("should fail with invalid code", async () => {
    mockHRService.validateSignupCode.mockResolvedValue({
      valid: false,
      error: "Invalid code"
    });

    await AuthController.signupWithCode(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: "Invalid code"
    }));
  });

  it("should fail if passwords do not match", async () => {
    req.body.confirmPassword = "MismatchPassword";

    await AuthController.signupWithCode(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "Passwords do not match"
    }));
  });

  it("should fail if terms not agreed", async () => {
    req.body.agreedToTerms = false;

    await AuthController.signupWithCode(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "You must agree to the terms and conditions"
    }));
  });


  describe("OAuth Completion Flow", () => {
    beforeEach(() => {
      req.user = { id: "oauth-user-123", email: "oauth@example.com" };
      req.body = {
        email: "oauth@example.com",
        name: "OAuth User",
        mobileNumber: "09123456789",
        agreedToTerms: true,
        isOAuth: true
      };

      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: "oauth-user-123",
            email: "oauth@example.com",
            user_metadata: {},
            app_metadata: {}
          }
        },
        error: null
      });

      mockSupabase.auth.admin.updateUserById.mockResolvedValue({
        data: {
          user: {
            id: "oauth-user-123",
            email: "oauth@example.com",
            user_metadata: {
              role: "citizen",
              mobile_number: "09123456789"
            }
          }
        },
        error: null
      });

      mockSupabase.auth.admin.getUserByEmail.mockResolvedValue({ data: { user: null }, error: null });
    });

    it("should complete registration successfully", async () => {
      await AuthController.completeOAuth(req, res);

      expect(mockSupabase.auth.admin.getUserById).toHaveBeenCalledWith("oauth-user-123");
      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        "oauth-user-123",
        expect.objectContaining({
          user_metadata: expect.objectContaining({
            role: "citizen",
            mobile_number: "09123456789",
            is_oauth: true,
            status: "pending_verification"
          })
        })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "OAuth registration completed successfully"
      }));
    });

    it("should fail if terms not agreed", async () => {
      req.body.agreedToTerms = false;
      await AuthController.completeOAuth(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: "You must agree to the terms and conditions"
      }));
    });

    it("should fail if passwords do not match", async () => {
      req.body.password = "Pass123!";
      req.body.confirmPassword = "Pass456!";
      await AuthController.completeOAuth(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: "Passwords do not match"
      }));
    });
  });
});
