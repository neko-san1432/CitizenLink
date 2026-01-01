const Database = require("../config/database");
const { USER_ROLES, ROLE_HIERARCHY, SWITCHABLE_ROLES } = require("../../shared/constants");

/**
* RoleManagementService
* Handles role changes by modifying auth.users.raw_user_meta_data
*/
class RoleManagementService {

  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
  }
  /**
  * Update user role in auth.users.raw_user_meta_data
  * @param {string} userId - User ID to update
  * @param {string} newRole - New role to assign
  * @param {string} performedBy - ID of user making the change
  * @param {object} metadata - Additional metadata (department, reason, etc.)
  */
  async updateUserRole(userId, newRole, performedBy, metadata = {}) {
    try {
      // Validate role - only allow exact matches from USER_ROLES
      // Roles should NOT include department suffixes (department is stored in metadata)
      const validRoles = Object.values(USER_ROLES);
      // Also allow 'lgu-officer' as an alias for 'lgu'
      const normalizedRole = newRole === "lgu-officer" ? "lgu" : newRole;

      if (!validRoles.includes(normalizedRole)) {
        throw new Error(`Invalid role: ${newRole}. Valid roles are: ${validRoles.join(", ")}, or 'lgu-officer'`);
      }

      // Use normalized role for consistency
      const finalRole = normalizedRole;
      // Get current user data
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      if (!currentUser || !currentUser.user) {
        throw new Error("User not found");
      }
      const {user} = currentUser;
      // Check both raw_user_meta_data and user_metadata for current role
      const rawMetadata = user.raw_user_meta_data || {};
      const userMetadata = user.user_metadata || {};
      const currentMetadata = { ...userMetadata, ...rawMetadata }; // raw_user_meta_data takes priority
      const currentRole = currentMetadata.role || "citizen";

      console.log("[ROLE] Current user metadata:", {
        userId,
        raw_user_meta_data_role: rawMetadata.role,
        user_metadata_role: userMetadata.role,
        currentRole
      });
      // Create updated metadata
      const updatedMetadata = {
        ...currentMetadata,
        role: finalRole, // Use normalized role
        previous_role: currentRole,
        role_updated_at: new Date().toISOString(),
        role_updated_by: performedBy,
        ...(metadata.reason && { role_change_reason: metadata.reason })
      };

      // Handle department assignment or clearing
      if (metadata.clear_department || (metadata.department === null && newRole === "citizen")) {
        // Remove department when demoting to citizen
        delete updatedMetadata.department;
      } else if (metadata.department) {
        // Assign department if provided
        updatedMetadata.department = metadata.department;
      }
      // Update user metadata using Supabase Admin API
      // Update both raw_user_meta_data and user_metadata for consistency
      console.log("[ROLE] Updating user metadata:", {
        userId,
        newRole,
        updatedMetadata: {
          role: updatedMetadata.role,
          department: updatedMetadata.department,
          previous_role: updatedMetadata.previous_role
        }
      });

      const { data: updatedUser, error: updateError } = await this.supabase.auth.admin.updateUserById(
        userId,
        {
          raw_user_meta_data: updatedMetadata,
          user_metadata: updatedMetadata
        }
      );

      if (updateError) {
        console.error("[ROLE] Update user error:", updateError);
        throw updateError;
      }

      // Verify the update was successful
      if (!updatedUser || !updatedUser.user) {
        throw new Error("User update returned no data");
      }

      // Double-check by fetching the user again
      const { data: verifyUser, error: verifyError } = await this.supabase.auth.admin.getUserById(userId);
      if (verifyError) {
        console.warn("[ROLE] Could not verify update:", verifyError);
      } else {
        const verifiedRole = verifyUser.user.raw_user_meta_data?.role || verifyUser.user.user_metadata?.role;
        console.log("[ROLE] Role updated and verified:", {
          userId,
          oldRole: currentRole,
          newRole: finalRole,
          updatedRole: updatedUser.user.raw_user_meta_data?.role || updatedUser.user.user_metadata?.role,
          verifiedRole,
          match: verifiedRole === finalRole
        });

        if (verifiedRole !== finalRole) {
          console.error("[ROLE] WARNING: Role mismatch after update!", {
            expected: finalRole,
            got: verifiedRole,
            raw_meta: verifyUser.user.raw_user_meta_data?.role,
            user_meta: verifyUser.user.user_metadata?.role
          });
        }
      }
      // Log the role change
      await this.logRoleChange(userId, currentRole, finalRole, performedBy, metadata);
      return {
        success: true,
        user: updatedUser.user,
        previous_role: currentRole,
        new_role: finalRole
      };
    } catch (error) {
      console.error("[ROLE] Update role error:", error);
      throw error;
    }
  }
  /**
  * Get user's current role from auth metadata
  */
  async getUserRole(userId) {
    try {
      const { data, error } = await this.supabase.auth.admin.getUserById(userId);

      if (error) throw error;
      if (!data || !data.user) throw new Error("User not found");
      const serverMeta = data.user.raw_user_meta_data || {};
      const publicMeta = data.user.user_metadata || {};
      const role = serverMeta.role || publicMeta.role || "citizen";
      return role;
    } catch (error) {
      console.error("[ROLE] Get user role error:", error);
      throw error;
    }
  }
  /**
  * Check if user can switch to citizen mode
  */
  canSwitchToCitizen(userRole) {
    return SWITCHABLE_ROLES.includes(userRole);
  }
  /**
  * Toggle user to citizen mode (temporary)
  * Stores in session/local state, not in database
  */
  async createCitizenSession(userId, actualRole) {
    // This returns data for client-side session storage
    return {
      user_id: userId,
      actual_role: actualRole,
      active_role: "citizen",
      mode: "citizen_mode",
      switched_at: new Date().toISOString()
    };
  }
  /**
  * Check if role A can manage role B
  */
  canManageRole(managerRole, targetRole) {
    const managerLevel = ROLE_HIERARCHY[managerRole] || 0;
    const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
    return managerLevel > targetLevel;
  }
  /**
  * Get all users by role
  */
  async getUsersByRole(role, options = {}) {
    try {
      // Note: Supabase doesn't allow querying auth.users directly via client
      // This would need to use a custom RPC function or edge function
      // For now, we'll use the business users table
      // TODO: Implement proper user listing
      // This is a placeholder that would need enhancement
      console.warn("[ROLE] getUsersByRole needs custom RPC implementation");
      return {
        users: [],
        message: "User listing requires custom Supabase RPC function"
      };
    } catch (error) {
      console.error("[ROLE] Get users by role error:", error);
      throw error;
    }
  }
  /**
  * Log role change for audit trail
  */
  async logRoleChange(userId, oldRole, newRole, performedBy, metadata = {}) {
    try {
      // Create a role_changes table entry
      const logEntry = {
        user_id: userId,
        old_role: oldRole,
        new_role: newRole,
        performed_by: performedBy,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          ip_address: metadata.ip_address || null
        },
        created_at: new Date().toISOString()
      };
      // Insert into role_changes table
      const { error } = await this.supabase
        .from("role_changes")
        .insert(logEntry);
      if (error) {
        console.warn("[ROLE] Failed to log role change:", error);
        // Don't throw - logging failure shouldn't break role change
      }
      return true;
    } catch (error) {
      console.error("[ROLE] Log role change error:", error);
      return false;
    }
  }
  /**
  * Assign user to department
  */
  async assignDepartment(userId, departmentId, assignedBy) {
    try {
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      const {user} = currentUser;
      const currentMetadata = user.raw_user_meta_data || {};
      const updatedMetadata = {
        ...currentMetadata,
        department: departmentId,
        department_assigned_at: new Date().toISOString(),
        department_assigned_by: assignedBy
      };
      const { data: updatedUser, error: updateError } = await this.supabase.auth.admin.updateUserById(
        userId,
        {
          raw_user_meta_data: updatedMetadata
        }
      );
      if (updateError) throw updateError;
      // console.log removed for security
      return {
        success: true,
        user: updatedUser.user
      };
    } catch (error) {
      console.error("[ROLE] Assign department error:", error);
      throw error;
    }
  }
  /**
  * Transfer user between departments
  */
  async transferDepartment(userId, fromDepartment, toDepartment, transferredBy, reason) {
    try {
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      const {user} = currentUser;
      const currentMetadata = user.raw_user_meta_data || {};
      const updatedMetadata = {
        ...currentMetadata,
        department: toDepartment,
        previous_department: fromDepartment,
        department_transferred_at: new Date().toISOString(),
        department_transferred_by: transferredBy,
        transfer_reason: reason
      };
      const { data: updatedUser, error: updateError } = await this.supabase.auth.admin.updateUserById(
        userId,
        {
          raw_user_meta_data: updatedMetadata
        }
      );
      if (updateError) throw updateError;
      // Log the transfer
      await this.logDepartmentTransfer(userId, fromDepartment, toDepartment, transferredBy, reason);
      // console.log removed for security
      return {
        success: true,
        user: updatedUser.user,
        from_department: fromDepartment,
        to_department: toDepartment
      };
    } catch (error) {
      console.error("[ROLE] Transfer department error:", error);
      throw error;
    }
  }
  /**
  * Log department transfer
  */
  async logDepartmentTransfer(userId, fromDept, toDept, performedBy, reason) {
    try {
      const logEntry = {
        user_id: userId,
        from_department: fromDept,
        to_department: toDept,
        performed_by: performedBy,
        reason,
        created_at: new Date().toISOString()
      };
      const { error } = await this.supabase
        .from("department_transfers")
        .insert(logEntry);
      if (error) {
        console.warn("[ROLE] Failed to log department transfer:", error);
      }
      return true;
    } catch (error) {
      console.error("[ROLE] Log department transfer error:", error);
      return false;
    }
  }
  /**
  * Validate permission for role change
  */
  validateRoleChangePermission(performerRole, targetCurrentRole, targetNewRole) {
    const errors = [];
    // HR can manage: lgu-* officers, lgu-admin
    if (performerRole === "lgu-hr" || /^lgu-hr-/.test(performerRole)) {
      // HR can assign LGU officer roles (lgu-wst, lgu-engineering, etc.) and lgu-admin
      const isLguOfficer = /^lgu-(?!admin|hr)/.test(targetNewRole);
      const isLguAdmin = /^lgu-admin/.test(targetNewRole);
      if (!isLguOfficer && !isLguAdmin) {
        errors.push("HR can only assign LGU officer (lgu-*) and lgu-admin roles");
      }
    }
    // Super Admin can manage all roles
    if (performerRole === "super-admin") {
      // No restrictions
    }
    // No one else can change roles
    const isHR = performerRole === "lgu-hr" || /^lgu-hr-/.test(performerRole);
    if (!isHR && performerRole !== "super-admin") {
      errors.push("Only HR and Super Admin can change roles");
    }
    // Can't demote yourself
    // (This check would be done at controller level with req.user.id)

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = RoleManagementService;

