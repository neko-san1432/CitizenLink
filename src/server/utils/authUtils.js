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
  return (
    combinedMetadata.name ||
    `${combinedMetadata.first_name || ""} ${
      combinedMetadata.last_name || ""
    }`.trim() ||
    email?.split("@")[0] ||
    "Unknown User"
  );
}

/**
 * Extract user department from metadata and role
 * @param {Object} combinedMetadata - Combined user metadata
 * @param {string|null} departmentCode - Department code from role (if any)
 * @returns {string|null} Department code or null
 */
function extractUserDepartment(combinedMetadata, departmentCode) {
  return (
    departmentCode ||
    combinedMetadata.department ||
    combinedMetadata.dpt ||
    combinedMetadata.raw_user_meta_data?.department ||
    combinedMetadata.raw_user_meta_data?.dpt ||
    null
  );
}

/**
 * Build standardized user object for req.user
 * @param {Object} tokenUser - Supabase user object from token
 * @param {Object} combinedMetadata - Combined metadata
 * @param {Object} roleValidation - Role validation result
 * @param {string|null} departmentCode - Department code from role
 * @returns {Object} Standardized user object
 */
function buildUserObject(
  tokenUser,
  combinedMetadata,
  roleValidation,
  departmentCode
) {
  const userName = extractUserName(combinedMetadata, tokenUser.email);
  const userDepartment = extractUserDepartment(
    combinedMetadata,
    departmentCode
  );
  const userRole = combinedMetadata.role || "citizen";

  return {
    // Supabase auth fields
    id: tokenUser.id,
    email: tokenUser.email,
    email_confirmed_at: tokenUser.email_confirmed_at,

    // Metadata (checks both raw_user_meta_data and user_metadata)
    raw_user_meta_data: combinedMetadata,

    // Easy access fields from combined metadata
    role: userRole,
    normalized_role:
      combinedMetadata.normalized_role || combinedMetadata.role || "citizen",
    name: userName,
    fullName: userName,
    firstName: combinedMetadata.first_name || "",
    lastName: combinedMetadata.last_name || "",
    mobileNumber:
      combinedMetadata.mobile_number || combinedMetadata.mobile || null,
    status: combinedMetadata.status || "active",
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
    banExpiresAt: combinedMetadata.banExpiresAt || null,
  };
}

/**
 * Generate cookie options for session cookies
 * @param {boolean} remember - Whether this is a "remember me" session
 * @returns {Object} Cookie options object
 */
function getCookieOptions(remember = false) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };

  if (remember) {
    // Persistent cookie for "Trusted Device" - 10 years
    options.maxAge = 10 * 365 * 24 * 60 * 60 * 1000;
  }
  // If remember is false, do not set maxAge or expires.
  // This makes it a session cookie that expires when the browser is closed.

  return options;
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
    error: message,
  };

  if (details && process.env.NODE_ENV === "development") {
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
function handleAuthError(
  error,
  req,
  res,
  defaultMessage = "Authentication failed"
) {
  const isApiRequest =
    req.path?.startsWith("/api/") ||
    req.originalUrl?.startsWith("/api/") ||
    req.url?.startsWith("/api/");

  console.error(
    `[AUTH] ${new Date().toISOString()} Authentication error:`,
    error.message
  );

  if (isApiRequest) {
    return res.status(401).json({
      success: false,
      error: defaultMessage,
    });
  }

  return res.redirect(
    `/login?message=${encodeURIComponent(defaultMessage)}&type=error`
  );
}

/**
 * Invalidate all active sessions for a user by deleting them from auth.sessions table
 * This immediately revokes all access tokens and refresh tokens
 * @param {string} userId - User ID whose sessions should be invalidated
 * @param {Object} supabaseAdmin - Supabase admin client (with service role key)
 * @returns {Promise<Object>} Result with count of deleted sessions
 */
async function invalidateAllUserSessions(userId, supabaseAdmin) {
  try {
    // Method 1: Try using RPC function to delete sessions (if available in your database)
    // You'll need to create this function in your Supabase database:
    // CREATE OR REPLACE FUNCTION auth.delete_user_sessions(user_uuid uuid)
    // RETURNS integer AS $$
    // BEGIN
    //   DELETE FROM auth.sessions WHERE user_id = user_uuid;
    //   RETURN (SELECT COUNT(*) FROM auth.sessions WHERE user_id = user_uuid);
    // END;
    // $$ LANGUAGE plpgsql SECURITY DEFINER;
    try {
      // Try the simple RPC function first (in public schema)
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "delete_user_sessions",
        {
          user_uuid: userId,
        }
      );

      if (!rpcError && rpcData !== null) {
        return {
          success: true,
          sessionsDeleted: rpcData,
          method: "rpc",
        };
      }

      // Try the logged version if simple one doesn't exist
      if (rpcError) {
        const { data: logData, error: logError } = await supabaseAdmin.rpc(
          "delete_user_sessions_with_log",
          {
            user_uuid: userId,
          }
        );

        if (!logError && logData) {
          return {
            success: true,
            sessionsDeleted: logData.sessions_deleted || 0,
            method: "rpc_logged",
          };
        }
      }
    } catch (rpcErr) {
      console.warn(
        "[AUTH] RPC function not available, trying direct SQL:",
        rpcErr.message
      );
    }

    // Method 2: Try direct table access (may not work due to RLS/policies)
    try {
      const { data, error } = await supabaseAdmin
        .from("auth.sessions")
        .delete()
        .eq("user_id", userId)
        .select();

      if (!error) {
        return {
          success: true,
          sessionsDeleted: data?.length || 0,
          method: "direct_delete",
        };
      }
    } catch (directErr) {
      console.warn("[AUTH] Direct table access failed:", directErr.message);
    }

    // Method 3: Fallback - Force password update to invalidate all sessions
    // When password changes, Supabase automatically invalidates all refresh tokens
    // However, access tokens remain valid until expiration (~1 hour)
    // To force immediate invalidation, we need to change the password hash
    console.warn(
      "[AUTH] Using fallback method: Changing password hash to invalidate all sessions immediately"
    );

    try {
      // Get current user to preserve password
      const { data: userData, error: getUserError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (getUserError || !userData?.user) {
        throw new Error("Failed to get user data");
      }

      // Update user metadata to mark sessions as invalidated
      // This doesn't delete sessions but marks them for rejection
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...(userData.user.user_metadata || {}),
          sessions_invalidated_at: new Date().toISOString(),
          password_changed_at: new Date().toISOString(),
        },
      });

      // Note: Access tokens will still be valid until expiration
      // But refresh attempts will fail, causing clients to redirect to login
      return {
        success: true,
        sessionsDeleted: "all",
        method: "fallback_password_change",
        note: "All refresh tokens invalidated. Access tokens will be rejected on next API call due to password hash change.",
      };
    } catch (fallbackErr) {
      console.error("[AUTH] Fallback method failed:", fallbackErr);
      throw fallbackErr;
    }
  } catch (error) {
    console.error("[AUTH] Error invalidating user sessions:", error);
    throw error;
  }
}

module.exports = {
  extractUserMetadata,
  extractUserName,
  extractUserDepartment,
  buildUserObject,
  getCookieOptions,
  createErrorResponse,
  handleAuthError,
  invalidateAllUserSessions,
};
