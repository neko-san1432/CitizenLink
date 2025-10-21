const UserService = require('../services/UserService');
const { ValidationError, ConflictError } = require('../middleware/errorHandler');
const Database = require('../config/database');
const db = new Database();
const supabase = db.getClient();
const { validatePasswordStrength } = require('../../shared/passwordValidation');

class AuthController {
  /**
   * Register a new user
   */
  async signup(req, res) {
    try {
      const {
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        name, // Single name field
        mobileNumber,
        role = 'citizen',
        department,
        employeeId,
        address = {},
        agreedToTerms,
        isOAuth = false
      } = req.body;

      // Validation
      if (!agreedToTerms) {
        return res.status(400).json({
          success: false,
          error: 'You must agree to the terms and conditions'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'Passwords do not match'
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors
        });
      }

      // Validate role-specific requirements
      if (['lgu', 'lgu-admin'].includes(role)) {
        if (!department) {
          return res.status(400).json({
            success: false,
            error: 'Department is required for LGU staff'
          });
        }
        if (!employeeId) {
          return res.status(400).json({
            success: false,
            error: 'Employee ID is required for LGU staff'
          });
        }
      }

      // Create user
      const user = await UserService.createUser({
        email,
        password,
        firstName,
        lastName,
        name, // Pass single name field
        mobileNumber,
        role,
        department,
        employeeId,
        address,
        isOAuth
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'Account created successfully! Please check your email to verify your account.'
      });

    } catch (error) {
      console.error('Signup error:', error);

      if (error instanceof ValidationError || error instanceof ConflictError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create account. Please try again.'
      });
    }
  }

  /**
   * Login user (enhanced with tracking)
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Supabase Auth login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      const userId = authData.user.id;

      // Get user data from auth metadata
      const user = await UserService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
      }

      // Check if user is active (skip for pending_verification on first login)
      if (user.status && user.status !== 'active' && user.status !== 'pending_verification') {
        return res.status(403).json({
          success: false,
          error: `Account is ${user.status}. Please contact support.`
        });
      }

      // Track login
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      await UserService.trackLogin(userId, ipAddress, userAgent);

      // Set session cookie with proper expiration
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      };
      
      res.cookie('sb_access_token', authData.session.access_token, cookieOptions);

      res.json({
        success: true,
        data: {
          user: user,
          session: {
            accessToken: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            expiresAt: authData.session.expires_at
          }
        },
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed. Please try again.'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await UserService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
      }

      res.json({
        success: true,
        data: user
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile'
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updateData.id;
      delete updateData.email;
      delete updateData.role;
      delete updateData.status;
      delete updateData.email_verified;

      const user = await UserService.updateUser(userId, updateData, userId);

      res.json({
        success: true,
        data: user,
        message: 'Profile updated successfully'
      });

    } catch (error) {
      console.error('Update profile error:', error);

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  /**
   * Change user password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
          success: false,
          error: 'All password fields are required'
        });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          error: 'New passwords do not match'
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors
        });
      }

      // Update password in Supabase Auth
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Failed to change password'
        });
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }

  /**
   * Logout user
   */
  async logout(req, res) {
    try {
      // Clear session cookie
      res.clearCookie('sb_access_token');

      // End user session in database
      const userId = req.user?.id;
      if (userId) {
        // Mark current session as ended
        await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            ended_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('is_active', true);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  /**
   * Complete OAuth registration
   */
  async completeOAuth(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const { name, mobile } = req.body;

      if (!name || !mobile) {
        return res.status(400).json({
          success: false,
          error: 'Name and mobile number are required'
        });
      }

      // Validate mobile format
      if (!/^[0-9]{10}$/.test(mobile)) {
        return res.status(400).json({
          success: false,
          error: 'Mobile number must be 10 digits'
        });
      }

      const firstName = name.split(' ')[0] || '';
      const lastName = name.split(' ').slice(1).join(' ') || '';
      const mobileNumber = `+63${mobile}`;

      // Update user metadata in auth.users
      const completeMetadata = {
        // Identity
        first_name: firstName,
        last_name: lastName,
        name: name,

        // Contact
        mobile_number: mobileNumber,
        mobile: mobileNumber,

        // Role & Status
        role: 'citizen',
        normalized_role: 'citizen',
        status: 'active',

        // LGU Staff (null for citizens)
        department: null,
        employee_id: null,
        position: null,

        // Address (optional, null for now)
        address_line_1: null,
        address_line_2: null,
        city: null,
        province: null,
        postal_code: null,
        barangay: null,

        // Verification
        email_verified: true,
        phone_verified: false,

        // Preferences
        preferred_language: 'en',
        timezone: 'Asia/Manila',
        email_notifications: true,
        sms_notifications: false,
        push_notifications: true,

        // Security
        banStrike: 0,
        banStarted: null,
        banDuration: null,
        permanentBan: false,

        // Metadata
        is_oauth: true,
        oauth_providers: ['google', 'facebook'], // Will be set based on provider
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: completeMetadata,
        raw_user_meta_data: completeMetadata
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Failed to complete registration'
        });
      }

      res.json({
        success: true,
        message: 'OAuth registration completed successfully'
      });

    } catch (error) {
      console.error('Complete OAuth error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete OAuth registration'
      });
    }
  }

  /**
   * Signup with HR link code
   */
  async signupWithCode(req, res) {
    try {
      const {
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        name,
        mobileNumber,
        signupCode,
        address = {},
        agreedToTerms,
        isOAuth = false
      } = req.body;

      // Validate signup code first
      const HRService = require('../services/HRService');
      const hrService = new HRService();
      const codeValidation = await hrService.validateSignupCode(signupCode);

      if (!codeValidation.valid) {
        return res.status(400).json({
          success: false,
          error: codeValidation.error
        });
      }

      const { role, department_code } = codeValidation.data;

      // Validation
      if (!agreedToTerms) {
        return res.status(400).json({
          success: false,
          error: 'You must agree to the terms and conditions'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'Passwords do not match'
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors
        });
      }

      // Create user with the role from the signup code
      const user = await UserService.createUser({
        email,
        password,
        firstName,
        lastName,
        name,
        mobileNumber,
        role, // Use role from signup code
        department: department_code, // Use department from signup code
        employeeId: null, // Will be filled later by HR
        address,
        isOAuth
      });

      // Mark signup code as used
      await hrService.markSignupCodeUsed(signupCode, user.id);

      res.status(201).json({
        success: true,
        data: user,
        message: 'Account created successfully! Please check your email to verify your account.'
      });

    } catch (error) {
      console.error('Signup with code error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Registration failed'
      });
    }
  }

  /**
   * Complete OAuth registration with HR signup code
   * - Validates signup code
   * - Updates auth.users metadata (role, normalized_role, department, mobile, name)
   * - Marks code as used
   */
  async completeOAuthHR(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const { name, mobile, signupCode } = req.body || {};
      if (!signupCode) {
        return res.status(400).json({ success: false, error: 'Signup code is required' });
      }

      // Validate signup code and extract intended role/department
      const HRService = require('../services/HRService');
      const hrService = new HRService();
      const codeValidation = await hrService.validateSignupCode(signupCode);
      if (!codeValidation.valid) {
        return res.status(400).json({ success: false, error: codeValidation.error || 'Invalid signup code' });
      }

      const { role, department_code } = codeValidation.data;

      // Merge/prepare metadata
      const completeMetadata = {
        // Identity
        name: name || req.user?.name || null,
        mobile_number: mobile || req.user?.mobileNumber || null,
        mobile: mobile || req.user?.mobileNumber || null,
        // Role fields (department-specific role allowed in role; normalized_role is general bucket)
        role: role,
        normalized_role: (role || '').startsWith('lgu-admin') ? 'lgu-admin' : (role || '').startsWith('lgu') ? 'lgu' : role || 'citizen',
        department: department_code || null,
        // Flags
        is_oauth: true,
        status: 'active',
        email_verified: true,
        phone_verified: !!mobile,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: completeMetadata,
        raw_user_meta_data: completeMetadata
      });

      if (updateError) {
        return res.status(400).json({ success: false, error: 'Failed to update user profile' });
      }

      // Mark signup code as used by this user
      await hrService.markSignupCodeUsed(signupCode, userId);

      return res.json({ success: true, message: 'OAuth registration (HR) completed successfully' });
    } catch (error) {
      console.error('Complete OAuth HR error:', error);
      return res.status(500).json({ success: false, error: 'Failed to complete OAuth registration' });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Verification token is required'
        });
      }

      // Verify with Supabase
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'signup'
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification token'
        });
      }

      // Update user verification status
      const userId = data.user.id;
      await UserService.updateUser(userId, {
        email_verified: true,
        status: 'active'
      });

      res.json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Email verification failed'
      });
    }
  }
}

module.exports = new AuthController();
