const Database = require('../config/database');
const { supabase } = new Database();
const { ValidationError, ConflictError } = require('../middleware/errorHandler');

class UserService {
  /**
   * Create a new user (handles both auth.users and users table)
   */
  async createUser(userData) {
    const {
      email,
      password,
      firstName,
      lastName,
      mobileNumber,
      role = 'citizen',
      department = null,
      employeeId = null,
      address = {}
    } = userData;

    // Validate required fields
    this.validateUserData(userData);

    try {
      // Step 1: Create auth user (Supabase Auth)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false, // Require email confirmation
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role: role
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new ConflictError('Email already registered');
        }
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      const authUserId = authData.user.id;

      // Step 2: Create business user record
      const userRecord = {
        id: authUserId, // Same ID as auth.users
        email: email.toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile_number: mobileNumber || null,
        role: role,
        status: 'pending_verification',
        department: department,
        employee_id: employeeId,
        
        // Address fields
        address_line_1: address.line1 || null,
        address_line_2: address.line2 || null,
        city: address.city || null,
        province: address.province || null,
        postal_code: address.postalCode || null,
        barangay: address.barangay || null,
        
        // Verification status
        email_verified: false,
        mobile_verified: false,
        id_verified: false
      };

      const { data: user, error: userError } = await supabase
        .from('users')
        .insert(userRecord)
        .select()
        .single();

      if (userError) {
        // Rollback: Delete auth user if business user creation fails
        await supabase.auth.admin.deleteUser(authUserId);
        throw new Error(`User creation failed: ${userError.message}`);
      }

      // Step 3: Send verification email
      const { error: emailError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: email
      });

      if (emailError) {
        console.warn('Email verification sending failed:', emailError.message);
        // Don't fail the whole process for email issues
      }

      // Step 4: Log initial role assignment
      if (role !== 'citizen') {
        await this.logRoleChange(authUserId, null, role, authUserId, 'Initial assignment during signup');
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        status: user.status,
        emailVerified: user.email_verified,
        createdAt: user.created_at
      };

    } catch (error) {
      console.error('User creation error:', error);
      throw error;
    }
  }

  /**
   * Get user by ID (combines auth and business data)
   */
  async getUserById(userId) {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        supervisor:supervisor_id(id, full_name, email)
      `)
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // User not found
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return this.formatUserResponse(user);
  }

  /**
   * Update user profile
   */
  async updateUser(userId, updateData, updatedBy = null) {
    // Validate update data
    this.validateUpdateData(updateData);

    const { data: user, error } = await supabase
      .from('users')
      .update({
        ...updateData,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return this.formatUserResponse(user);
  }

  /**
   * Change user role (with audit trail)
   */
  async changeUserRole(userId, newRole, changedBy, reason = null) {
    // Get current user
    const currentUser = await this.getUserById(userId);
    if (!currentUser) {
      throw new ValidationError('User not found');
    }

    const oldRole = currentUser.role;

    // Update role
    const { data: user, error } = await supabase
      .from('users')
      .update({
        role: newRole,
        updated_by: changedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to change role: ${error.message}`);
    }

    // Log role change (trigger will handle this automatically)
    await this.logRoleChange(userId, oldRole, newRole, changedBy, reason);

    return this.formatUserResponse(user);
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
   * Get users with filters and pagination
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
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = pagination;

    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        status,
        department,
        position,
        employee_id,
        last_login_at,
        created_at
      `, { count: 'exact' });

    // Apply filters
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (department) query = query.eq('department', department);
    if (!includeInactive) query = query.neq('status', 'inactive');

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return {
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  /**
   * Sync auth.users with users table (for data consistency)
   */
  async syncAuthUser(authUserId) {
    try {
      // Get auth user data
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId);
      
      if (authError) {
        throw new Error(`Failed to get auth user: ${authError.message}`);
      }

      // Check if user exists in business table
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (!existingUser) {
        // Create business user record from auth data
        const userRecord = {
          id: authUserId,
          email: authUser.user.email,
          first_name: authUser.user.user_metadata?.first_name || 'Unknown',
          last_name: authUser.user.user_metadata?.last_name || 'User',
          role: authUser.user.user_metadata?.role || 'citizen',
          email_verified: !!authUser.user.email_confirmed_at,
          status: 'active'
        };

        const { error: insertError } = await supabase
          .from('users')
          .insert(userRecord);

        if (insertError) {
          console.error('Failed to sync auth user:', insertError);
        }
      }
    } catch (error) {
      console.error('Auth user sync error:', error);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  validateUserData(userData) {
    const { email, password, firstName, lastName } = userData;

    if (!email || !email.includes('@')) {
      throw new ValidationError('Valid email is required');
    }

    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    if (!firstName || firstName.trim().length < 2) {
      throw new ValidationError('First name must be at least 2 characters');
    }

    if (!lastName || lastName.trim().length < 2) {
      throw new ValidationError('Last name must be at least 2 characters');
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

  formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: user.full_name,
      mobileNumber: user.mobile_number,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      
      address: {
        line1: user.address_line_1,
        line2: user.address_line_2,
        city: user.city,
        province: user.province,
        postalCode: user.postal_code,
        barangay: user.barangay
      },
      
      role: user.role,
      status: user.status,
      department: user.department,
      position: user.position,
      employeeId: user.employee_id,
      supervisorId: user.supervisor_id,
      
      verification: {
        email: user.email_verified,
        mobile: user.mobile_verified,
        id: user.id_verified
      },
      
      preferences: {
        language: user.preferred_language,
        timezone: user.timezone,
        notifications: {
          email: user.email_notifications,
          sms: user.sms_notifications,
          push: user.push_notifications
        }
      },
      
      profile: {
        avatarUrl: user.avatar_url,
        bio: user.bio
      },
      
      timestamps: {
        lastLogin: user.last_login_at,
        created: user.created_at,
        updated: user.updated_at
      }
    };
  }
}

module.exports = new UserService();

