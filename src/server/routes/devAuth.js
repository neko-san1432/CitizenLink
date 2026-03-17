const express = require("express");
const Database = require("../config/database");
const config = require("../../../config/app");
const devAccounts = require("../../../config/devAccounts");
const { getCookieOptions } = require("../utils/authUtils");

const supabase = Database.getClient();
const router = express.Router();

const ALLOWED_ROLES = ["citizen", "lgu", "superAdmin"];

router.post("/login", async (req, res) => {
  try {
    if (config.env !== "development") {
      return res.status(403).json({
        success: false,
        error: "Dev login only available in development mode"
      });
    }

    const { role } = req.body;

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}`
      });
    }

    const credentials = devAccounts[role];

    if (!credentials || !credentials.email || !credentials.password) {
      return res.status(400).json({
        success: false,
        error: `Dev account for '${role}' not configured. Please set DEV_${role.toUpperCase()}_EMAIL and DEV_${role.toUpperCase()}_PASSWORD in .env`
      });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        error: `Dev login failed: ${authError.message}`
      });
    }

    const user = authData.user;
    const metadata = user.user_metadata || {};
    const userRole = metadata.role || "citizen";

    const allowedRoles = ["citizen", "super-admin", "lgu"];
    const legacyLguRoles = ["lgu-admin", "lgu-hr", "lgu-officer", "complaint-coordinator"];
    const normalizedRole = legacyLguRoles.includes(userRole) || userRole.startsWith("lgu-") ? "lgu" : userRole;

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(401).json({
        success: false,
        error: `Role '${userRole}' is not allowed. Use a user with citizen, lgu, or super-admin role.`
      });
    }

    const cookieOptions = getCookieOptions(false);
    res.cookie("sb_access_token", authData.session.access_token, cookieOptions);

    console.log(`[DEV LOGIN] Logged in as ${role} (${credentials.email})`);

    res.json({
      success: true,
      redirect: "/dashboard",
      user: {
        id: user.id,
        email: user.email,
        role: normalizedRole
      }
    });

  } catch (error) {
    console.error("[DEV LOGIN] Error:", error);
    res.status(500).json({
      success: false,
      error: "Dev login failed: " + error.message
    });
  }
});

module.exports = router;
