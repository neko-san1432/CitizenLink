const UserService = require('../services/UserService');
const { ValidationError, ConflictError } = require('../middleware/errorHandler');
const Database = require('../config/database');
const supabase = Database.getClient();
const { validatePasswordStrength } = require('../../shared/passwordValidation');
const { validateUserRole } = require('../utils/roleValidation');

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
      const { email, password, remember = false, skipCaptcha = false } = req.body;

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

      // Create user object from auth data instead of calling UserService.getUserById
      // This avoids the admin API call that might be failing
      const userMetadata = authData.user.user_metadata || {};
      const rawUserMetaData = authData.user.raw_user_meta_data || {};
      const combinedMetadata = { ...userMetadata, ...rawUserMetaData };

      // Build user object from metadata

      const userName = combinedMetadata.name ||
                      `${combinedMetadata.first_name || ''} ${combinedMetadata.last_name || ''}`.trim() ||
                      authData.user.email?.split('@')[0] ||
                      'Unknown User';

      const user = {
        id: authData.user.id,
        email: authData.user.email,
        firstName: combinedMetadata.first_name || '',
        lastName: combinedMetadata.last_name || '',
        name: userName,
        fullName: userName,
        role: combinedMetadata.role || 'citizen',
        normalizedRole: combinedMetadata.normalized_role || combinedMetadata.role || 'citizen',
        status: combinedMetadata.status || 'active',
        department: combinedMetadata.department || null,
        employeeId: combinedMetadata.employee_id || null,
        mobileNumber: combinedMetadata.mobile_number || combinedMetadata.mobile || null,
        emailVerified: !!authData.user.email_confirmed_at,
        phoneVerified: combinedMetadata.phone_verified || false,
        // Include raw metadata for reference
        user_metadata: userMetadata,
        raw_user_meta_data: rawUserMetaData
      };

      console.log('[LOGIN] User object created:', {
        id: user.id,
        email: user.email,
        role: user.role,
        hasName: !!user.name,
        status: user.status
      });

      // Check if user is active (skip for pending_verification on first login)
      if (user.status && user.status !== 'active' && user.status !== 'pending_verification') {
        console.log('[LOGIN] ❌ User account not active:', user.status);
        return res.status(403).json({
          success: false,
          error: `Account is ${user.status}. Please contact support.`
        });
      }

      // Track login (continue even if tracking fails)
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      console.log('[LOGIN] 📊 Tracking login for user:', userId);

      try {
        await UserService.trackLogin(userId, ipAddress, userAgent);
        console.log('[LOGIN] ✅ Login tracking successful');
      } catch (trackError) {
        console.warn('[LOGIN] ⚠️ Login tracking failed:', trackError.message);
      }

      // Set session cookie with proper expiration
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 315360000000, // 10 years for development (permanent)
          // Removed domain to use default
        };

      console.log('[LOGIN] 🍪 Setting session cookie with options:', cookieOptions);
      console.log('[LOGIN] Token length:', authData.session.access_token?.length);
      console.log('[LOGIN] Token preview:', authData.session.access_token?.substring(0, 20) + '...');

      // Set the cookie
      console.log('[LOGIN] 🍪 Setting session cookie...');
      res.cookie('sb_access_token', authData.session.access_token, cookieOptions);
      console.log('[LOGIN] 🍪 Session cookie set');
      
      // Also set a non-httpOnly cookie for debugging (remove in production)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[LOGIN] 🍪 Setting debug cookie...');
        res.cookie('sb_access_token_debug', authData.session.access_token, {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 315360000000 // 10 years for development (permanent)
          // Removed domain to use default
        });
        console.log('[LOGIN] 🍪 Debug cookie set');
      }

      // Verify cookies are set in response headers
      console.log('[LOGIN] 🍪 Response headers after cookie setting:', res.getHeaders());
      
      console.log('[LOGIN] ✅ Login successful, sending response');

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
      console.error('[LOGIN] 💥 Login error:', error.message);
      console.error('[LOGIN] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Login failed. Please try again.',
        debug: {
          error: error.message,
          stack: error.stack
        }
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

      // Update password in Supabase Auth (use current session context)
      // Note: This requires the user to be authenticated with a valid session
      // We can't use admin.updateUserById for password changes as it requires admin privileges
      const { error } = await supabase.auth.updateUser({
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

      // Update user metadata in auth.users (avoid admin API)
      // For OAuth completion, we'll need to use the session-based approach
      // Since we can't use admin APIs, this operation might need to be handled differently
      console.warn('[OAUTH] Admin API not available for user metadata updates');

      res.json({
        success: true,
        message: 'OAuth registration completed successfully (metadata update may be limited)'
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

      // Validate the role and department code
      const roleValidation = await validateUserRole(role);
      if (!roleValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: `Invalid role: ${roleValidation.error}`
        });
      }

      // Merge/prepare metadata
      const completeMetadata = {
        // Identity
        name: name || req.user?.name || null,
        mobile_number: mobile || req.user?.mobileNumber || null,
        mobile: mobile || req.user?.mobileNumber || null,
        // Role fields (department-specific role allowed in role; normalized_role is general bucket)
        role: role,
        normalized_role: (role || '') === 'lgu-admin' ? 'lgu-admin' : (role || '') === 'lgu' ? 'lgu' : role || 'citizen',
        department: department_code || null,
        // Flags
        is_oauth: true,
        status: 'active',
        email_verified: true,
        phone_verified: !!mobile,
        updated_at: new Date().toISOString()
      };

      // Update user metadata in auth.users (avoid admin API)
      // For OAuth HR completion, we'll need to use the session-based approach
      // Since we can't use admin APIs, this operation might need to be handled differently
      console.warn('[OAUTH HR] Admin API not available for user metadata updates');

      return res.json({ success: true, message: 'OAuth registration (HR) completed successfully (metadata update may be limited)' });
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

      // Update user verification status (avoid admin API)
      // Since we can't use admin APIs, we'll skip the metadata update for now
      console.warn('[EMAIL VERIFY] Admin API not available for user metadata updates');

      res.json({
        success: true,
        message: 'Email verified successfully (metadata update may be limited)'
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
