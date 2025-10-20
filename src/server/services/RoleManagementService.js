const Database = require('../config/database');
const { USER_ROLES, ROLE_HIERARCHY, SWITCHABLE_ROLES } = require('../../shared/constants');

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
      // Validate role
      const validRoles = Object.values(USER_ROLES);
      if (!validRoles.includes(newRole)) {
        throw new Error(`Invalid role: ${newRole}`);
      }

      // Get current user data
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);

      if (getUserError) throw getUserError;
      if (!currentUser || !currentUser.user) {
        throw new Error('User not found');
      }

      const user = currentUser.user;
      const currentMetadata = user.raw_user_meta_data || {};
      const currentRole = currentMetadata.role || 'citizen';

      // Create updated metadata
      const updatedMetadata = {
        ...currentMetadata,
        role: newRole,
        previous_role: currentRole,
        role_updated_at: new Date().toISOString(),
        role_updated_by: performedBy,
        ...(metadata.department && { department: metadata.department }),
        ...(metadata.reason && { role_change_reason: metadata.reason })
      };

      // Update user metadata using Supabase Admin API
      const { data: updatedUser, error: updateError } = await this.supabase.auth.admin.updateUserById(
        userId,
        {
          raw_user_meta_data: updatedMetadata
        }
      );

      if (updateError) throw updateError;

      // Log the role change
      await this.logRoleChange(userId, currentRole, newRole, performedBy, metadata);

      return {
        success: true,
        user: updatedUser.user,
        previous_role: currentRole,
        new_role: newRole
      };
    } catch (error) {
      console.error('[ROLE] Update role error:', error);
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
      if (!data || !data.user) throw new Error('User not found');

      const serverMeta = data.user.raw_user_meta_data || {};
      const publicMeta = data.user.user_metadata || {};
      const role = serverMeta.role || publicMeta.role || 'citizen';
      return role;
    } catch (error) {
      console.error('[ROLE] Get user role error:', error);
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
      active_role: 'citizen',
      mode: 'citizen_mode',
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
      console.warn('[ROLE] getUsersByRole needs custom RPC implementation');

      return {
        users: [],
        message: 'User listing requires custom Supabase RPC function'
      };
    } catch (error) {
      console.error('[ROLE] Get users by role error:', error);
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
        .from('role_changes')
        .insert(logEntry);

      if (error) {
        console.warn('[ROLE] Failed to log role change:', error);
        // Don't throw - logging failure shouldn't break role change
      }

      return true;
    } catch (error) {
      console.error('[ROLE] Log role change error:', error);
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

      const user = currentUser.user;
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
      console.error('[ROLE] Assign department error:', error);
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

      const user = currentUser.user;
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
      console.error('[ROLE] Transfer department error:', error);
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
        .from('department_transfers')
        .insert(logEntry);

      if (error) {
        console.warn('[ROLE] Failed to log department transfer:', error);
      }

      return true;
    } catch (error) {
      console.error('[ROLE] Log department transfer error:', error);
      return false;
    }
  }

  /**
  * Validate permission for role change
  */
  validateRoleChangePermission(performerRole, targetCurrentRole, targetNewRole) {
    const errors = [];

    // HR can manage: lgu-* officers, lgu-admin
    if (performerRole === 'lgu-hr' || /^lgu-hr-/.test(performerRole)) {
      // HR can assign LGU officer roles (lgu-wst, lgu-engineering, etc.) and lgu-admin
      const isLguOfficer = /^lgu-(?!admin|hr)/.test(targetNewRole);
      const isLguAdmin = /^lgu-admin/.test(targetNewRole);

      if (!isLguOfficer && !isLguAdmin) {
        errors.push('HR can only assign LGU officer (lgu-*) and lgu-admin roles');
      }
    }

    // Super Admin can manage all roles
    if (performerRole === 'super-admin') {
      // No restrictions
    }

    // No one else can change roles
    const isHR = performerRole === 'lgu-hr' || /^lgu-hr-/.test(performerRole);
    if (!isHR && performerRole !== 'super-admin') {
      errors.push('Only HR and Super Admin can change roles');
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

