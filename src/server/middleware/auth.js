const _path = require('path');
const Database = require('../config/database');
const _UserService = require('../services/UserService');
const { validateUserRole, extractDepartmentCode } = require('../utils/roleValidation');

const supabase = Database.getClient();

const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from cookies or headers
    const token =
      req.cookies?.sb_access_token ||
      req.cookies?.sb_access_token_debug ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        // console.log removed for security
      }
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'No authentication token'
        });
      }
      return res.redirect(`/login?message=${  encodeURIComponent('Please login first')  }&type=error`);
    }

    // Validate token with Supabase
    const {
      data: { user: tokenUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !tokenUser) {
      if (process.env.NODE_ENV === 'development') {
        // console.log removed for security
      }
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }
      return res.redirect(`/login?message=${  encodeURIComponent('Invalid session. Please login again')  }&type=error`);
    }


    // Get user metadata from the token itself instead of using admin API
    // The token already contains user metadata that we can use
    const userMetadata = tokenUser.user_metadata || {};
    const rawUserMetaData = tokenUser.raw_user_meta_data || {};

    // Merge both sources (raw_user_meta_data takes priority)
    const combinedMetadata = { ...userMetadata, ...rawUserMetaData };

    // Build consistent user object for req.user
    // Use combined metadata (checks both sources)
    const userName = combinedMetadata.name ||
                    `${combinedMetadata.first_name || ''} ${combinedMetadata.last_name || ''}`.trim() ||
                    tokenUser.email?.split('@')[0] || // Fallback to email username
                    'Unknown User';

    // Validate user role and department code
    const userRole = combinedMetadata.role || 'citizen';
    const roleValidation = await validateUserRole(userRole);

    if (!roleValidation.isValid) {
      console.error('[AUTH] ❌ Invalid role:', {
        role: userRole,
        error: roleValidation.error,
        userId: tokenUser.id
      });

      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          error: `Invalid role: ${roleValidation.error}`
        });
      }
      return res.redirect(`/login?message=${  encodeURIComponent(`Invalid role: ${roleValidation.error}`)  }&type=error`);
    }

    // Extract department code for LGU roles
    const departmentCode = extractDepartmentCode(userRole);

    // For simplified roles, extract department from metadata
    const userDepartment = departmentCode ||
                          combinedMetadata.department ||
                          combinedMetadata.dpt ||
                          combinedMetadata.raw_user_meta_data?.department ||
                          combinedMetadata.raw_user_meta_data?.dpt;


    // Attach the enhanced user object to the request
    req.user = {
      // Supabase auth fields
      id: tokenUser.id,
      email: tokenUser.email,
      email_confirmed_at: tokenUser.email_confirmed_at,

      // Metadata (checks both raw_user_meta_data and user_metadata)
      raw_user_meta_data: combinedMetadata,

      // Easy access fields from combined metadata
      role: userRole,
      normalized_role: combinedMetadata.normalized_role || combinedMetadata.role || 'citizen',
      name: userName,
      fullName: userName,
      firstName: combinedMetadata.first_name || '',
      lastName: combinedMetadata.last_name || '',
      mobileNumber: combinedMetadata.mobile_number || combinedMetadata.mobile || null,
      status: combinedMetadata.status || 'active',
      department: userDepartment,
      employeeId: combinedMetadata.employee_id || null,

      // Role validation info
      roleType: roleValidation.roleType,
      departmentCode,

      // Verification
      emailVerified: Boolean(tokenUser.email_confirmed_at),
      phoneVerified: combinedMetadata.phone_verified || false,

      // Security
      isBanned: combinedMetadata.permanentBan || false,
      banStrike: combinedMetadata.banStrike || 0
    };

    next();
  } catch (error) {
    console.error(`[AUTH] ${new Date().toISOString()} Authentication error:`, error.message);
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }
    return res.redirect(`/login?message=${  encodeURIComponent('Authentication failed. Please try again')  }&type=error`);
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // SINGLE SOURCE: req.user.role (already processed in authenticateUser)
    const userRole = req.user?.role;
    const baseRole = req.user?.raw_user_meta_data?.base_role;

    if (!userRole) {
      // console.log removed for security
      // console.log removed for security
      return res.redirect(`/login?message=${  encodeURIComponent('Authentication incomplete: missing role. Please contact support.')  }&type=error`);
    }

    const normalizedRole = String(userRole).trim().toLowerCase();
    const normalizedBaseRole = baseRole ? String(baseRole).trim().toLowerCase() : null;

    const hasPermission = allowedRoles.some((allowedRole) => {
      if (typeof allowedRole === 'string') {
        // Support wildcard matching (e.g., "lgu-admin*" matches "lgu-admin-{dept}")
        if (allowedRole.includes('*')) {
          // Safe wildcard matching without dynamic regex
          const pattern = allowedRole.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(normalizedRole) || (normalizedBaseRole && regex.test(normalizedBaseRole));
        }
        return normalizedRole === allowedRole.toLowerCase() || (normalizedBaseRole && normalizedBaseRole === allowedRole.toLowerCase());
      } else if (allowedRole instanceof RegExp) {
        return allowedRole.test(normalizedRole) || (normalizedBaseRole && allowedRole.test(normalizedBaseRole));
      } else if (typeof allowedRole === 'object' && allowedRole !== null) {
        // Handle case where regex might be converted to object
        console.error('[AUTH] Invalid role in allowedRoles array:', allowedRole);
        return false;
      }
      return false;
    });

    if (!hasPermission) {
      // console.log removed for security

      // Check if this is an API request - look at both path and originalUrl
      const isApiRequest = req.path.startsWith('/api/') ||
                           req.originalUrl.startsWith('/api/') ||
                           req.url.startsWith('/api/');

      if (isApiRequest) {
        // console.log removed for security
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to access this resource.',
          debug: {
            userRole,
            allowedRoles,
            path: req.path
          }
        });
      }

      return res.redirect(`/login?message=${  encodeURIComponent('Access denied. You do not have permission to access this resource.')  }&type=error`);
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  requireRole
};

