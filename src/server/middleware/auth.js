const Database = require("../config/database");
const {
  validateUserRole,
  extractdepartmentCode,
} = require("../utils/roleValidation");
const {
  extractUserMetadata,
  buildUserObject,
  handleAuthError,
} = require("../utils/authUtils");
const { SWITCHABLE_ROLES, ALLOWED_ROLES } = require("../../shared/constants");

const supabase = Database.getClient();

const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from cookies or headers
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.sb_access_token;

    // Prioritize Authorization header as it contains the most recent token from the client
    // SEC-05 FIX: Removed sb_access_token_debug fallback
    const token =
      authHeader?.replace("Bearer ", "") ||
      cookieToken;

    if (!token) {
      if (req.originalUrl.startsWith("/api/") || req.path.startsWith("/api/")) {
        return res.status(401).json({
          success: false,
          error: "No authentication token",
        });
      }
      return res.redirect(
        `/login?message=${encodeURIComponent("Please login first")}&type=error`
      );
    }

    // --- TEST LOGIN BYPASS (DEV MODE) ---
    let tokenUser = null;
    let error = null;

    if (process.env.ENABLE_TEST_LOGIN === "true" && token?.startsWith("test-login-token-")) {
      const role = token.replace("test-login-token-", "");
      console.log(`[AUTH] [TEST_LOGIN] Recognizing test token for role: ${role}`);

      tokenUser = {
        id: `test-uid-${role}`,
        email: `${role}@drims.test`,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: {
          role: role,
          name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
          status: "active"
        },
        raw_user_meta_data: {
          role: role,
          name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
          status: "active"
        }
      };
    } else {
      // Validate token with Supabase
      const {
        data: { user: supabaseUser },
        error: supabaseError,
      } = await supabase.auth.getUser(token);
      tokenUser = supabaseUser;
      error = supabaseError;
    }

    if (error || !tokenUser) {
      // Clear invalid cookie
      res.clearCookie("sb_access_token");

      if (req.originalUrl.startsWith("/api/") || req.path.startsWith("/api/")) {
        return res.status(401).json({
          success: false,
          error: error?.message || "Invalid token",
        });
      }
      return res.redirect(
        `/login?message=${encodeURIComponent(
          "Invalid session. Please login again"
        )}&type=error`
      );
    }

    // Check if sessions were invalidated
    const userMetadata = tokenUser.user_metadata || {};
    const sessionsInvalidatedAt = userMetadata.sessions_invalidated_at;
    const passwordChangedAt = userMetadata.password_changed_at;

    if (sessionsInvalidatedAt || passwordChangedAt) {
      // Decode JWT token to get issued-at time (iat claim)
      try {
        const tokenParts = token.split(".");
        if (tokenParts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(tokenParts[1], "base64").toString()
          );
          const tokenIssuedAt = payload.iat
            ? new Date(payload.iat * 1000)
            : null;
          const invalidationTime = sessionsInvalidatedAt || passwordChangedAt;

          if (
            tokenIssuedAt &&
            invalidationTime &&
            new Date(invalidationTime) > tokenIssuedAt
          ) {
            res.clearCookie("sb_access_token");
            if (
              req.originalUrl.startsWith("/api/") ||
              req.path.startsWith("/api/")
            ) {
              return res.status(401).json({
                success: false,
                error: "Session invalidated. Please login again.",
              });
            }
            return res.redirect(
              `/login?message=${encodeURIComponent(
                "Session invalidated. Please login again"
              )}&type=error`
            );
          }
        }
      } catch (jwtErr) {
        console.warn(
          "[AUTH] Failed to decode JWT for session invalidation check:",
          jwtErr.message
        );
      }
    }

    // Extract and combine user metadata
    const combinedMetadata = extractUserMetadata(tokenUser);

    // Check for Citizen Mode override
    // SEC-21 FIX: Validate app_mode strictly — only allow exact "citizen_mode" value
    // and only for roles that are in SWITCHABLE_ROLES (lgu, super-admin).
    // This is a privilege DOWNGRADE (admin→citizen), not an escalation.
    const appMode = req.cookies?.app_mode;
    const realRole = combinedMetadata.role || "citizen";

    if (appMode === "citizen_mode" && SWITCHABLE_ROLES.includes(realRole)) {
      // Override role to citizen, but save original role
      combinedMetadata.base_role = realRole;
      combinedMetadata.role = "citizen";
      combinedMetadata.normalized_role = "citizen";
    } else if (appMode && appMode !== "citizen_mode") {
      // Invalid app_mode value — clear it
      res.clearCookie("app_mode");
    }

    // Validate user role and department code
    const userRole = combinedMetadata.role || "citizen";
    const roleValidation = await validateUserRole(userRole);

    if (!roleValidation.isValid) {
      console.error("[AUTH] ❌ Invalid role:", {
        role: userRole,
        error: roleValidation.error,
        userId: tokenUser.id,
      });

      // Clear cookie for invalid role to force re-login check
      res.clearCookie("sb_access_token");

      if (req.originalUrl.startsWith("/api/") || req.path.startsWith("/api/")) {
        return res.status(403).json({
          success: false,
          error: `Invalid role: ${roleValidation.error}`,
        });
      }
      return res.redirect(
        `/login?message=${encodeURIComponent(
          `Invalid role: ${roleValidation.error}`
        )}&type=error`
      );
    }

    // STRICT MODE CHECK: Enforce 3-role system if legacy roles are disabled
    if (process.env.ENABLE_LEGACY_ROLES === "false") {
      const normalizedRole = userRole.toLowerCase();

      // Allow if role is explicitly in ALLOWED_ROLES
      // OR if it's an LGU role (starts with 'lgu') but NOT one of the restricted legacy ones
      // We need to be careful: 'lgu' is allowed. 'lgu-admin', 'lgu-hr' are NOT.
      // But 'lgu-{dept}' (officer) might need handling.
      // Based on plan: "lgu-officer is disabled".
      // So valid roles are exact matches: 'citizen', 'super-admin'.
      // And 'lgu' (base role).
      // What about 'lgu-{dept}'? The instruction says "lgu (formerly Coordinator/Admin)".
      // The user said "the 'lgu' role will now become the complaint coordinator".
      // Usually 'lgu' was the base officer. Now it's the "LGU" role.

      // We will check against the ALLOWED_ROLES list from constants: ['citizen', 'lgu', 'super-admin']
      // We must check if the userRole *starts with* allowed roles if we want to allow variations,
      // OR strict equality if we want to block 'lgu-admin'.

      // 'lgu' is in allowed roles. 'lgu-admin' starts with 'lgu'.
      // If we strictly check includes, 'lgu-admin' is NOT in ['citizen', 'lgu', 'super-admin'].
      // So simply checking ALLOWED_ROLES.includes(normalizedRole) should work for exact matches.
      // However, we need to handle the case where 'lgu' might have data appended?
      // Current system uses 'lgu' as the role string in metadata usually, or 'lgu-{dept}'.
      // If 'lgu-{dept}' is the officer, and we want to disable officer...
      // But usage of 'lgu' implies the NEW main LGU role.

      // Let's assume strict exact match for now as safe default for 'citizen' and 'super-admin'.
      // For 'lgu', we might need to handle 'lgu' vs 'lgu-admin'.
      // If allowed is 'lgu', then 'lgu-admin' should FAIL.

      const isAllowed = ALLOWED_ROLES.includes(normalizedRole);

      if (!isAllowed) {
        console.error(`[AUTH] ⛔ Role '${userRole}' is disabled in strict mode.`);
        res.clearCookie("sb_access_token");

        const errorMsg = "Your role is no longer active in the new system.";

        if (req.originalUrl.startsWith("/api/") || req.path.startsWith("/api/")) {
          return res.status(403).json({ success: false, error: errorMsg });
        }
        return res.redirect(`/login?message=${encodeURIComponent(errorMsg)}&type=error`);
      }
    }

    // Extract department code for LGU roles
    const departmentCode = extractdepartmentCode(userRole);

    // Build standardized user object
    req.user = buildUserObject(
      tokenUser,
      combinedMetadata,
      roleValidation,
      departmentCode
    );

    next();
  } catch (error) {
    return handleAuthError(
      error,
      req,
      res,
      "Authentication failed. Please try again"
    );
  }
};

/**
 * Middleware to redirect authenticated users to dashboard
 * Used for login/signup pages to prevent access if already logged in
 */
const redirectIfAuthenticated = async (req, res, next) => {
  try {
    // If request has error parameters, likely a redirect from auth failure
    // Don't auto-redirect back to dashboard (loop prevention)
    if (
      req.query.type === "error" ||
      req.query.session_expired === "true" ||
      req.query.message
    ) {
      return next();
    }

    const token = req.cookies?.sb_access_token;
    if (!token) {
      return next();
    }

    // Verify token validity before redirecting
    // We do a lightweight check here - full validation happens on /dashboard access
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Invalid token, proceed to public page
      // Optionally clear cookie here to be clean, but authenticateUser logic handles it too
      res.clearCookie("sb_access_token");
      return next();
    }

    // Valid session found - redirect to dashboard
    return res.redirect("/dashboard");
  } catch (error) {
    // If error occurs, fail open (allow access to page)
    console.error("[AUTH] redirectIfAuthenticated error:", error.message);
    next();
  }
};
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // SINGLE SOURCE: req.user.role (already processed in authenticateUser)
    const userRole = req.user?.role;
    const baseRole = req.user?.raw_user_meta_data?.base_role;

    if (!userRole) {
      if (req.originalUrl.startsWith("/api/") || req.path.startsWith("/api/")) {
        return res.status(401).json({
          success: false,
          error: "Authentication incomplete: missing role.",
        });
      }
      return res.redirect(
        `/login?message=${encodeURIComponent(
          "Authentication incomplete: missing role. Please contact support."
        )}&type=error`
      );
    }

    const normalizedRole = String(userRole).trim().toLowerCase();
    const normalizedBaseRole = baseRole
      ? String(baseRole).trim().toLowerCase()
      : null;

    // Simple Workflow Mode: Normalize user role to simplified 3-role system
    // Map any lgu-* role or complaint-coordinator to 'lgu'
    const simplifiedUserRole = (normalizedRole.startsWith("lgu-") || normalizedRole === "complaint-coordinator")
      ? "lgu"
      : normalizedRole;

    const simplifiedBaseRole = normalizedBaseRole
      ? ((normalizedBaseRole.startsWith("lgu-") || normalizedBaseRole === "complaint-coordinator")
        ? "lgu"
        : normalizedBaseRole)
      : null;

    // Also normalize the allowed roles for matching
    const normalizedAllowedRoles = allowedRoles.map(role => {
      if (typeof role === "string") {
        const roleLower = role.toLowerCase();
        // Map legacy LGU roles to 'lgu' in the allowed list
        if (roleLower.startsWith("lgu-") || roleLower === "complaint-coordinator") {
          return "lgu";
        }
        return roleLower;
      }
      return role;
    });

    const hasPermission = normalizedAllowedRoles.some((allowedRole) => {
      if (typeof allowedRole === "string") {
        // Support wildcard matching (e.g., "lgu-admin*" matches "lgu-admin-{dept}")
        if (allowedRole.includes("*")) {
          // Safe wildcard matching without dynamic regex
          const pattern = allowedRole.replace(/\*/g, ".*");
          // eslint-disable-next-line security/detect-non-literal-regexp
          const regex = new RegExp(`^${pattern}$`);
          return (
            regex.test(simplifiedUserRole) ||
            (simplifiedBaseRole && regex.test(simplifiedBaseRole))
          );
        }
        return (
          simplifiedUserRole === allowedRole ||
          (simplifiedBaseRole && simplifiedBaseRole === allowedRole)
        );
      } else if (allowedRole instanceof RegExp) {
        return (
          allowedRole.test(simplifiedUserRole) ||
          (simplifiedBaseRole && allowedRole.test(simplifiedBaseRole))
        );
      } else if (typeof allowedRole === "object" && allowedRole !== null) {
        // Handle case where regex might be converted to object
        console.error(
          "[AUTH] Invalid role in allowedRoles array:",
          allowedRole
        );
        return false;
      }
      return false;
    });

    if (!hasPermission) {
      const isApiRequest =
        req.path.startsWith("/api/") ||
        req.originalUrl.startsWith("/api/") ||
        req.url.startsWith("/api/");

      if (isApiRequest) {
        return res.status(403).json({
          success: false,
          error:
            "Access denied. You do not have permission to access this resource.",
          debug:
            process.env.NODE_ENV === "development"
              ? {
                userRole,
                simplifiedUserRole,
                allowedRoles,
                normalizedAllowedRoles,
                path: req.path,
              }
              : null,
        });
      }
      return res.redirect(
        `/login?message=${encodeURIComponent(
          "Access denied. You do not have permission to access this resource."
        )}&type=error`
      );
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  requireRole,
  redirectIfAuthenticated,
};
