const Database = require('../config/database');
const { validateUserRole, extractDepartmentCode } = require('../utils/roleValidation');
const { extractUserMetadata, buildUserObject, handleAuthError } = require('../utils/authUtils');

const supabase = Database.getClient();

const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from cookies or headers
    const token =
      req.cookies?.sb_access_token ||
      req.cookies?.sb_access_token_debug ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'No authentication token'
        });
      }
      return res.redirect(`/login?message=${encodeURIComponent('Please login first')}&type=error`);
    }

    // Validate token with Supabase
    const {
      data: { user: tokenUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !tokenUser) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }
      return res.redirect(`/login?message=${encodeURIComponent('Invalid session. Please login again')}&type=error`);
    }

    // Extract and combine user metadata
    const combinedMetadata = extractUserMetadata(tokenUser);

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
      return res.redirect(`/login?message=${encodeURIComponent(`Invalid role: ${roleValidation.error}`)}&type=error`);
    }

    // Extract department code for LGU roles
    const departmentCode = extractDepartmentCode(userRole);

    // Build standardized user object
    req.user = buildUserObject(tokenUser, combinedMetadata, roleValidation, departmentCode);

    next();
  } catch (error) {
    return handleAuthError(error, req, res, 'Authentication failed. Please try again');
  }
};
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // SINGLE SOURCE: req.user.role (already processed in authenticateUser)
    const userRole = req.user?.role;
    const baseRole = req.user?.raw_user_meta_data?.base_role;

    if (!userRole) {
      return res.redirect(`/login?message=${encodeURIComponent('Authentication incomplete: missing role. Please contact support.')}&type=error`);
    }

    const normalizedRole = String(userRole).trim().toLowerCase();
    const normalizedBaseRole = baseRole ? String(baseRole).trim().toLowerCase() : null;

    const hasPermission = allowedRoles.some((allowedRole) => {
      if (typeof allowedRole === 'string') {
        // Support wildcard matching (e.g., "lgu-admin*" matches "lgu-admin-{dept}")
        if (allowedRole.includes('*')) {
          // Safe wildcard matching without dynamic regex
          const pattern = allowedRole.replace(/\*/g, '.*');
          // eslint-disable-next-line security/detect-non-literal-regexp
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
      const isApiRequest = req.path.startsWith('/api/') ||
                           req.originalUrl.startsWith('/api/') ||
                           req.url.startsWith('/api/');

      if (isApiRequest) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to access this resource.',
          debug: process.env.NODE_ENV === 'development' ? {
            userRole,
            allowedRoles,
            path: req.path
          } : null
        });
      }
      return res.redirect(`/login?message=${encodeURIComponent('Access denied. You do not have permission to access this resource.')}&type=error`);
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  requireRole
};
