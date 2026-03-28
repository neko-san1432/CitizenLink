const express = require("express");
const lguDashboardController = require("../controllers/LguDashboardController");
const { authenticateUser, requireRole } = require("../middleware/auth");

const router = express.Router();

// All LGU Admin routes require authentication and appropriate role
router.use(authenticateUser);
router.use(requireRole(["lgu", "super-admin"])); // Allow both, logic inside controller handles dept check

/**
 * GET /api/lgu-admin/dashboard-stats
 * Returns statistics, charts, and recent activity for the department dashboard
 */
router.get("/dashboard-stats", (req, res) => lguDashboardController.getDashboardStats(req, res));
router.get("/department-assignments", (req, res) => lguDashboardController.getDepartmentAssignments(req, res));

module.exports = router;
