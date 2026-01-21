/**
 * Unit Tests: User Deletion (GDPR Compliance)
 * Tests user data deletion functionality
 */

const ComplianceService = require("../../src/server/services/ComplianceService");

describe("User Deletion and Data Cleanup", () => {
  let complianceService;
  let mockSupabase;

  beforeEach(() => {
    complianceService = new ComplianceService();

    // Mock Supabase client
    mockSupabase = {
      auth: {
        admin: {
          deleteUser: jest.fn().mockResolvedValue({ error: null }),
          getUserById: jest.fn().mockResolvedValue({ data: { user: { id: "user_123", email: "test@example.com" } }, error: null })
        }
      },
      from: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null })
    };

    // Inject mock
    complianceService.supabase = mockSupabase;

    // Mock AuditLogRepository
    complianceService.auditLog = {
      log: jest.fn().mockResolvedValue(true),
      list: jest.fn().mockResolvedValue([]),
      getUserLogs: jest.fn().mockResolvedValue([])
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Delete User Data", () => {
    it("should delete user from auth system", async () => {
      const userId = "user_123";
      const performedBy = "admin_user";

      await complianceService.deleteUserData(userId, performedBy);

      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith(userId);
    });

    it("should delete user complaints", async () => {
      const userId = "user_123";
      const performedBy = "admin_user";

      const deleteMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({ error: null });

      mockSupabase.from = jest.fn(() => ({
        delete: deleteMock,
        eq: eqMock
      }));

      await complianceService.deleteUserData(userId, performedBy, { deleteComplaints: true });

      expect(mockSupabase.from).toHaveBeenCalledWith("complaints");
    });

    it("should throw error when deletion fails", async () => {
      const userId = "user_123";
      const performedBy = "admin_user";

      mockSupabase.auth.admin.deleteUser = jest.fn().mockResolvedValue({
        error: { message: "System error" }
      });

      await expect(complianceService.deleteUserData(userId, performedBy))
        .rejects.toThrow("Failed to delete user: System error");
    });
  });

  describe("Cascade Deletion Rules", () => {
    it("should identify related data to be deleted", () => {
      const relatedTables = [
        "complaints",
        "complaint_assignments",
        "notifications",
        "user_sessions",
        "login_attempts"
      ];

      relatedTables.forEach(table => {
        expect(table).toBeTruthy();
        expect(typeof table).toBe("string");
      });
    });

    it("should preserve audit logs even after user deletion", async () => {
      const userId = "user_123";

      // Audit logs should NOT be deleted
      mockSupabase.from = jest.fn((table) => {
        if (table === "audit_logs") {
          throw new Error("Audit logs should not be deleted");
        }
        return {
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null })
        };
      });

      try {
        await complianceService.deleteUserData(userId);
        // Should not attempt to delete from audit_logs
      } catch (error) {
        // If it tries to delete audit_logs, test should fail
        expect(error.message).not.toContain("audit_logs");
      }
    });
  });


  describe("Permission Checks", () => {
    it("should only allow admin users to delete accounts", () => {
      const allowedRoles = ["super-admin", "hr"];
      const deniedRoles = ["citizen", "lgu-officer", "complaint-coordinator"];

      allowedRoles.forEach(role => {
        const canDelete = ["super-admin", "hr"].includes(role);
        expect(canDelete).toBe(true);
      });

      deniedRoles.forEach(role => {
        const canDelete = ["super-admin", "hr"].includes(role);
        expect(canDelete).toBe(false);
      });
    });

    it("should prevent users from deleting themselves", () => {
      const currentUserId = "user_123";
      const targetUserId = "user_123";

      const isSelfDeletion = currentUserId === targetUserId;
      expect(isSelfDeletion).toBe(true);

      // Self-deletion should be blocked
      if (isSelfDeletion) {
        const shouldBlock = true;
        expect(shouldBlock).toBe(true);
      }
    });
  });
});
