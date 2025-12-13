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

module.exports = router;
