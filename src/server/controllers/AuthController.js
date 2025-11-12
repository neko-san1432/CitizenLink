const UserService = require('../services/UserService');
const { ValidationError, ConflictError } = require('../middleware/errorHandler');
const Database = require('../config/database');
const { extractUserMetadata, getCookieOptions, createErrorResponse } = require('../utils/authUtils');
const { validateEmail, validatePasswordMatch, validateAddress, validateRequiredFields } = require('../utils/inputValidation');

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
        gender,
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
      
      // Validate password match
      const passwordMatch = validatePasswordMatch(password, confirmPassword);
      if (!passwordMatch.isValid) {
        return res.status(400).json({
          success: false,
          error: passwordMatch.error
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
      // Regular signups (non-OAuth, without HR code) can only create citizen accounts
      // Staff roles must use HR signup codes via /signup-with-code endpoint
      if (!isOAuth && role !== 'citizen') {
        return res.status(400).json({
          success: false,
          error: 'Only citizen accounts can be created through regular signup. Staff accounts require an HR signup code.'
        });
      }
      // Validate role-specific requirements (for OAuth signups that might have staff roles)
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
        gender,
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
      
      // Validate required fields
      const requiredFields = validateRequiredFields(req.body, ['email', 'password']);
      if (!requiredFields.isValid) {
        return res.status(400).json({
          success: false,
          error: `${requiredFields.missingFields.join(', ')} ${requiredFields.missingFields.length === 1 ? 'is' : 'are'} required`
        });
      }
      
      // Validate email format
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: emailValidation.error
        });
      }
      // Supabase Auth login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) {
        // Log detailed error server-side only
        console.error('[LOGIN] Authentication failed:', {
          email: email.toLowerCase(),
          error: authError.message,
          code: authError.code,
          timestamp: new Date().toISOString()
        });
        
        // Check if user exists to determine if it's "user not found" vs "wrong password"
        // Note: This exposes user enumeration, but provides better UX with specific error messages
        let isUserNotFound = false;
        try {
          const { data: userData, error: getUserError } = await supabase.auth.admin.getUserByEmail(email.toLowerCase());
          // If getUserByEmail fails or returns no user, user doesn't exist
          if (getUserError || !userData?.user) {
            isUserNotFound = true;
          }
        } catch (checkError) {
          // If admin API check fails, fall back to error message pattern matching
          const errorMessage = authError.message?.toLowerCase() || '';
          const errorCode = authError.code?.toLowerCase() || '';
          
          isUserNotFound = 
            errorMessage.includes('user not found') ||
            errorMessage.includes('no user found') ||
            errorMessage.includes('user does not exist') ||
            errorCode === 'user_not_found';
        }
        
        const errorResponse = isUserNotFound 
          ? 'User not found'
          : 'Invalid email or password';
        
        return res.status(401).json({
          success: false,
          error: errorResponse
        });
      }
      const userId = authData.user.id;
      
      // Extract and combine user metadata
      const combinedMetadata = extractUserMetadata(authData.user);

      // Check ban status
      const isBanned = combinedMetadata.isBanned === true;
      const { banExpiresAt } = combinedMetadata;

      if (isBanned && banExpiresAt) {
        const expirationDate = new Date(banExpiresAt);
        const now = new Date();

        if (now <= expirationDate) {
          // User is still banned
          const banType = combinedMetadata.banType || 'temporary';
          const banReason = combinedMetadata.banReason || 'No reason provided';
          const banMessage = banType === 'permanent'
            ? 'Your account has been permanently banned.'
            : `Your account is banned until ${expirationDate.toLocaleString()}.`;

          return res.status(403).json({
            success: false,
            error: `Access denied. ${banMessage} Reason: ${banReason}`
          });
        }
        // Ban has expired, automatically unban (handled by UserManagementService on next check)
        console.log('[LOGIN] Ban expired for user:', userId);
      }

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
        emailVerified: Boolean(authData.user.email_confirmed_at),
        phoneVerified: combinedMetadata.phone_verified || false,
        isBanned: isBanned && banExpiresAt && new Date(banExpiresAt) > new Date(),
        warningStrike: combinedMetadata.warningStrike || 0,
        // Include raw metadata for reference
        user_metadata: authData.user.user_metadata || {},
        raw_user_meta_data: authData.user.raw_user_meta_data || {}
      };

      // Check if user is active (skip for pending_verification on first login)
      if (user.status && user.status !== 'active' && user.status !== 'pending_verification') {
        return res.status(403).json({
          success: false,
          error: `Account is ${user.status}. Please contact support.`
        });
      }
      // Track login (continue even if tracking fails)
      const resolveClientIp = (request) => {
        try {
          // Prefer X-Forwarded-For (first IP) when behind proxy/load balancer
          const xff = request.headers['x-forwarded-for'];
          if (xff) {

            const first = (Array.isArray(xff) ? xff.join(',') : String(xff))
              .split(',')[0]
              .trim();
            if (first) return normalizeIp(first);
          }
          // Nginx/traefik style
          const xri = request.headers['x-real-ip'];
          if (xri) return normalizeIp(String(xri));
          // Fallbacks from Node/Express
          const raw = request.socket?.remoteAddress
            || request.connection?.remoteAddress
            || request.ip
            || '';
          return normalizeIp(String(raw));
        } catch (_) {
          return '0.0.0.0';
        }
      };
      const normalizeIp = (ip) => {
        if (!ip) return '0.0.0.0';
        const cleaned = ip
          .replace(/^::ffff:/i, '') // IPv4-mapped IPv6
          .replace(/%[0-9a-zA-Z]+$/, ''); // drop zone index (e.g., fe80::1%lo0)
        if (cleaned === '::1' || cleaned === '0:0:0:0:0:0:0:1') return '127.0.0.1';
        if (cleaned === '::') return '0.0.0.0';
        return cleaned;
      };
      const ipAddress = resolveClientIp(req);
      const userAgent = req.get('User-Agent');
      
      try {
        await UserService.trackLogin(userId, ipAddress, userAgent);
      } catch (trackError) {
        console.warn('[LOGIN] ⚠️ Login tracking failed:', trackError.message);
      }
      // Set session cookie with proper expiration
      const cookieOptions = getCookieOptions(remember);
      res.cookie('sb_access_token', authData.session.access_token, cookieOptions);
      
      // SECURITY: Access token is set in HttpOnly cookie for server-side use
      // Return refresh token in response for client-side Supabase session sync (less sensitive than access token)
      res.json({
        success: true,
        data: {
          user,
          // Refresh token for client-side Supabase session sync (not stored in HttpOnly cookie)
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at
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
      delete updateData.email; // Email changes require separate confirmation flow
      delete updateData.role;
      delete updateData.status;
      delete updateData.email_verified;
      delete updateData.position; // Position is managed by admin/HR

      // Validate address fields if provided
      if (updateData.postal_code) {
        const { isValidPostalCode } = require('../utils/inputValidation');
        if (!isValidPostalCode(updateData.postal_code)) {
          return res.status(400).json({
            success: false,
            error: 'Postal code must be 4 digits'
          });
        }
      }

      // Validate required address components if any address field is provided
      const addressValidation = validateAddress({
        line1: updateData.address_line_1,
        city: updateData.city,
        province: updateData.province
      });
      if (!addressValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: addressValidation.error
        });
      }

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
   * Request password change with email confirmation
   */
  async requestPasswordChange(req, res) {
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;
      const userId = req.user.id;
      const userEmail = req.user.email;
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
      // Verify current password by attempting to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword
      });
      if (signInError || !signInData) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }
      // Use Supabase's resetPasswordForEmail to send a confirmation email
      // This will send a password reset email, which the user can use to confirm the password change
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const { error: emailError } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${frontendUrl}/reset-password`
      });
      if (emailError) {
        return res.status(400).json({
          success: false,
          error: 'Failed to send confirmation email. Please try again later.'
        });
      }
      // Store the new password temporarily (in a real implementation, you'd use a secure storage)
      // For now, we'll rely on Supabase's password reset flow
      // The user will set the new password through the email link
      res.json({
        success: true,
        message: 'A confirmation email has been sent to your email address. Please check your inbox and click the confirmation link to complete the password change. You will be asked to set your new password through the link.'
      });
    } catch (error) {
      console.error('Request password change error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to request password change'
      });
    }
  }
  /**
   * Confirm password change via email link (handled by Supabase's reset password flow)
   * This endpoint is kept for compatibility but the actual confirmation is handled
   * by Supabase's password reset email link flow
   */
  async confirmPasswordChange(req, res) {
    try {
      // This endpoint redirects to the password reset page
      // The actual password change is handled through Supabase's password reset flow
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/reset-password`);
    } catch (error) {
      console.error('Confirm password change error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm password change'
      });
    }
  }
  /**
   * Request email change with email confirmation
   */
  async requestEmailChange(req, res) {
    try {
      const { newEmail, currentPassword } = req.body;
      const userId = req.user.id;
      const currentEmail = req.user.email;

      if (!newEmail || !currentPassword) {
        return res.status(400).json({
          success: false,
          error: 'New email and current password are required'
        });
      }

      // Validate email format
      const emailValidation = validateEmail(newEmail);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: emailValidation.error
        });
      }

      // Check if new email is different from current
      if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'New email must be different from current email'
        });
      }

      // Verify current password by attempting to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword
      });
      if (signInError || !signInData) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Check if email is already in use before attempting change
      // This prevents partial updates if email is taken
      try {
        const { data: existingUser } = await supabase.auth.admin.getUserByEmail(newEmail);
        if (existingUser?.user) {
          return res.status(400).json({
            success: false,
            error: 'This email address is already registered'
          });
        }
      } catch (checkError) {
        // If check fails, continue - Supabase will catch duplicate on update
        console.warn('[EMAIL CHANGE] Email availability check failed:', checkError.message);
      }

      // Store original email for rollback
      const originalEmail = currentEmail;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      
      // Use Supabase's updateUser to change email (this will send a confirmation email)
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: false // This will trigger a confirmation email
      });

      if (updateError) {
        // Log detailed error server-side only
        console.error('[EMAIL CHANGE] Failed to update email:', {
          userId,
          originalEmail,
          newEmail,
          error: updateError.message,
          code: updateError.code
        });
        
        // Check if email is already in use
        const errorMsg = String(updateError.message || '').toLowerCase();
        if (errorMsg.includes('already') || errorMsg.includes('exists') || errorMsg.includes('duplicate')) {
          return res.status(400).json({
            success: false,
            error: 'This email address is already registered'
          });
        }
        
        // Generic error message for client
        return res.status(400).json({
          success: false,
          error: 'Failed to initiate email change. Please try again later.'
        });
      }

      // Verify the update was successful
      if (!updateData?.user || updateData.user.email !== newEmail) {
        console.error('[EMAIL CHANGE] Email update verification failed:', {
          userId,
          expectedEmail: newEmail,
          actualEmail: updateData?.user?.email
        });
        
        // Attempt rollback
        try {
          await supabase.auth.admin.updateUserById(userId, {
            email: originalEmail,
            email_confirm: true // Keep original email confirmed
          });
        } catch (rollbackError) {
          console.error('[EMAIL CHANGE] Rollback failed:', rollbackError);
          // Critical: email change partially completed but rollback failed
        }
        
        return res.status(500).json({
          success: false,
          error: 'Email change verification failed. Please contact support.'
        });
      }

      // Send confirmation email to the new email address
      const { error: emailError } = await supabase.auth.resend({
        type: 'email_change',
        email: newEmail,
        options: {
          emailRedirectTo: `${frontendUrl}/email-change-confirmed`
        }
      });

      if (emailError) {
        console.error('[EMAIL CHANGE] Confirmation email failed:', {
          userId,
          newEmail,
          error: emailError.message
        });
        
        // Email change was initiated but confirmation email failed
        // Don't rollback - user can request resend
        return res.status(200).json({
          success: true,
          message: 'Email change initiated, but confirmation email could not be sent. Please contact support or try again later.',
          warning: true
        });
      }

      res.json({
        success: true,
        message: 'A confirmation email has been sent to your new email address. Please check your inbox and click the confirmation link to complete the email change.'
      });
    } catch (error) {
      console.error('Request email change error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to request email change'
      });
    }
  }
  /**
   * Change user password (legacy - kept for backward compatibility)
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
      const {
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        name, // Single name field
        mobileNumber,
        gender,
        address = {},
        agreedToTerms,
        isOAuth = true
      } = req.body;

      // Validation
      if (!agreedToTerms) {
        return res.status(400).json({
          success: false,
          error: 'You must agree to the terms and conditions'
        });
      }

      if (password && password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'Passwords do not match'
        });
      }

      // Validate password strength if password is provided
      if (password) {
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: 'Password does not meet security requirements',
            details: passwordValidation.errors
          });
        }
      }

      // Handle name - use name if provided, otherwise combine firstName + lastName
      const displayName = name || `${firstName || ''} ${lastName || ''}`.trim();
      const firstNameFinal = firstName || displayName.split(' ')[0] || '';
      const lastNameFinal = lastName || displayName.split(' ').slice(1).join(' ') || '';

      // Normalize role (default to citizen for OAuth users)
      const role = 'citizen';
      const { normalizeRole } = require('../utils/roleValidation');
      const normalizedRole = normalizeRole(role);

      // Get current user metadata to preserve existing fields
      const { data: currentUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);
      if (getUserError) {
        console.error('Error fetching current user:', getUserError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch user data'
        });
      }

      const currentMetadata = currentUser.user.user_metadata || {};
      const currentRawMetadata = currentUser.user.raw_user_meta_data || {};
      const existingMetadata = { ...currentMetadata, ...currentRawMetadata };

      // Prepare metadata update (merge with existing metadata)
      const metadataUpdate = {
        ...existingMetadata,
        // Identity
        first_name: firstNameFinal,
        last_name: lastNameFinal,
        name: displayName,
        role,
        normalized_role: normalizedRole,
        mobile_number: mobileNumber || existingMetadata.mobile_number || null,
        mobile: mobileNumber || existingMetadata.mobile || null, // Also store as 'mobile' for compatibility
        is_oauth: isOAuth,
        status: existingMetadata.status || 'pending_verification',
        // Address
        address_line_1: address.line1 || existingMetadata.address_line_1 || null,
        address_line_2: address.line2 || existingMetadata.address_line_2 || null,
        city: address.city || existingMetadata.city || null,
        province: address.province || existingMetadata.province || null,
        postal_code: address.postalCode || existingMetadata.postal_code || null,
        barangay: address.barangay || existingMetadata.barangay || null,
        // Verification
        email_verified: existingMetadata.email_verified || false,
        mobile_verified: existingMetadata.mobile_verified || false,
        gender: gender || existingMetadata.gender || null,
        // Preferences (preserve existing or set defaults)
        preferred_language: existingMetadata.preferred_language || 'en',
        timezone: existingMetadata.timezone || 'Asia/Manila',
        email_notifications: existingMetadata.email_notifications !== undefined ? existingMetadata.email_notifications : true,
        sms_notifications: existingMetadata.sms_notifications || false,
        push_notifications: existingMetadata.push_notifications !== undefined ? existingMetadata.push_notifications : true,
        // Banning system (preserve existing)
        isBanned: existingMetadata.isBanned || false,
        warningStrike: existingMetadata.warningStrike || 0,
        // Timestamps
        updated_at: new Date().toISOString()
      };

      // Update user metadata using admin API
      const updateData = {
        user_metadata: metadataUpdate,
        raw_user_meta_data: metadataUpdate
      };

      // Update password if provided
      if (password) {
        updateData.password = password;
      }

      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        updateData
      );

      if (updateError) {
        console.error('OAuth completion update error:', updateError);
        return res.status(400).json({
          success: false,
          error: updateError.message || 'Failed to update user profile'
        });
      }

      res.json({
        success: true,
        message: 'OAuth registration completed successfully',
        data: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          name: displayName,
          role: normalizedRole
        }
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
        gender,
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
      // Validate address fields if provided
      const addressValidation = validateAddress(address);
      if (!addressValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: addressValidation.error
        });
      }

      // Create user as citizen first with pending approval metadata
      const pendingUser = await UserService.createUser({
        email,
        password,
        firstName,
        lastName,
        name,
        mobileNumber,
        gender,
        role: 'citizen',
        department: null,
        employeeId: null,
        address,
        isOAuth
      });
      // Store intent for approval in user metadata
      // Add a small delay to ensure user is fully created before updating
      await new Promise(resolve => setTimeout(resolve, 500));

      // Retry logic for updating user metadata
      let updateSuccess = false;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const updated = await UserService.updateUser(pendingUser.id, {
            status: 'pending_approval',
            pending_role: role,
            pending_department: department_code,
            pending_signup_code: signupCode,
            // Store department in both formats for consistency
            department: null, // Will be set on approval
            dpt: null // Will be set on approval
          }, pendingUser.id);
          console.log('[AUTH] Signup with code: Updated user metadata for approval', {
            userId: pendingUser.id,
            pendingRole: role,
            pendingDepartment: department_code,
            attempt: attempt + 1
          });
          updateSuccess = true;
          break;
        } catch (updateError) {
          lastError = updateError;
          console.warn(`[AUTH] Signup with code: Update attempt ${attempt + 1} failed:`, updateError.message);
          if (attempt < 2) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      if (!updateSuccess) {
        console.error('[AUTH] Signup with code: Failed to update user metadata after 3 attempts:', lastError?.message);
        // Don't fail the signup, but log the error
        // The user will still be created but HR will need to manually check
      }
      // Mark signup code as used (it cannot be reused)
      await hrService.markSignupCodeUsed(signupCode, pendingUser.id);
      res.status(201).json({
        success: true,
        data: { id: pendingUser.id, email: pendingUser.email, status: 'pending_approval' },
        message: 'Signup submitted for approval. You will be notified once approved.'
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
        role,
        normalized_role: (role || '') === 'lgu-admin' ? 'lgu-admin' : (role || '') === 'lgu' ? 'lgu' : role || 'citizen',
        department: department_code || null,
        // Flags
        is_oauth: true,
        status: 'active',
        email_verified: true,
        phone_verified: Boolean(mobile),
        updated_at: new Date().toISOString()
      };
      // Update user metadata using admin API
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: completeMetadata,
        raw_user_meta_data: completeMetadata
      });

      if (updateError) {
        console.error('[OAUTH HR] Failed to update user metadata:', {
          userId,
          error: updateError.message,
          code: updateError.code
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to complete OAuth registration. Please contact support.'
        });
      }

      // Verify the update was successful
      if (!updatedUser?.user) {
        console.error('[OAUTH HR] User update verification failed');
        return res.status(500).json({
          success: false,
          error: 'OAuth registration verification failed. Please contact support.'
        });
      }

      // Verify metadata was actually updated
      const updatedMetadata = updatedUser.user.user_metadata || updatedUser.user.raw_user_meta_data || {};
      const metadataMatches = updatedMetadata.role === completeMetadata.role && 
                              updatedMetadata.department === completeMetadata.department;
      
      if (!metadataMatches) {
        console.error('[OAUTH HR] Metadata update verification failed:', {
          userId,
          expected: { role: completeMetadata.role, department: completeMetadata.department },
          actual: { role: updatedMetadata.role, department: updatedMetadata.department }
        });
        return res.status(500).json({
          success: false,
          error: 'OAuth registration completed but metadata update verification failed. Please contact support.'
        });
      }

      // Mark signup code as used (only if update was successful)
      try {
        await hrService.markSignupCodeUsed(signupCode, userId);
      } catch (markError) {
        console.error('[OAUTH HR] Failed to mark signup code as used:', markError);
        // Don't fail the request, but log the error
        // The code will remain unused, which is safer than marking it used incorrectly
      }

      return res.json({
        success: true,
        message: 'OAuth registration (HR) completed successfully',
        data: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          role: completeMetadata.role,
          department: completeMetadata.department
        }
      });
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
