const express = require("express");
const SuperAdminController = require("../controllers/SuperAdminController");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validation");
const { csrfProtection } = require("../middleware/csrf");

const router = express.Router();
const superAdminController = new SuperAdminController();

// SEC-16 FIX: CSRF protection on all state-changing routes
router.use(csrfProtection);
// All routes require Super Admin role
const requireSuperAdmin = requireRole(["super-admin"]);
/**
 * Dashboard
 */
router.get("/dashboard", authenticateUser, requireSuperAdmin, (req, res) =>
  superAdminController.getDashboard(req, res)
);
/**
 * User Management — SEC-19: Added Joi validation
 */
router.post("/role-swap", authenticateUser, requireSuperAdmin, validate(schemas.roleSwap), (req, res) =>
  superAdminController.roleSwap(req, res)
);
/**
 * Ban/Unban Users — SEC-19: Added Joi validation
 */
router.post("/ban-user", authenticateUser, requireSuperAdmin, validate(schemas.banUser), (req, res) =>
  superAdminController.banUser(req, res)
);
router.post("/unban-user", authenticateUser, requireSuperAdmin, validate(schemas.unbanUser), (req, res) =>
  superAdminController.unbanUser(req, res)
);
// User listing and details for Super Admin
router.get("/users", authenticateUser, requireSuperAdmin, async (req, res) => {
  try {
    const userService = require("../services/user/UserService");

    const { search, barangay, role, department, status, page, limit } =
      req.query;
    const filters = { role, department, status, search, includeInactive: true };
    const pagination = {
      page: page ? Number.parseInt(page) : 1,
      limit: limit ? Number.parseInt(limit) : 20,
    };
    const result = await userService.getUsers(filters, pagination);
    const filteredUsers = barangay
      ? (result.users || []).filter(
        (u) =>
          (u.address?.barangay || "").toLowerCase() ===
            String(barangay).toLowerCase()
      )
      : result.users;
    return res.json({
      success: true,
      data: filteredUsers,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[SUPERADMIN_ROUTES] users list error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch users",
    });
  }
});
router.get(
  "/users/:id",
  authenticateUser,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const userService = require("../services/user/UserService");

      const user = await userService.getUserById(req.params.id);
      if (!user)
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      return res.json({ success: true, data: user });
    } catch (error) {
      console.error("[SUPERADMIN_ROUTES] user detail error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch user",
      });
    }
  }
);
router.get(
  "/users/:id/complaints",
  authenticateUser,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const ComplaintService = require("../services/ComplaintService");

      const service = new ComplaintService();
      const options = {
        page: req.query.page ? Number.parseInt(req.query.page) : 1,
        limit: req.query.limit ? Number.parseInt(req.query.limit) : 10,
        status: req.query.status,
        type: req.query.type,
      };
      const result = await service.getUsercomplaints(req.params.id, options);
      return res.json({
        success: true,
        data: result.complaints,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      console.error("[SUPERADMIN_ROUTES] user complaints error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch complaints",
      });
    }
  }
);
/**
 * department Transfers — SEC-19: Added Joi validation
 */
router.post(
  "/transfer-department",
  authenticateUser,
  requireSuperAdmin,
  validate(schemas.transferdepartment),
  (req, res) => superAdminController.transferdepartment(req, res)
);
/**
 * Citizen Assignment — SEC-19: Added Joi validation
 */
router.post(
  "/assign-citizen",
  authenticateUser,
  requireSuperAdmin,
  validate(schemas.assignCitizen),
  (req, res) => superAdminController.assignCitizen(req, res)
);
/**
 * System Logs
 */
router.get("/logs", authenticateUser, requireSuperAdmin, (req, res) =>
  superAdminController.getLogs(req, res)
);
/**
 * System Statistics
 */
router.get("/statistics", authenticateUser, requireSuperAdmin, (req, res) =>
  superAdminController.getStatistics(req, res)
);
/**
 * Latest Registered Users
 */
router.get("/latest-users", authenticateUser, requireSuperAdmin, (req, res) =>
  superAdminController.getLatestUsers(req, res)
);
/**
 * Terminal/Console Logs
 */
router.get("/terminal-logs", authenticateUser, requireSuperAdmin, (req, res) =>
  superAdminController.getTerminalLogs(req, res)
);
/**
 * Role Distribution
 */
router.get(
  "/role-distribution",
  authenticateUser,
  requireSuperAdmin,
  (req, res) => superAdminController.getRoleDistribution(req, res)
);
/**
 * Clustering Status and Management
 */
router.get(
  "/clustering/status",
  authenticateUser,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const clusteringManager = require("../utils/clusteringManager");
      const scheduler = clusteringManager.getScheduler();

      if (!scheduler) {
        return res.json({
          success: false,
          error: "Clustering scheduler not initialized",
        });
      }

      const status = scheduler.getStatus();
      return res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error("[SUPERADMIN_ROUTES] Clustering status error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to get clustering status",
      });
    }
  }
);
router.post(
  "/clustering/trigger",
  authenticateUser,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const clusteringManager = require("../utils/clusteringManager");
      const scheduler = clusteringManager.getScheduler();

      if (!scheduler) {
        return res.status(500).json({
          success: false,
          error: "Clustering scheduler not initialized",
        });
      }

      const result = await scheduler.triggerManual();
      return res.json({
        success: result.success,
        data: result,
        message: result.success
          ? `Clustering completed: ${result.clustersFound} clusters found`
          : `Clustering failed: ${result.error}`,
      });
    } catch (error) {
      console.error(
        "[SUPERADMIN_ROUTES] Manual clustering trigger error:",
        error
      );
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to trigger clustering",
      });
    }
  }
);

router.get("/growth-trends", authenticateUser, requireSuperAdmin, (req, res) =>
  superAdminController.getGrowthTrends(req, res)
);

module.exports = router;
