const Database = require('../config/database');

const supabase = Database.getClient();
const { ValidationError, ConflictError } = require('../middleware/errorHandler');

class UserService {
  constructor() {
  }
  // Map arbitrary role strings to allowed DB values
  normalizeRole(rawRole) {
    if (!rawRole) return 'citizen';
    const role = String(rawRole).toLowerCase();
    if (role === 'lgu-admin') return 'lgu-admin';
    if (role === 'lgu') return 'lgu';
    if (role === 'super-admin' || role === 'superadmin') return 'super-admin';
    if (role === 'citizen') return 'citizen';
    return 'citizen';
  }
  /**
  * Create a new user (stores everything in auth.users metadata)
  */
  async createUser(userData) {
    const {
      email,
      password,
      firstName,
      middleName,
      lastName,
      name, // Single name field (for OAuth users)
      mobileNumber,
      gender,
      role = 'citizen',
      department = null,
      employeeId = null,
      address = {},
      isOAuth = false // Flag to indicate if this is OAuth signup
    } = userData;
    // Handle single name field - use name if provided, otherwise combine firstName + lastName
    const displayName = name || [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
    const nameParts = displayName ? displayName.split(' ') : [];
    const firstNameFinal = firstName || nameParts[0] || '';
    const middleNameFinal = middleName || nameParts.slice(1, -1).join(' ') || '';
    const lastNameFinal = lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
    // Validate required fields
    this.validateUserData(userData, isOAuth);
    const normalizedRole = this.normalizeRole(role);
    try {
      // Create auth user with all metadata (no separate users table)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false, // Require email confirmation
        user_metadata: {
          // Public metadata (visible to user)
          first_name: firstNameFinal,
          middle_name: middleNameFinal || null,
          last_name: lastNameFinal,
          name: displayName,
          role,
          normalized_role: normalizedRole,
          mobile_number: mobileNumber || null,
          is_oauth: isOAuth,
          status: 'pending_verification',
          // Address
          address_line_1: address.line1 || null,
          address_line_2: address.line2 || null,
          city: address.city || null,
          province: address.province || null,
          postal_code: address.postalCode || null,
          barangay: address.barangay || null,
          // LGU staff fields
          department,
          employee_id: employeeId,
          position: null,
          // Verification
          email_verified: false,
          mobile_verified: false,
          gender: gender || null,
          // Preferences
          preferred_language: 'en',
          timezone: 'Asia/Manila',
          email_notifications: true,
          sms_notifications: false,
          push_notifications: true,
          // Banning system
          isBanned: false,
          warningStrike: 0,
          // Timestamps
          updated_at: new Date().toISOString()
        },
        raw_user_meta_data: {
          // Server-side metadata
          first_name: firstNameFinal,
          middle_name: middleNameFinal || null,
          last_name: lastNameFinal,
          name: displayName,
          role,
          normalized_role: normalizedRole,
          mobile_number: mobileNumber || null,
          mobile: mobileNumber || null, // Also store as 'mobile' for compatibility
          is_oauth: isOAuth,
          status: 'pending_verification',
          // Address
          address_line_1: address.line1 || null,
          address_line_2: address.line2 || null,
          city: address.city || null,
          province: address.province || null,
          postal_code: address.postalCode || null,
          barangay: address.barangay || null,
          // LGU staff fields
          department,
          employee_id: employeeId,
          position: null,
          // Verification
          email_verified: false,
          phone_verified: false,
          // Preferences
          preferred_language: 'en',
          timezone: 'Asia/Manila',
          email_notifications: true,
          sms_notifications: false,
          push_notifications: true,
          gender: gender || null,
          // Banning system
          isBanned: false,
          warningStrike: 0,
          // Timestamps
          updated_at: new Date().toISOString(),
          // OAuth providers
          oauth_providers: isOAuth ? [] : ['email']
        }
      });
      if (authError) {
        const msg = String(authError.message || '').toLowerCase();
        const code = String(authError.code || '').toLowerCase();
        // Normalize duplicate email errors from Supabase/PostgREST
        const isDuplicateEmail = (
          code === 'user_already_exists' ||
          code === 'email_exists' ||
          code === '23505' || // unique_violation
          /already\s*(registered|exists)/i.test(msg) ||
          /duplicate/i.test(msg) ||
          /unique/i.test(msg) ||
          /email.*(in use|used|taken)/i.test(msg)
        );
        if (isDuplicateEmail) {
          throw new ConflictError('Email already exist');
        }
        throw new Error(`Auth creation failed: ${authError.message}`);
      }
      const authUserId = authData.user.id;
      // Send verification email (server-side) using resend API
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const { error: emailError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${frontendUrl}/email-verification-success`
        }
      });
      if (emailError) {
        console.warn('Email verification sending failed:', emailError.message);
      }



      return {
        id: authUserId,
        email: authData.user.email,
        name: displayName,
        fullName: displayName,
        role: normalizedRole,
        status: 'pending_verification',
        emailVerified: false,
        createdAt: authData.user.created_at
      };
    } catch (error) {
      console.error('User creation error:', error);
      throw error;
    }
  }
  /**
  * Get user by ID (from auth.users metadata only)
  */
  async getUserById(userId) {
    try {
      const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);
      if (error) {
        console.error('[AUTH] Failed to fetch user via admin API:', error);
        return null;
      }
      if (!authUser || !authUser.user) {
        return null;
      }
      return this.formatUserResponse(authUser.user);
    } catch (error) {
      console.error('[AUTH] Get user error:', error);
      return null;
    }
  }
  /**
  * Update user profile (updates auth.users metadata)
  */
  async updateUser(userId, updateData, updatedBy = null) {
    // Validate update data
    this.validateUpdateData(updateData);
    try {
      // Get current user to merge metadata
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }
      // Merge with existing metadata
      // IMPORTANT: Normalize roles using general normalization function
      const { normalizeRole } = require('../utils/roleValidation');
      const normalizedUpdateData = { ...updateData };

      // Normalize role fields if present
      if (normalizedUpdateData.role) {
        const originalRole = normalizedUpdateData.role;
        normalizedUpdateData.role = normalizeRole(normalizedUpdateData.role);
        if (originalRole !== normalizedUpdateData.role) {
          console.log('[UserService] Normalizing role from', originalRole, 'to', normalizedUpdateData.role, 'in updateData');
        }
      }
      if (normalizedUpdateData.normalized_role) {
        normalizedUpdateData.normalized_role = normalizeRole(normalizedUpdateData.normalized_role);
      }
      if (normalizedUpdateData.base_role) {
        normalizedUpdateData.base_role = normalizeRole(normalizedUpdateData.base_role);
      }

      const updatedMetadata = {
        ...(currentUser.raw_user_meta_data || {}),
        ...normalizedUpdateData,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      };

      // Final safety check: ensure we never save unnormalized roles in metadata
      if (updatedMetadata.role) {
        updatedMetadata.role = normalizeRole(updatedMetadata.role);
      }
      if (updatedMetadata.normalized_role) {
        updatedMetadata.normalized_role = normalizeRole(updatedMetadata.normalized_role);
      }
      if (updatedMetadata.base_role) {
        updatedMetadata.base_role = normalizeRole(updatedMetadata.base_role);
      }
      // Update auth user metadata
      const { data: authData, error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: updatedMetadata,
        raw_user_meta_data: updatedMetadata
      });
      if (error) {
        throw new Error(`Failed to update user: ${error.message}`);
      }



      return this.formatUserResponse(authData.user);
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }
  /**
  * Change user role (updates metadata and logs)
  */
  async changeUserRole(userId, newRole, changedBy, reason = null) {
    // Validate role parameter to prevent injection
    const validRoles = [
      'citizen', 'lgu', 'lgu-admin', 'lgu-hr', 'complaint-coordinator',
      'super-admin', 'lgu-admin-health', 'lgu-admin-education',
      'lgu-admin-social', 'lgu-admin-infrastructure', 'lgu-admin-environment',
      'lgu-admin-agriculture', 'lgu-admin-tourism', 'lgu-admin-publicsafety',
      'lgu-admin-economic', 'lgu-admin-legal', 'lgu-hr-health', 'lgu-hr-education'
    ];
    if (!newRole || typeof newRole !== 'string') {
      throw new ValidationError('Role must be a valid string');
    }
    // Normalize and validate role
    const normalizedRole = this.normalizeRole(newRole);
    if (!validRoles.includes(normalizedRole)) {
      throw new ValidationError(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
    }
    // Get current user
    const currentUser = await this.getUserById(userId);
    if (!currentUser) {
      throw new ValidationError('User not found');
    }
    const oldRole = currentUser.role;
    // Update role in metadata
    const updatedUser = await this.updateUser(userId, {
      role: normalizedRole,  // Use normalized role for consistency
      normalized_role: normalizedRole
    }, changedBy);
    // Log role change
    await this.logRoleChange(userId, oldRole, normalizedRole, changedBy, reason);
    return updatedUser;
  }
  /**
  * Track user login
  */
  async trackLogin(userId, ipAddress = null, userAgent = null) {
    try {
      const { error } = await supabase.rpc('update_user_login', {
        p_user_id: userId,
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });
      if (error) {
        console.warn('Login tracking failed:', error.message);
      }
    } catch (error) {
      console.warn('Login tracking error:', error);
    }
  }
  /**
  * Get users with filters and pagination (from auth.users)
  */
  async getUsers(filters = {}, pagination = {}) {
    const {
      role,
      status,
      department,
      search,
      includeInactive = false
    } = filters;
    const {
      page = 1,
      limit = 20
    } = pagination;
    try {
      // Try Admin API first (preferred)
      let users = [];
      try {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: limit
        });
        if (error) throw error;
        users = (data.users || []).map(user => this.formatUserResponse(user));
      } catch (adminErr) {
        // Fallback: direct query to auth.users via PostgREST (requires service role key)
        // Note: This path provides limited columns; we reconstruct response
        try {
          const query = supabase
            .from('auth.users')
            .select('id, email, created_at, user_metadata, raw_user_meta_data')
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);
          const { data: sqlRows, error: sqlError } = await query;
          if (sqlError) throw sqlError;
          users = (sqlRows || []).map(row => this.formatUserResponse({
            id: row.id,
            email: row.email,
            created_at: row.created_at,
            user_metadata: row.user_metadata || {},
            raw_user_meta_data: row.raw_user_meta_data || {}
          }));
        } catch (sqlErr) {
          const msg = adminErr?.message || sqlErr?.message || 'Unknown error';
          throw new Error(`Failed to fetch users: ${msg}`);
        }
      }

      // Apply client-side filters
      if (role) {
        users = users.filter(u => u.role === role || u.normalizedRole === role);
      }
      if (status) {
        users = users.filter(u => u.status === status);
      }
      if (department) {
        users = users.filter(u => u.department === department);
      }
      if (!includeInactive) {
        users = users.filter(u => u.status !== 'inactive');
      }
      if (search) {
        const searchLower = search.toLowerCase();
        users = users.filter(u =>
          u.fullName?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower) ||
          u.employeeId?.toLowerCase().includes(searchLower)
        );
      }
      return {
        users: users || [],
        pagination: {
          page,
          limit,
          total: users.length,
          totalPages: Math.ceil(users.length / limit)
        }
      };
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  }
  /**
  * Sync auth user (no-op now since we only use auth.users)
  */
  async syncAuthUser(authUserId) {
    // No longer needed - all data is in auth.users metadata
    return true;
  }
  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================
  validateUserData(userData, isOAuth = false) {
    const { email, password, firstName, lastName, name, mobileNumber } = userData;
    if (!email || !email.includes('@')) {
      throw new ValidationError('Valid email is required');
    }
    // Password only required for regular signup, not OAuth
    if (!isOAuth && (!password || password.length < 4)) {
      throw new ValidationError('Password must be at least 4 characters');
    }
    // Name validation - handle both single name and firstName/lastName
    const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();
    if (!fullName || fullName.length < 2) {
      throw new ValidationError('Name must be at least 2 characters');
    }
    // Mobile number validation - required for regular signup, optional for OAuth
    if (!isOAuth && (!mobileNumber || mobileNumber.trim().length < 10)) {
      throw new ValidationError('Mobile number is required for registration');
    }
  }
  validateUpdateData(updateData) {
    const allowedFields = [
      'first_name', 'last_name', 'middle_name', 'mobile_number', 'date_of_birth', 'gender',
      'address_line_1', 'address_line_2', 'city', 'province', 'postal_code', 'barangay',
      'position', 'bio', 'avatar_url', 'preferred_language', 'timezone',
      'email_notifications', 'sms_notifications', 'push_notifications',
      // Role-related fields for admin operations
      'role', 'normalized_role', 'base_role',
      // Department fields
      'department', 'dpt',
      // Status field
      'status',
      // Pending approval fields (for signup-with-code workflow)
      'pending_role', 'pending_department', 'pending_signup_code'
    ];
    const invalidFields = Object.keys(updateData).filter(field => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
      throw new ValidationError(`Invalid fields: ${invalidFields.join(', ')}`);
    }
  }
  async logRoleChange(userId, oldRole, newRole, changedBy, reason) {
    try {
      await supabase
        .from('user_role_history')
        .insert({
          user_id: userId,
          old_role: oldRole,
          new_role: newRole,
          changed_by: changedBy,
          reason
        });
    } catch (error) {
      console.warn('Role change logging failed:', error);
    }
  }
  formatUserResponse(authUser) {
    // Extract metadata from auth user
    const meta = authUser.user_metadata || {};
    const rawMeta = authUser.raw_user_meta_data || {};
    const combined = { ...rawMeta, ...meta };
    // Use name as primary, generate from first_name + middle_name + last_name as fallback
    const displayName = combined.name ||
      (combined.first_name || combined.last_name
        ? [combined.first_name, combined.middle_name, combined.last_name].filter(Boolean).join(' ').trim()
        : 'Unknown User');
    return {
      id: authUser.id,
      email: authUser.email,
      firstName: combined.first_name,
      lastName: combined.last_name,
      middleName: combined.middle_name,
      name: displayName,
      fullName: displayName, // Keep for backwards compatibility
      // Mobile number from raw_user_meta_data (priority) or user_metadata
      mobileNumber: rawMeta.mobile_number || meta.mobile_number || combined.mobile_number || null,
      dateOfBirth: combined.date_of_birth,
      gender: combined.gender,
      address: {
        line1: combined.address_line_1,
        line2: combined.address_line_2,
        city: combined.city,
        province: combined.province,
        postalCode: combined.postal_code,
        barangay: combined.barangay
      },
      role: combined.role || 'citizen',
      normalizedRole: combined.normalized_role || this.normalizeRole(combined.role),
      status: combined.status || 'active',
      department: combined.department,
      position: combined.position,
      employeeId: combined.employee_id,
      verification: {
        email: Boolean(authUser.email_confirmed_at),
        mobile: combined.mobile_verified || false,
        id: combined.id_verified || false
      },
      preferences: {
        language: combined.preferred_language || 'en',
        timezone: combined.timezone || 'Asia/Manila',
        notifications: {
          email: combined.email_notifications !== false,
          sms: combined.sms_notifications || false,
          push: combined.push_notifications !== false
        }
      },
      profile: {
        avatarUrl: combined.avatar_url,
        bio: combined.bio
      },
      // Banning system
      isBanned: combined.isBanned === true,
      warningStrike: combined.warningStrike || 0,
      banType: combined.banType || null,
      banExpiresAt: combined.banExpiresAt || null,
      banReason: combined.banReason || null,
      // Created at from auth.users.created_at
      created_at: authUser.created_at,
      timestamps: {
        lastLogin: combined.last_login_at,
        created: authUser.created_at,
        updated: combined.updated_at
      },
      // Include raw metadata for reference
      user_metadata: meta,
      raw_user_meta_data: rawMeta
    };
  }
}

module.exports = new UserService();
