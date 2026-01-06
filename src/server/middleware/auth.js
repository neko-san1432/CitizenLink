const Database = require("../config/database");
const {
  validateUserRole,
  extractDepartmentCode,
} = require("../utils/roleValidation");
const {
  extractUserMetadata,
  buildUserObject,
  handleAuthError,
} = require("../utils/authUtils");
const { SWITCHABLE_ROLES } = require("../../shared/constants");

const supabase = Database.getClient();

const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from cookies or headers
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.sb_access_token;

    // Prioritize Authorization header as it contains the most recent token from the client
    const token =
      authHeader?.replace("Bearer ", "") ||
      cookieToken ||
      req.cookies?.sb_access_token_debug;

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

    // Validate token with Supabase
    const {
      data: { user: tokenUser },
      error,
    } = await supabase.auth.getUser(token);

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
    const appMode = req.cookies?.app_mode;
    const realRole = combinedMetadata.role || "citizen";

    if (appMode === "citizen_mode" && SWITCHABLE_ROLES.includes(realRole)) {
      // Override role to citizen, but save original role
      combinedMetadata.base_role = realRole;
      combinedMetadata.role = "citizen";
      combinedMetadata.normalized_role = "citizen";
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

    // Extract department code for LGU roles
    const departmentCode = extractDepartmentCode(userRole);

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

    const hasPermission = allowedRoles.some((allowedRole) => {
      if (typeof allowedRole === "string") {
        // Support wildcard matching (e.g., "lgu-admin*" matches "lgu-admin-{dept}")
        if (allowedRole.includes("*")) {
          // Safe wildcard matching without dynamic regex
          const pattern = allowedRole.replace(/\*/g, ".*");
          // eslint-disable-next-line security/detect-non-literal-regexp
          const regex = new RegExp(`^${pattern}$`);
          return (
            regex.test(normalizedRole) ||
            (normalizedBaseRole && regex.test(normalizedBaseRole))
          );
        }
        return (
          normalizedRole === allowedRole.toLowerCase() ||
          (normalizedBaseRole &&
            normalizedBaseRole === allowedRole.toLowerCase())
        );
      } else if (allowedRole instanceof RegExp) {
        return (
          allowedRole.test(normalizedRole) ||
          (normalizedBaseRole && allowedRole.test(normalizedBaseRole))
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
                  allowedRoles,
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
