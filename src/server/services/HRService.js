const RoleManagementService = require('./RoleManagementService');
const { USER_ROLES } = require('../../shared/constants');
const { validateUserRole, isValidDepartmentCode } = require('../utils/roleValidation');

/**
* HRService
* Handles HR-specific operations: manage LGU officers and admins
*/
class HRService {

  constructor() {
    this.roleService = new RoleManagementService();
  }
  /**
  * Promote citizen to LGU officer
  */
  async promoteToOfficer(userId, hrId, options = {}) {
    try {
      // Validate permission
      const hrRole = await this.roleService.getUserRole(hrId);
      if (hrRole !== 'lgu-hr' && !/^lgu-hr-/.test(hrRole) && hrRole !== 'super-admin') {
        throw new Error('Only HR can promote to officer');
      }
      // Get current role
      const currentRole = await this.roleService.getUserRole(userId);
      if (currentRole !== 'citizen') {
        throw new Error('Can only promote citizens to officer');
      }
      // Determine department scope for HR: if hrRole is lgu-hr-{dept}, lock options.department
      if (/^lgu-hr-/.test(hrRole)) {
        const dept = hrRole.split('-')[2];
        if (dept) options.department = dept.toUpperCase();
      }
      // Update role
      const result = await this.roleService.updateUserRole(
        userId,
        USER_ROLES.LGU_OFFICER,
        hrId,
        {
          department: options.department,
          reason: options.reason || 'Promoted to LGU Officer',
          promoted_by: hrId
        }
      );
      return {
        success: true,
        message: 'User promoted to LGU Officer',
        ...result
      };
    } catch (error) {
      console.error('[HR] Promote to officer error:', error);
      throw error;
    }
  }
  /**
  * Promote LGU officer to LGU admin
  */
  async promoteToAdmin(userId, hrId, options = {}) {
    try {
      // Validate permission
      const hrRole = await this.roleService.getUserRole(hrId);
      if (hrRole !== 'lgu-hr' && hrRole !== 'super-admin') {
        throw new Error('Only HR can promote to admin');
      }
      // Get current role - must be an LGU officer (lgu-wst, lgu-engineering, etc.)
      const currentRole = await this.roleService.getUserRole(userId);
      const isLguOfficer = /^lgu-(?!admin|hr)/.test(currentRole);
      if (!isLguOfficer) {
        throw new Error('Can only promote LGU officers to admin');
      }
      // Determine department scope for HR: if hrRole is lgu-hr-{dept}, lock options.department
      if (/^lgu-hr-/.test(hrRole)) {
        const dept = hrRole.split('-')[2];
        if (dept) options.department = dept.toUpperCase();
      }
      // Update role
      const result = await this.roleService.updateUserRole(
        userId,
        USER_ROLES.LGU_ADMIN,
        hrId,
        {
          department: options.department,
          reason: options.reason || 'Promoted to LGU Admin',
          promoted_by: hrId
        }
      );
      return {
        success: true,
        message: 'User promoted to LGU Admin',
        ...result
      };
    } catch (error) {
      console.error('[HR] Promote to admin error:', error);
      throw error;
    }
  }
  /**
  * Demote LGU admin to LGU officer
  */
  async demoteAdminToOfficer(userId, hrId, options = {}) {
    try {
      // Validate permission
      const hrRole = await this.roleService.getUserRole(hrId);
      if (hrRole !== 'lgu-hr' && hrRole !== 'super-admin') {
        throw new Error('Only HR can demote admin');
      }
      // Get current role - must be an LGU admin
      const currentRole = await this.roleService.getUserRole(userId);
      const isLguAdmin = /^lgu-admin/.test(currentRole);
      if (!isLguAdmin) {
        throw new Error('Can only demote LGU admins');
      }
      // Don't allow self-demotion
      if (userId === hrId) {
        throw new Error('Cannot demote yourself');
      }
      // Update role
      const result = await this.roleService.updateUserRole(
        userId,
        USER_ROLES.LGU_OFFICER,
        hrId,
        {
          reason: options.reason || 'Demoted to LGU Officer',
          demoted_by: hrId
        }
      );
      return {
        success: true,
        message: 'User demoted to LGU Officer',
        ...result
      };
    } catch (error) {
      console.error('[HR] Demote to officer error:', error);
      throw error;
    }
  }
  /**
  * Strip all titles - revert to citizen
  */
  async stripTitles(userId, hrId, reason) {
    try {
      // Validate permission
      const hrRole = await this.roleService.getUserRole(hrId);
      if (hrRole !== 'lgu-hr' && hrRole !== 'super-admin') {
        throw new Error('Only HR can strip titles');
      }
      // Get current role
      const currentRole = await this.roleService.getUserRole(userId);
      // Can't strip citizen or HR/Super Admin roles
      if (currentRole === 'citizen') {
        throw new Error('User is already a citizen');
      }
      if (currentRole === 'lgu-hr' || currentRole === 'super-admin') {
        throw new Error('Cannot strip HR or Super Admin titles');
      }
      // Don't allow self-demotion
      if (userId === hrId) {
        throw new Error('Cannot strip your own titles');
      }
      if (!reason) {
        throw new Error('Reason is required to strip titles');
      }
      // Update role to citizen
      const result = await this.roleService.updateUserRole(
        userId,
        USER_ROLES.CITIZEN,
        hrId,
        {
          reason,
          titles_stripped_by: hrId,
          titles_stripped_at: new Date().toISOString()
        }
      );
      return {
        success: true,
        message: 'All titles stripped - user reverted to citizen',
        ...result
      };
    } catch (error) {
      console.error('[HR] Strip titles error:', error);
      throw error;
    }
  }
  /**
  * Assign LGU officer to department
  */
  async assignOfficerToDepartment(userId, departmentId, hrId) {
    try {
      // Validate permission
      const hrRole = await this.roleService.getUserRole(hrId);
      if (hrRole !== 'lgu-hr' && !/^lgu-hr-/.test(hrRole) && hrRole !== 'super-admin') {
        throw new Error('Only HR can assign to department');
      }
      // Get current role - must be LGU officer or admin
      const currentRole = await this.roleService.getUserRole(userId);
      const isLguOfficer = /^lgu-(?!admin|hr)/.test(currentRole);
      const isLguAdmin = /^lgu-admin/.test(currentRole);
      if (!isLguOfficer && !isLguAdmin) {
        throw new Error('Can only assign LGU officers/admins to departments');
      }
      // Constrain department if HR is department-scoped
      let targetDept = departmentId;
      if (/^lgu-hr-/.test(hrRole)) {
        const dept = hrRole.split('-')[2];
        if (dept) targetDept = dept.toUpperCase();
      }
      const result = await this.roleService.assignDepartment(userId, targetDept, hrId);
      return {
        success: true,
        message: `User assigned to department ${targetDept}`,
        ...result
      };
    } catch (error) {
      console.error('[HR] Assign to department error:', error);
      throw error;
    }
  }
  /**
  * Get HR dashboard data
  */
  async getHRDashboard(hrId) {
    try {
      // Validate HR role
      const hrRole = await this.roleService.getUserRole(hrId);
      const isHR = hrRole === 'lgu-hr' || /^lgu-hr/.test(hrRole);
      const isSuperAdmin = hrRole === 'super-admin';
      if (!isHR && !isSuperAdmin) {
        throw new Error('Access denied: HR role required');
      }
      // TODO: Implement dashboard stats
      // - Total officers
      // - Total admins
      // - Recent promotions
      // - Recent demotions
      // - Pending requests
      return {
        statistics: {
          total_officers: 0,
          total_admins: 0,
          promotions_this_month: 0,
          demotions_this_month: 0
        },
        recent_actions: [],
        pending_requests: []
      };
    } catch (error) {
      console.error('[HR] Get dashboard error:', error);
      throw error;
    }
  }
  /**
  * Get role distribution for pie chart (HR office only)
  * Returns: hr, admin, officers within the HR's office
  */
  async getRoleDistribution(hrId) {
    try {
      // Validate HR role
      const hrRole = await this.roleService.getUserRole(hrId);
      const isHR = hrRole === 'lgu-hr' || /^lgu-hr/.test(hrRole);
      const isSuperAdmin = hrRole === 'super-admin';
      if (!isHR && !isSuperAdmin) {
        throw new Error('Access denied: HR role required');
      }

      // Get HR user's department
      const { data: hrUser, error: hrUserError } = await this.roleService.supabase.auth.admin.getUserById(hrId);
      if (hrUserError || !hrUser?.user) {
        throw new Error('Failed to get HR user information');
      }

      const hrMetadata = hrUser.user.raw_user_meta_data || hrUser.user.user_metadata || {};
      const hrDepartment = hrMetadata.department || hrMetadata.dpt;

      // If super admin, they can see all, but for HR we filter by their department
      const userService = require('./UserService');
      const result = await userService.getUsers({ includeInactive: false }, { page: 1, limit: 10000 });
      const allUsers = result.users || [];

      // Filter users by HR's department (if HR has a department)
      let officeUsers = allUsers;
      if (hrDepartment && !isSuperAdmin) {
        officeUsers = allUsers.filter(user => {
          const userDept = user.department ||
                          user.dpt ||
                          user?.raw_user_meta_data?.department ||
                          user?.raw_user_meta_data?.dpt ||
                          user?.user_metadata?.department ||
                          user?.user_metadata?.dpt;
          return userDept === hrDepartment;
        });
      }

      // Count roles within the office
      let hr = 0;
      let officers = 0;
      let admins = 0;

      officeUsers.forEach(user => {
        const role = String(user.role || '').toLowerCase();
        const normalizedRole = String(user.normalizedRole || role).toLowerCase();

        // Count HR
        if (role === 'lgu-hr' || normalizedRole === 'lgu-hr' || /^lgu-hr/.test(role)) {
          hr++;
        }
        // Count admins (LGU admins only)
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
          hr,
          officers,
          admins
        },
        department: hrDepartment || 'All'
      };
    } catch (error) {
      console.error('[HR] Get role distribution error:', error);
      throw error;
    }
  }
  /**
  * Get role change history for a user
  */
  async getUserRoleHistory(userId, hrId) {
    try {
      const Database = require('../config/database');

      const db = Database.getInstance();
      const supabase = db.getClient();
      const { data, error } = await supabase
        .from('role_changes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return {
        success: true,
        history: data || []
      };
    } catch (error) {
      console.error('[HR] Get role history error:', error);
      throw error;
    }
  }
  /**
  * Generate signup link for specific role and department
  */
  async generateSignupLink(hrId, role, departmentCode, expiresInHours = 1) {
    try {
      // Validate HR role and get user metadata
      const hrRole = await this.roleService.getUserRole(hrId);
      const isHR = hrRole === 'lgu-hr' || hrRole === 'super-admin' || /^lgu-hr/.test(hrRole);
      const isCoordinator = hrRole === 'complaint-coordinator';
      if (!isHR && !isCoordinator) {
        throw new Error('Only HR or coordinators can generate signup links');
      }
      // Get HR user metadata to check department
      const { data: hrUser, error: hrUserError } = await this.roleService.supabase.auth.admin.getUserById(hrId);
      if (hrUserError || !hrUser?.user) {
        throw new Error('Failed to get HR user information');
      }
      // With simplified roles, department is stored separately in metadata
      let hrDepartment = null;
      if (hrRole === 'lgu-hr') {
        // Fallback to metadata if role is just 'lgu-hr'
        const hrMetadata = hrUser.user.raw_user_meta_data || hrUser.user.user_metadata || {};
        hrDepartment = hrMetadata.department;
      }
      // Role-based restrictions
      if (isHR && !isCoordinator) {
      // LGU-HR can only create links for their own department
        if (hrDepartment && hrDepartment !== departmentCode) {
          throw new Error(`You can only create signup links for your own department (${hrDepartment})`);
        }
        // For LGU-HR, automatically use their department if not specified
        if (isHR && !departmentCode && hrDepartment) {
          departmentCode = hrDepartment;
          // console.log removed for security
        }
        // console.log removed for security
        // LGU-HR can only create officer or admin roles
        if (!['lgu-officer', 'lgu-admin'].includes(role)) {
          throw new Error('You can only create signup links for officer or admin roles');
        }
      }
      // Validate role
      const validRoles = ['lgu-officer', 'lgu-admin', 'lgu-hr'];
      if (!validRoles.includes(role)) {
        throw new Error('Invalid role specified');
      }
      // Validate department code if provided
      if (departmentCode) {
        const isValidDept = await isValidDepartmentCode(departmentCode);
        if (!isValidDept) {
          throw new Error(`Invalid department code: ${departmentCode}. Must be one of the active departments.`);
        }
      }
      const Database = require('../config/database');

      const db = Database.getInstance();
      const supabase = db.getClient();
      // Get HR user info for metadata
      const { data: hrUserData, error: hrError } = await supabase.auth.admin.getUserById(hrId);
      if (hrError || !hrUserData) {
        throw new Error('HR user not found');
      }
      // Generate unique code
      const code = this.generateUniqueCode();
      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
      // Get department name if provided
      let departmentName = null;
      if (departmentCode) {
        const { data: dept } = await supabase
          .from('departments')
          .select('name')
          .eq('code', departmentCode)
          .single();
        departmentName = dept?.name || departmentCode;
      }
      // Create signup link record
      // console.log removed for security
      const { data: linkData, error: linkError } = await supabase
        .from('signup_links')
        .insert({
          code,
          role,
          department_code: departmentCode,
          created_by: hrId,
          expires_at: expiresAt.toISOString(),
          metadata: {
            created_by_name: hrUserData.user_metadata?.name || hrUserData.email,
            department_name: departmentName
          }
        })
        .select()
        .single();
      if (linkError) {
        throw new Error('Failed to create signup link');
      }
      // Generate the full signup URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const signupUrl = `${baseUrl}/signup-with-code?code=${code}`;
      return {
        success: true,
        data: {
          id: linkData.id,
          code: linkData.code,
          url: signupUrl,
          role: linkData.role,
          department_code: linkData.department_code,
          department_name: departmentName,
          expires_at: linkData.expires_at,
          created_at: linkData.created_at
        }
      };
    } catch (error) {
      console.error('[HR] Generate signup link error:', error);
      throw error;
    }
  }
  /**
  * Get all signup links created by HR
  */
  async getSignupLinks(hrId, filters = {}) {
    try {
      // Validate HR role
      const hrRole = await this.roleService.getUserRole(hrId);
      const isHR = hrRole === 'lgu-hr' || hrRole === 'super-admin' || /^lgu-hr/.test(hrRole);
      if (!isHR) {
        throw new Error('Only HR can view signup links');
      }

      // Get HR user metadata to check department
      const { data: hrUser, error: hrUserError } = await this.roleService.supabase.auth.admin.getUserById(hrId);
      if (hrUserError || !hrUser?.user) {
        console.error('[HR] Failed to get HR user info:', hrUserError);
        throw new Error('Failed to get HR user information');
      }

      // Get HR department from metadata
      const hrMetadata = hrUser.user.raw_user_meta_data || hrUser.user.user_metadata || {};
      const hrDepartment = hrMetadata.department || hrMetadata.dpt;

      const Database = require('../config/database');
      const db = Database.getInstance();
      const supabase = db.getClient();

      // Build query
      // - Super Admin: see ALL links
      // - HR: only links they created (optionally same-office filter applied below)
      let query = supabase
        .from('signup_links')
        .select('*');
      if (hrRole !== 'super-admin') {
        query = query.eq('created_by', hrId);
      }

      // HR may optionally be restricted to their office; if so, apply department filter by default
      if (hrRole !== 'super-admin' && hrDepartment) {
        query = query.eq('department_code', hrDepartment);
      }

      query = query.order('created_at', { ascending: false });

      // Apply additional filters
      if (filters.role) {
        query = query.eq('role', filters.role);
      }
      if (filters.department_code) {
        query = query.eq('department_code', filters.department_code);
      }
      if (filters.is_active !== void 0) {
        query = query.eq('is_active', filters.is_active);
      }

      const { data: links, error } = await query;
      if (error) {
        console.error('[HR] Database query error:', error);
        console.error('[HR] Query details - hrId:', hrId, 'hrId type:', typeof hrId, 'hrRole:', hrRole);
        throw new Error('Failed to fetch signup links');
      }

      // console.log removed for security
      // Add full URLs and status to each link
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const linksWithUrls = links.map(link => ({
        ...link,
        url: `${baseUrl}/signup-with-code?code=${link.code}`,
        is_expired: link.expires_at ? new Date(link.expires_at) < new Date() : false,
        is_used: Boolean(link.used_at)
      }));
      return {
        success: true,
        data: linksWithUrls
      };
    } catch (error) {
      console.error('[HR] Get signup links error:', error);
      throw error;
    }
  }
  /**
  * Deactivate a signup link
  */
  async deactivateSignupLink(hrId, linkId) {
    try {
      // console.log removed for security
      // Validate HR role
      const hrRole = await this.roleService.getUserRole(hrId);
      const isHR = hrRole === 'lgu-hr' || hrRole === 'super-admin' || /^lgu-hr/.test(hrRole);
      if (!isHR) {
        throw new Error('Only HR can deactivate signup links');
      }
      const Database = require('../config/database');

      const db = Database.getInstance();
      const supabase = db.getClient();
      // console.log removed for security
      const { data, error } = await supabase
        .from('signup_links')
        .update({ is_active: false })
        .eq('id', linkId)
        .eq('created_by', hrId)
        .select();
      // console.log removed for security
      if (error) {
        throw new Error('Failed to deactivate signup link');
      }
      if (!data || data.length === 0) {
        throw new Error('Link not found or you do not have permission to deactivate it');
      }
      return { success: true };
    } catch (error) {
      console.error('[HR-SERVICE] Deactivate signup link error:', error);
      throw error;
    }
  }
  /**
  * Validate signup code (public method)
  */
  async validateSignupCode(code) {
    try {
      const Database = require('../config/database');

      // Use static method to ensure proper initialization
      let supabase;
      try {
        supabase = Database.getClient();
      } catch (dbError) {
        console.error('[HR] Database initialization error:', dbError.message);
        return { valid: false, error: 'Database configuration error. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.' };
      }

      // Verify database connection is working
      if (!supabase) {
        console.error('[HR] Database client not available');
        return { valid: false, error: 'Database configuration error. Please contact support.' };
      }

      const { data: link, error } = await supabase
        .from('signup_links')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[HR] Database query error:', error.message, error.code, error.details);
        // Check for authentication errors
        if (error.code === 'PGRST116' || error.message?.includes('JWT') || error.message?.includes('authentication') || error.message?.includes('permission denied')) {
          console.error('[HR] Authentication error - check SUPABASE_SERVICE_ROLE_KEY is correct');
          return { valid: false, error: 'Database authentication error. Please contact support.' };
        }
        // Check for missing table errors
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.error('[HR] Table not found - check database schema');
          return { valid: false, error: 'Database configuration error. Please contact support.' };
        }
        // Check for RLS policy errors
        if (error.message?.includes('RLS') || error.message?.includes('policy')) {
          console.error('[HR] RLS policy error - service role key should bypass RLS');
          return { valid: false, error: 'Database permission error. Please contact support.' };
        }
        return { valid: false, error: 'Invalid or expired signup code' };
      }

      if (!link) {
        return { valid: false, error: 'Invalid or expired signup code' };
      }

      // Check if expired
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return { valid: false, error: 'Signup code has expired' };
      }
      // Check if already used
      if (link.used_at) {
        return { valid: false, error: 'Signup code has already been used' };
      }
      return {
        valid: true,
        data: {
          role: link.role,
          department_code: link.department_code,
          expires_at: link.expires_at
        }
      };
    } catch (error) {
      console.error('[HR] Validate signup code error:', error.message, error.stack);
      // Check for authentication/configuration errors
      if (error.message?.includes('not configured') || error.message?.includes('SUPABASE')) {
        return { valid: false, error: 'Database configuration error. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are set.' };
      }
      return { valid: false, error: 'Failed to validate signup code' };
    }
  }
  /**
  * Mark signup code as used
  */
  async markSignupCodeUsed(code, userId) {
    try {
      const Database = require('../config/database');

      const db = Database.getInstance();
      const supabase = db.getClient();
      const { error } = await supabase
        .from('signup_links')
        .update({
          used_at: new Date().toISOString(),
          used_by: userId,
          is_active: false
        })
        .eq('code', code);
      if (error) {
        throw new Error('Failed to mark signup code as used');
      }
      return { success: true };
    } catch (error) {
      console.error('[HR] Mark signup code used error:', error);
      throw error;
    }
  }
  /**
  * Generate unique code for signup link
  */
  generateUniqueCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(require('crypto').randomInt(0, chars.length));
    }
    return result;
  }
}

module.exports = HRService;
