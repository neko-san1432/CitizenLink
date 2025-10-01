const path = require('path');
const Database = require('../config/database');
const database = new Database();

const supabase = database.getClient();

const authenticateUser = async (req, res, next) => {
  try {
    const token =
      req.cookies?.sb_access_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      console.log("[AUTH] No token found");
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: "No authentication token",
        });
      }
      return res.redirect('/login?message=' + encodeURIComponent('Please login first') + '&type=error');
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log(
        "[AUTH] Token invalid or expired:",
        error?.message || "No user"
      );
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired token",
        });
      }
      return res.redirect('/login?message=' + encodeURIComponent('Your session has expired. Please login again') + '&type=error');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH] Authentication error:", error.message);
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }
    return res.redirect('/login?message=' + encodeURIComponent('Authentication failed. Please try again') + '&type=error');
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const rawRole = req.user?.user_metadata?.role;
    const userRole = (rawRole == null ? "" : String(rawRole))
      .trim()
      .toLowerCase();

    if (!userRole) {
      console.log("[AUTH] No user role found");
      return res.status(404).sendFile(path.join(__dirname, "../../views/pages/404.html"));
    }

    const hasPermission = allowedRoles.some((allowedRole) => {
      if (typeof allowedRole === "string") {
        return userRole === allowedRole;
      } else if (allowedRole instanceof RegExp) {
        return allowedRole.test(userRole);
      }
      return false;
    });

    if (!hasPermission) {
      console.log(`[AUTH] Permission denied for role: ${userRole}`);
      return res.status(404).sendFile(path.join(__dirname, "../../views/pages/404.html"));
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  requireRole
};
