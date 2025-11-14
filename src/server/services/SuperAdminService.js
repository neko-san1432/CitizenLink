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
    this.db = Database.getInstance();
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

      // Prepare metadata - clear department if demoting to citizen
      const metadata = {
        reason: reason || 'Role swap by Super Admin',
        swap_type: 'super_admin_role_swap'
      };

      // If demoting to citizen, explicitly clear the department
      if (newRole === 'citizen') {
        metadata.department = null;
        metadata.clear_department = true;
      }

      console.log('[SUPER_ADMIN] Role swap - calling updateUserRole:', {
        userId,
        newRole,
        superAdminId,
        currentRole,
        metadata
      });

      // Perform role swap
      const result = await this.roleService.updateUserRole(
        userId,
        newRole,
        superAdminId,
        metadata
      );

      console.log('[SUPER_ADMIN] Role swap - updateUserRole result:', result);

      // Verify the role was actually changed
      const verifyRole = await this.roleService.getUserRole(userId);
      console.log('[SUPER_ADMIN] Role swap - verified role after update:', verifyRole);

      if (verifyRole !== newRole) {
        console.error('[SUPER_ADMIN] WARNING: Role update may have failed. Expected:', newRole, 'Got:', verifyRole);
      }

      return {
        success: true,
        message: `User role changed from ${currentRole} to ${newRole}`,
        verified_role: verifyRole,
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
      // Validate target role - must be LGU officer, admin, HR, coordinator, or super-admin
      // Note: Roles should NOT include department suffix (e.g., use 'lgu-officer' not 'lgu-ceeo')
      const isLguOfficer = role === 'lgu-officer' || role === 'lgu';
      const isLguAdmin = role === 'lgu-admin';
      const isLguHR = role === 'lgu-hr';
      const isCoordinator = role === 'complaint-coordinator';
      const isSuperAdmin = role === 'super-admin';
      const isValidRole = isLguOfficer || isLguAdmin || isLguHR || isCoordinator || isSuperAdmin;

      console.log('[SUPER_ADMIN] Role validation:', {
        role,
        isLguOfficer,
        isLguAdmin,
        isLguHR,
        isCoordinator,
        isSuperAdmin,
        isValidRole
      });

      if (!isValidRole) {
        throw new Error(`Invalid role: "${role}". Must be lgu-officer, lgu-admin, lgu-hr, complaint-coordinator, or super-admin`);
      }
      console.log('[SUPER_ADMIN] Assign citizen - calling updateUserRole:', {
        userId,
        role,
        departmentId,
        superAdminId,
        currentRole
      });

      // Update role and assign department (if not super-admin or complaint-coordinator)
      const rolesWithoutDept = ['super-admin', 'complaint-coordinator'];
      const needsDepartment = !rolesWithoutDept.includes(role);

      const metadata = {
        reason: reason || (role === 'super-admin' ? `Promoted to Super Admin` :
          role === 'complaint-coordinator' ? `Promoted to Complaint Coordinator` :
            `Assigned to ${departmentId} as ${role}`),
        assigned_by_super_admin: true
      };

      // Only assign department if role requires it
      if (needsDepartment && departmentId) {
        metadata.department = departmentId;
      } else if (!needsDepartment) {
        // Explicitly clear department for roles that don't need it
        metadata.department = null;
        metadata.clear_department = true;
      }

      const result = await this.roleService.updateUserRole(
        userId,
        role,
        superAdminId,
        metadata
      );

      console.log('[SUPER_ADMIN] Assign citizen - updateUserRole result:', result);

      // Verify the role was actually changed
      const verifyRole = await this.roleService.getUserRole(userId);
      console.log('[SUPER_ADMIN] Assign citizen - verified role after update:', verifyRole);

      if (verifyRole !== role) {
        console.error('[SUPER_ADMIN] WARNING: Role update may have failed. Expected:', role, 'Got:', verifyRole);
        // Still return success but with warning
      }

      return {
        success: true,
        message: `Citizen assigned to ${departmentId} as ${role}`,
        verified_role: verifyRole,
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
        try {
          let query = this.supabase
            .from('role_changes')
            .select(`
              *,
              user:user_id (email, raw_user_meta_data),
              performer:changed_by (email, raw_user_meta_data)
            `)
            .order('created_at', { ascending: false });
          if (date_from) query = query.gte('created_at', date_from);
          if (date_to) query = query.lte('created_at', date_to);
          const { data, error } = await query.limit(limit).range(offset, offset + limit - 1);
          if (error) {
            // Fallback: get role changes without joins
            const { data: fallbackData, error: fallbackError } = await this.supabase
              .from('role_changes')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(limit)
              .range(offset, offset + limit - 1);
            if (fallbackError) throw fallbackError;
            logs.role_changes = fallbackData || [];
          } else {
            logs.role_changes = data || [];
          }
        } catch (error) {
          logs.role_changes = [];
        }
      }
      // Get department transfers
      if (log_type === 'all' || log_type === 'department_transfers') {
        try {
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
          if (error) {
            // Fallback: get department transfers without joins
            const { data: fallbackData, error: fallbackError } = await this.supabase
              .from('department_transfers')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(limit)
              .range(offset, offset + limit - 1);
            if (fallbackError) throw fallbackError;
            logs.department_transfers = fallbackData || [];
          } else {
            logs.department_transfers = data || [];
          }
        } catch (error) {
          logs.department_transfers = [];
        }
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
        this.getCount('role_changes').catch(() => 0),
        this.getCount('department_transfers').catch(() => 0)
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
  * Get latest registered users (with confirmed emails or OAuth)
  */
  async getLatestRegisteredUsers(superAdminId, limit = 5) {
    try {
      // Validate super admin
      const adminRole = await this.roleService.getUserRole(superAdminId);
      if (adminRole !== 'super-admin') {
        throw new Error('Only Super Admin can view latest registered users');
      }

      const userService = require('./UserService');

      // Get all users (we'll filter for confirmed emails/OAuth)
      const result = await userService.getUsers({ includeInactive: false }, { page: 1, limit: 1000 });
      const allUsers = result.users || [];

      // Filter users with confirmed emails or OAuth providers
      // OAuth users typically have email_confirmed_at set automatically
      // We need to check the raw auth user data for email_confirmed_at
      const Database = require('../config/database');
      const supabase = Database.getClient();

      let confirmedUsers = [];
      try {
        // Get users with confirmed emails using admin API
        const { data: authUsers, error } = await supabase.auth.admin.listUsers({
          perPage: 1000
        });

        if (!error && authUsers && authUsers.users) {
          // Filter users with confirmed emails (email_confirmed_at is not null)
          // OAuth users typically have email_confirmed_at set automatically
          const confirmedAuthUsers = authUsers.users.filter(user =>
            user.email_confirmed_at !== null && user.email_confirmed_at !== void 0
          );

          // Map to our user format and sort by created_at (newest first)
          confirmedUsers = confirmedAuthUsers
            .map(authUser => {
              const formattedUser = userService.formatUserResponse(authUser);
              return {
                ...formattedUser,
                created_at: authUser.created_at,
                email_confirmed_at: authUser.email_confirmed_at,
                is_oauth: Boolean(authUser.app_metadata?.provider && authUser.app_metadata.provider !== 'email')
              };
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);
        }
      } catch (err) {
        console.error('[SUPER_ADMIN] Error fetching confirmed users:', err);
        // Fallback: return users from UserService (may not have confirmation status)
        confirmedUsers = allUsers
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          .slice(0, limit);
      }

      return {
        success: true,
        users: confirmedUsers
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Get latest registered users error:', error);
      throw error;
    }
  }
  /**
  * Get role distribution for pie chart (super admin)
  * Returns: citizen, hr, officer, admin (excluding super-admin)
  */
  async getRoleDistribution(superAdminId) {
    try {
      // Validate super admin
      const adminRole = await this.roleService.getUserRole(superAdminId);
      if (adminRole !== 'super-admin') {
        throw new Error('Only Super Admin can view role distribution');
      }

      const userService = require('./UserService');
      const result = await userService.getUsers({ includeInactive: false }, { page: 1, limit: 10000 });
      const users = result.users || [];

      // Count roles
      let citizens = 0;
      let hr = 0;
      let officers = 0;
      let admins = 0;

      users.forEach(user => {
        const role = String(user.role || '').toLowerCase();
        const normalizedRole = String(user.normalizedRole || role).toLowerCase();

        // Exclude super-admin
        if (role === 'super-admin' || normalizedRole === 'super-admin') {
          return;
        }

        // Count citizens
        if (role === 'citizen' || normalizedRole === 'citizen') {
          citizens++;
        }
        // Count HR
        else if (role === 'lgu-hr' || normalizedRole === 'lgu-hr' || /^lgu-hr/.test(role)) {
          hr++;
        }
        // Count admins (LGU admins only, excluding super-admin)
        else if (/^lgu-admin/.test(role) || /^lgu-admin/.test(normalizedRole)) {
          admins++;
        }
        // Count officers (simplified 'lgu' and lgu-* excluding admin/hr)
        else if (role === 'lgu' || /^lgu-(?!admin|hr)/.test(role)) {
          officers++;
        }
      });

      return {
        success: true,
        distribution: {
          citizens,
          hr,
          officers,
          admins
        }
      };
    } catch (error) {
      console.error('[SUPER_ADMIN] Get role distribution error:', error);
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
