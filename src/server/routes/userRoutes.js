const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middleware/auth");

/**
 * @route   GET /api/user/role
 * @desc    Get current user's role
 * @access  Private
 */
router.get("/role", authenticateUser, (req, res) => {
  res.json({
    success: true,
    data: {
      role: req.user.role,
      department: req.user.department,
      name: req.user.name,
    },
  });
});

/**
 * @route   GET /api/user/role-info
 * @desc    Get detailed role info and capabilities
 * @access  Private
 */
router.get("/role-info", authenticateUser, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      department: req.user.department,
      base_role: req.user.raw_user_meta_data?.base_role,
      permissions: req.user.app_metadata?.permissions || [],
    },
  });
});

/**
 * @route   POST /api/user/switch-role
 * @desc    Switch user session to citizen mode (temporary)
 * @access  Private
 */
router.post("/switch-role", authenticateUser, async (req, res) => {
  try {
    const RoleManagementService = require("../services/RoleManagementService");
    const roleService = new RoleManagementService();

    // Check if user is allowed to switch
    const currentRole = req.user.role;
    // We can also check raw authenticated role if needed, but req.user.role is populated by auth middleware

    // Check permissions
    const baseRole = req.user.raw_user_meta_data?.base_role;
    const canSwitch =
      roleService.canSwitchToCitizen(currentRole) ||
      (currentRole === "citizen" &&
        baseRole &&
        roleService.canSwitchToCitizen(baseRole));

    if (!canSwitch) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to switch to citizen mode",
      });
    }

    const targetRole = req.body.targetRole;
    const isCitizenMode = targetRole === "citizen";

    // Set cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };

    if (isCitizenMode) {
      res.cookie("app_mode", "citizen_mode", cookieOptions);
    } else {
      res.clearCookie("app_mode");
    }

    const sessionData = await roleService.createCitizenSession(
      req.user.id,
      currentRole
    );

    res.json({
      success: true,
      data: {
        ...sessionData,
        switchedTo: targetRole,
      },
    });
  } catch (error) {
    console.error("[USER ROUTES] Switch role error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to switch role",
    });
  }
});

module.exports = router;
