/**
 * Authentication Utility Functions
 * Centralized utilities for authentication-related operations
 */

/**
 * Extract and combine user metadata from Supabase user object
 * @param {Object} tokenUser - Supabase user object from token
 * @returns {Object} Combined metadata object
 */
function extractUserMetadata(tokenUser) {
  const userMetadata = tokenUser.user_metadata || {};
  const rawUserMetaData = tokenUser.raw_user_meta_data || {};
  
  // Merge both sources (raw_user_meta_data takes priority)
  return { ...userMetadata, ...rawUserMetaData };
}

/**
 * Extract user name from metadata with fallbacks
 * @param {Object} combinedMetadata - Combined user metadata
 * @param {string} email - User email as fallback
 * @returns {string} User display name
 */
function extractUserName(combinedMetadata, email) {
  return combinedMetadata.name ||
    `${combinedMetadata.first_name || ''} ${combinedMetadata.last_name || ''}`.trim() ||
    email?.split('@')[0] ||
    'Unknown User';
}

/**
 * Extract user department from metadata and role
 * @param {Object} combinedMetadata - Combined user metadata
 * @param {string|null} departmentCode - Department code from role (if any)
 * @returns {string|null} Department code or null
 */
function extractUserDepartment(combinedMetadata, departmentCode) {
  return departmentCode ||
    combinedMetadata.department ||
    combinedMetadata.dpt ||
    combinedMetadata.raw_user_meta_data?.department ||
    combinedMetadata.raw_user_meta_data?.dpt ||
    null;
}

/**
 * Build standardized user object for req.user
 * @param {Object} tokenUser - Supabase user object from token
 * @param {Object} combinedMetadata - Combined metadata
 * @param {Object} roleValidation - Role validation result
 * @param {string|null} departmentCode - Department code from role
 * @returns {Object} Standardized user object
 */
function buildUserObject(tokenUser, combinedMetadata, roleValidation, departmentCode) {
  const userName = extractUserName(combinedMetadata, tokenUser.email);
  const userDepartment = extractUserDepartment(combinedMetadata, departmentCode);
  const userRole = combinedMetadata.role || 'citizen';

  return {
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
    isBanned: combinedMetadata.isBanned === true,
    warningStrike: combinedMetadata.warningStrike || 0,
    banType: combinedMetadata.banType || null,
    banExpiresAt: combinedMetadata.banExpiresAt || null
  };
}

/**
 * Generate cookie options for session cookies
 * @param {boolean} remember - Whether this is a "remember me" session
 * @returns {Object} Cookie options object
 */
function getCookieOptions(remember = false) {
  const cookieMaxAge = remember
    ? 30 * 24 * 60 * 60 * 1000  // 30 days for "remember me"
    : 24 * 60 * 60 * 1000;      // 24 hours for regular sessions

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: cookieMaxAge
  };
}

/**
 * Generate standardized error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} details - Additional error details (optional)
 * @returns {Object} Error response object
 */
function createErrorResponse(message, statusCode = 500, details = null) {
  const response = {
    success: false,
    error: message
  };

  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }

  return { response, statusCode };
}

/**
 * Handle authentication errors consistently
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} defaultMessage - Default error message
 */
function handleAuthError(error, req, res, defaultMessage = 'Authentication failed') {
  const isApiRequest = req.path?.startsWith('/api/') || 
                       req.originalUrl?.startsWith('/api/') ||
                       req.url?.startsWith('/api/');

  console.error(`[AUTH] ${new Date().toISOString()} Authentication error:`, error.message);

  if (isApiRequest) {
    return res.status(401).json({
      success: false,
      error: defaultMessage
    });
  }

  return res.redirect(`/login?message=${encodeURIComponent(defaultMessage)}&type=error`);
}

module.exports = {
  extractUserMetadata,
  extractUserName,
  extractUserDepartment,
  buildUserObject,
  getCookieOptions,
  createErrorResponse,
  handleAuthError
};




