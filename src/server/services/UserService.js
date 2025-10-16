const Database = require('../config/database');
const db = new Database();
const supabase = db.getClient();
const { ValidationError, ConflictError } = require('../middleware/errorHandler');

class UserService {
  // Map arbitrary role strings to allowed DB values
  normalizeRole(rawRole) {
    if (!rawRole) return 'citizen';
    const role = String(rawRole).toLowerCase();
    if (role.startsWith('lgu-admin')) return 'lgu-admin';
    if (role.startsWith('lgu')) return 'lgu';
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
      lastName,
      name, // Single name field (for OAuth users)
      mobileNumber,
      role = 'citizen',
      department = null,
      employeeId = null,
      address = {},
      isOAuth = false // Flag to indicate if this is OAuth signup
    } = userData;

    // Handle single name field - use name if provided, otherwise combine firstName + lastName
    const displayName = name || `${firstName || ''} ${lastName || ''}`.trim();
    const firstNameFinal = firstName || displayName.split(' ')[0] || '';
    const lastNameFinal = lastName || displayName.split(' ').slice(1).join(' ') || '';

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
          last_name: lastNameFinal,
          name: displayName,
          role: role,
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
          department: department,
          employee_id: employeeId,
          position: null,
          // Verification
          email_verified: false,
          mobile_verified: false,
          // Preferences
          preferred_language: 'en',
          timezone: 'Asia/Manila',
          email_notifications: true,
          sms_notifications: false,
          push_notifications: true,
          // Timestamps
          updated_at: new Date().toISOString()
        },
        raw_user_meta_data: {
          // Server-side metadata
          first_name: firstNameFinal,
          last_name: lastNameFinal,
          name: displayName,
          role: role,
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
          department: department,
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
          // Banning system
          banStrike: 0,
          banStarted: null,
          banDuration: null,
          permanentBan: false,
          // Timestamps
          updated_at: new Date().toISOString(),
          // OAuth providers
          oauth_providers: isOAuth ? [] : ['email']
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new ConflictError('Email already registered');
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
          emailRedirectTo: `${frontendUrl}/login`
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
        console.error('[AUTH] Failed to fetch user:', error);
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
      const updatedMetadata = {
        ...(currentUser.raw_user_meta_data || {}),
        ...updateData,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      };

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
    // Get current user
    const currentUser = await this.getUserById(userId);
    if (!currentUser) {
      throw new ValidationError('User not found');
    }

    const oldRole = currentUser.role;
    const normalizedRole = this.normalizeRole(newRole);

    // Update role in metadata
    const updatedUser = await this.updateUser(userId, {
      role: newRole,
      normalized_role: normalizedRole
    }, changedBy);

    // Log role change
    await this.logRoleChange(userId, oldRole, newRole, changedBy, reason);

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
      // Fetch all auth users (admin API doesn't support complex filtering)
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: limit
      });

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      let users = data.users.map(user => this.formatUserResponse(user));

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
      'first_name', 'last_name', 'mobile_number', 'date_of_birth', 'gender',
      'address_line_1', 'address_line_2', 'city', 'province', 'postal_code', 'barangay',
      'position', 'bio', 'avatar_url', 'preferred_language', 'timezone',
      'email_notifications', 'sms_notifications', 'push_notifications'
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
          reason: reason
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

    // Use name as primary, generate from first_name + last_name as fallback
    const displayName = combined.name || `${combined.first_name || 'Unknown'} ${combined.last_name || 'User'}`.trim();

    return {
      id: authUser.id,
      email: authUser.email,
      firstName: combined.first_name,
      lastName: combined.last_name,
      name: displayName,
      fullName: displayName, // Keep for backwards compatibility
      mobileNumber: combined.mobile_number,
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
        email: !!authUser.email_confirmed_at,
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

