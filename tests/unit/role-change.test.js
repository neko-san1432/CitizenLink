describe("RoleManagementService - Role Changes", () => {
  let RoleManagementService;
  let roleService;
  let mockSupabase;
  let mockDatabase;

  beforeEach(() => {
    jest.resetModules(); // Clear cache to ensure fresh require

    // Mock dependencies
    mockSupabase = {
      auth: {
        admin: {
          getUserById: jest.fn(),
          updateUserById: jest.fn()
        }
      },
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis()
    };

    mockDatabase = {
      getClient: jest.fn().mockReturnValue(mockSupabase)
    };

    // Mock the Database class constructor
    const MockDatabaseClass = jest.fn().mockImplementation(() => mockDatabase);

    // Use jest.doMock for dependencies
    jest.doMock("../../src/server/config/database", () => MockDatabaseClass);
    jest.doMock("../../src/shared/constants", () => ({
      USER_ROLES: {
        CITIZEN: "citizen",
        LGU_OFFICER: "lgu",
        LGU_ADMIN: "lgu-admin",
        SUPER_ADMIN: "super-admin",
        LGU_HR: "lgu-hr"
      },
      ROLE_HIERARCHY: {
        "super-admin": 100,
        "lgu-hr": 50,
        "lgu-admin": 40,
        "lgu-officer": 30,
        "citizen": 10
      },
      SWITCHABLE_ROLES: ["lgu-admin", "lgu-officer", "lgu-hr", "super-admin"]
    }));

    // Require the service AFTER mocking
    RoleManagementService = require("../../src/server/services/RoleManagementService");
    roleService = new RoleManagementService();
  });

  describe("validateRoleChangePermission", () => {
    test("LGU HR can assign LGU officer roles", () => {
      const result = roleService.validateRoleChangePermission("lgu-hr", "citizen", "lgu-officer");
      expect(result.isValid).toBe(true);
    });

    test("LGU HR can assign LGU admin roles", () => {
      const result = roleService.validateRoleChangePermission("lgu-hr", "citizen", "lgu-admin");
      expect(result.isValid).toBe(true);
    });

    test("LGU HR cannot assign super-admin role", () => {
      const result = roleService.validateRoleChangePermission("lgu-hr", "citizen", "super-admin");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("HR can only assign LGU officer");
    });

    test("Super Admin can assign any role", () => {
      const result = roleService.validateRoleChangePermission("super-admin", "citizen", "super-admin");
      expect(result.isValid).toBe(true);
    });

    test("Citizen cannot change roles", () => {
      const result = roleService.validateRoleChangePermission("citizen", "citizen", "lgu-officer");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Only HR and Super Admin can change roles");
    });
  });

  describe("updateUserRole", () => {
    const userId = "user-123";
    const performedBy = "admin-456";

    test("Promote Citizen to LGU Officer with Department", async () => {
      const currentRole = "citizen";
      const newRole = "lgu-officer";
      const department = "ENG";

      // Mock getUserById
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            user_metadata: { role: currentRole },
            raw_user_meta_data: { role: currentRole }
          }
        },
        error: null
      });

      // Mock updateUserById
      mockSupabase.auth.admin.updateUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            user_metadata: { role: newRole, department },
            raw_user_meta_data: { role: newRole, department }
          }
        },
        error: null
      });

      // Mock logRoleChange (insert)
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await roleService.updateUserRole(userId, newRole, performedBy, { department });

      expect(result.success).toBe(true);
      expect(result.new_role).toBe("lgu"); // Service normalizes lgu-officer to lgu
      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          user_metadata: expect.objectContaining({
            role: "lgu", // Service normalizes lgu-officer to lgu
            department,
            previous_role: currentRole
          })
        })
      );
    });

    test("Demote LGU Officer to Citizen (clears department)", async () => {
      const currentRole = "lgu-officer";
      const newRole = "citizen";
      const department = "ENG";

      // Mock getUserById
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            user_metadata: { role: currentRole, department },
            raw_user_meta_data: { role: currentRole, department }
          }
        },
        error: null
      });

      // Mock updateUserById
      mockSupabase.auth.admin.updateUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            user_metadata: { role: newRole }, // Department removed
            raw_user_meta_data: { role: newRole }
          }
        },
        error: null
      });

      // Mock logRoleChange (insert)
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await roleService.updateUserRole(userId, newRole, performedBy, { department: null });

      expect(result.success).toBe(true);
      expect(result.new_role).toBe(newRole);

      // Verify department is NOT in the update payload (or explicitly set to null/undefined if that's how the service handles it)
      // The service uses `delete updatedMetadata.department`, so it shouldn't be present.
      const updateCall = mockSupabase.auth.admin.updateUserById.mock.calls[0][1];
      expect(updateCall.user_metadata.department).toBeUndefined();
      expect(updateCall.user_metadata.role).toBe(newRole);
    });

    test("Super Admin promoting to LGU Admin", async () => {
      const currentRole = "citizen";
      const newRole = "lgu-admin";
      const department = "HR";

      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            user_metadata: { role: currentRole },
            raw_user_meta_data: { role: currentRole }
          }
        },
        error: null
      });

      mockSupabase.auth.admin.updateUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            user_metadata: { role: newRole, department },
            raw_user_meta_data: { role: newRole, department }
          }
        },
        error: null
      });
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await roleService.updateUserRole(userId, newRole, performedBy, { department });

      expect(result.success).toBe(true);
      expect(result.new_role).toBe(newRole);
      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          user_metadata: expect.objectContaining({
            role: newRole,
            department
          })
        })
      );
    });
  });
});
