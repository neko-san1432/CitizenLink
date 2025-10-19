const RoleManagementService = require('./RoleManagementService');
const { USER_ROLES } = require('../../shared/constants');
const Database = require('../config/database');

/**
* SuperAdminService
* Handles Super Admin operations: role swaps, department transfers, system logs
*/
class SuperAdminService {
  constructor() {
    this.roleService = new RoleManagementService();
    this.db = new Database();
    this.supabase = this.db.getClient();
  }

  /**
  * Role Swap: Assign any role to any user
  * Super Admin can change anyone's role (except other super admins)
  */
  async roleSwap(userId, newRole, superAdminId, reason) {
    try {
      // Validate super admin
      const adminRole = await this.roleService.getUserRole(superAdminId);
      if (adminRole !== 'super-admin') {
        throw new Error('Only Super Admin can perform role swaps');
      }

      // Get current role
      const currentRole = await this.roleService.getUserRole(userId);

      // Can't change other super admins (unless it's yourself stepping down)
      if (currentRole === 'super-admin' && userId !== superAdminId) {
        throw new Error('Cannot change another Super Admin\'s role');
      }

      // Validate new role
      const validRoles = Object.values(USER_ROLES);
      if (!validRoles.includes(newRole)) {
        throw new Error(`Invalid role: ${newRole}`);
      }

      // Perform role swap
      const result = await this.roleService.updateUserRole(
        userId,
        newRole,
        superAdminId,
        {
          reason: reason || 'Role swap by Super Admin',
          swap_type: 'super_admin_role_swap'
        }
      );

      return {
        success: true,
        message: `User role changed from ${currentRole} to ${newRole}`,
        ...result
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Role swap error:', error);
      throw error;
    }
  }

  /**
  * Transfer user between departments
  * Can transfer officers, admins, coordinators, HR across departments
  */
  async transferUserBetweenDepartments(userId, fromDepartment, toDepartment, superAdminId, reason) {
    try {
      // Validate super admin
      const adminRole = await this.roleService.getUserRole(superAdminId);
      if (adminRole !== 'super-admin') {
        throw new Error('Only Super Admin can transfer between departments');
      }

      // Get current role - must be staff role
      const currentRole = await this.roleService.getUserRole(userId);

      // Check if role is transferable (LGU officers, admins, coordinators, HR)
      const isLguOfficer = /^lgu-(?!admin|hr)/.test(currentRole);
      const isLguAdmin = /^lgu-admin/.test(currentRole);
      const isLguHR = /^lgu-hr/.test(currentRole);
      const isCoordinator = currentRole === 'complaint-coordinator';
      const isTransferable = isLguOfficer || isLguAdmin || isLguHR || isCoordinator;

      if (!isTransferable) {
        throw new Error('Can only transfer staff members (LGU officers, admins, HR, coordinators) between departments');
      }

      if (!reason) {
        throw new Error('Reason is required for department transfer');
      }

      // Perform transfer
      const result = await this.roleService.transferDepartment(
        userId,
        fromDepartment,
        toDepartment,
        superAdminId,
        reason
      );

      return {
        success: true,
        message: `User transferred from ${fromDepartment} to ${toDepartment}`,
        ...result
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Department transfer error:', error);
      throw error;
    }
  }

  /**
  * Promote citizen to any department
  */
  async assignCitizenToDepartment(userId, role, departmentId, superAdminId, reason) {
    try {
      // Validate super admin
      const adminRole = await this.roleService.getUserRole(superAdminId);
      if (adminRole !== 'super-admin') {
        throw new Error('Only Super Admin can assign citizens to departments');
      }

      // Get current role - must be citizen
      const currentRole = await this.roleService.getUserRole(userId);
      if (currentRole !== 'citizen') {
        throw new Error('Can only assign citizens to departments');
      }

      // Validate target role - must be LGU officer, admin, HR, or coordinator
      const isLguOfficer = /^lgu-(?!admin|hr)/.test(role);
      const isLguAdmin = /^lgu-admin/.test(role);
      const isLguHR = /^lgu-hr/.test(role);
      const isCoordinator = role === 'complaint-coordinator';
      const isValidRole = isLguOfficer || isLguAdmin || isLguHR || isCoordinator;

      if (!isValidRole) {
        throw new Error('Invalid department role. Must be LGU officer (lgu-*), lgu-admin, lgu-hr, or complaint-coordinator');
      }

      // Update role and assign department
      const result = await this.roleService.updateUserRole(
        userId,
        role,
        superAdminId,
        {
          department: departmentId,
          reason: reason || `Assigned to ${departmentId} as ${role}`,
          assigned_by_super_admin: true
        }
      );

      return {
        success: true,
        message: `Citizen assigned to ${departmentId} as ${role}`,
        ...result
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Assign citizen error:', error);
      throw error;
    }
  }

  /**
  * Get all system logs
  */
  async getSystemLogs(superAdminId, options = {}) {
    try {
      // Validate super admin
      const adminRole = await this.roleService.getUserRole(superAdminId);
      if (adminRole !== 'super-admin') {
        throw new Error('Only Super Admin can view system logs');
      }

      const {
        log_type = 'all', // 'role_changes', 'department_transfers', 'complaint_workflow', 'all'
        limit = 100,
        offset = 0,
        date_from,
        date_to
      } = options;

      const logs = {};

      // Get role changes
      if (log_type === 'all' || log_type === 'role_changes') {
        let query = this.supabase
          .from('role_changes')
          .select(`
            *,
            user:user_id (email, raw_user_meta_data),
            performer:performed_by (email, raw_user_meta_data)
          `)
          .order('created_at', { ascending: false });

        if (date_from) query = query.gte('created_at', date_from);
        if (date_to) query = query.lte('created_at', date_to);

        const { data, error } = await query.limit(limit).range(offset, offset + limit - 1);

        if (error) throw error;
        logs.role_changes = data || [];
      }

      // Get department transfers
      if (log_type === 'all' || log_type === 'department_transfers') {
        let query = this.supabase
          .from('department_transfers')
          .select(`
            *,
            user:user_id (email, raw_user_meta_data),
            performer:performed_by (email, raw_user_meta_data)
          `)
          .order('created_at', { ascending: false });

        if (date_from) query = query.gte('created_at', date_from);
        if (date_to) query = query.lte('created_at', date_to);

        const { data, error } = await query.limit(limit).range(offset, offset + limit - 1);

        if (error) throw error;
        logs.department_transfers = data || [];
      }

      // Get complaint workflow logs
      if (log_type === 'all' || log_type === 'complaint_workflow') {
        let query = this.supabase
          .from('complaint_workflow_logs')
          .select('*')
          .order('created_at', { ascending: false});

        if (date_from) query = query.gte('created_at', date_from);
        if (date_to) query = query.lte('created_at', date_to);

        const { data, error } = await query.limit(limit).range(offset, offset + limit - 1);

        if (error) throw error;
        logs.complaint_workflow = data || [];
      }

      return {
        success: true,
        logs,
        filters: options
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Get logs error:', error);
      throw error;
    }
  }

  /**
  * Get system statistics
  */
  async getSystemStatistics(superAdminId) {
    try {
      // Validate super admin
      const adminRole = await this.roleService.getUserRole(superAdminId);
      if (adminRole !== 'super-admin') {
        throw new Error('Only Super Admin can view system statistics');
      }

      // Get counts for different entities
      const [
        complaintsCount,
        roleChangesCount,
        departmentTransfersCount
      ] = await Promise.all([
        this.getCount('complaints'),
        this.getCount('role_changes'),
        this.getCount('department_transfers')
      ]);

      return {
        success: true,
        statistics: {
          total_complaints: complaintsCount,
          total_role_changes: roleChangesCount,
          total_department_transfers: departmentTransfersCount
        }
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Get statistics error:', error);
      throw error;
    }
  }

  /**
  * Helper: Get count from table
  */
  async getCount(tableName) {
    try {
      const { count, error } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`[SUPER_ADMIN] Get count for ${tableName} error:`, error);
      return 0;
    }
  }

  /**
  * Get Super Admin dashboard
  */
  async getDashboard(superAdminId) {
    try {
      const [stats, recentLogs] = await Promise.all([
        this.getSystemStatistics(superAdminId),
        this.getSystemLogs(superAdminId, { limit: 10 })
      ]);

      return {
        success: true,
        dashboard: {
          statistics: stats.statistics,
          recent_logs: recentLogs.logs
        }
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Get dashboard error:', error);
      throw error;
    }
  }
}

module.exports = SuperAdminService;

