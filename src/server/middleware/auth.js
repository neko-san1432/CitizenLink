const path = require('path');
const Database = require('../config/database');
const UserService = require('../services/UserService');
const database = new Database();

const supabase = database.getClient();

const authenticateUser = async (req, res, next) => {
  try {
    const token =
      req.cookies?.sb_access_token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'No authentication token',
        });
      }
      return res.redirect('/login?message=' + encodeURIComponent('Please login first') + '&type=error');
    }

    // First verify the token is valid
    const {
      data: { user: tokenUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !tokenUser) {
      // console.log removed for security
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
        });
      }
      return res.redirect('/login?message=' + encodeURIComponent('Your session has expired. Please login again') + '&type=error');
    }

    // Now get the complete user data including raw_user_meta_data from auth.users table
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(tokenUser.id);

    if (authError || !authUser) {
      // console.log removed for security
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'Failed to get user data',
        });
      }
      return res.redirect('/login?message=' + encodeURIComponent('Authentication failed. Please try again') + '&type=error');
    }

    // Use the complete auth user data which includes raw_user_meta_data
    const user = authUser.user;

    // SINGLE SOURCE OF TRUTH: raw_user_meta_data
    // This is where Supabase stores custom metadata set during signup
    // FALLBACK: Also check user_metadata in case data is there instead
    const rawUserMetaData = user.raw_user_meta_data || {};
    const userMetadata = user.user_metadata || {};

    // Merge both sources (raw_user_meta_data takes priority)
    const combinedMetadata = { ...userMetadata, ...rawUserMetaData };

    // Build consistent user object for req.user
    // Use combined metadata (checks both sources)
    const userName = combinedMetadata.name ||
                     `${combinedMetadata.first_name || ''} ${combinedMetadata.last_name || ''}`.trim() ||
                     'Unknown User';

    // Attach the enhanced user object to the request
    req.user = {
      // Supabase auth fields
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,

      // Metadata (checks both raw_user_meta_data and user_metadata)
      raw_user_meta_data: combinedMetadata,

      // Easy access fields from combined metadata
      role: combinedMetadata.role || 'citizen',
      normalized_role: combinedMetadata.normalized_role || combinedMetadata.role || 'citizen',
      name: userName,
      fullName: userName,
      firstName: combinedMetadata.first_name || '',
      lastName: combinedMetadata.last_name || '',
      mobileNumber: combinedMetadata.mobile_number || combinedMetadata.mobile || null,
      status: combinedMetadata.status || 'active',
      department: combinedMetadata.department || null,
      employeeId: combinedMetadata.employee_id || null,

      // Verification
      emailVerified: !!user.email_confirmed_at,
      phoneVerified: combinedMetadata.phone_verified || false,

      // Security
      isBanned: combinedMetadata.permanentBan || false,
      banStrike: combinedMetadata.banStrike || 0
    };

    // Removed verbose logs

    next();
  } catch (error) {
    console.error('[AUTH] Authentication error:', error.message);
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
      });
    }
    return res.redirect('/login?message=' + encodeURIComponent('Authentication failed. Please try again') + '&type=error');
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // SINGLE SOURCE: req.user.role (already processed in authenticateUser)
    const userRole = req.user?.role;

    if (!userRole) {

      return res.redirect('/login?message=' + encodeURIComponent('Authentication incomplete: missing role. Please contact support.') + '&type=error');
    }

    const normalizedRole = String(userRole).trim().toLowerCase();

    const hasPermission = allowedRoles.some((allowedRole) => {
      if (typeof allowedRole === 'string') {
        // Support wildcard matching (e.g., "lgu-admin*" matches "lgu-admin-{dept}")
        if (allowedRole.includes('*')) {
          const regex = new RegExp('^' + allowedRole.replace(/\*/g, '.*') + '$');
          return regex.test(normalizedRole);
        }
        return normalizedRole === allowedRole.toLowerCase();
      } else if (allowedRole instanceof RegExp) {
        return allowedRole.test(normalizedRole);
      }
      return false;
    });

    if (!hasPermission) {
      return res.redirect('/login?message=' + encodeURIComponent('Access denied. You do not have permission to access this resource.') + '&type=error');
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  requireRole
};
