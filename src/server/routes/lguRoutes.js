const express = require("express");
const lguDashboardController = require("../controllers/LguDashboardController");
const LguOfficerController = require("../controllers/LguOfficerController");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");

const router = express.Router();
const lguOfficerController = new LguOfficerController();

// All LGU routes require authentication
router.use(authenticateUser);
router.use(requireRole(["lgu", "super-admin"]));

// --- Administrative / Department-wide Routes ---
router.get("/dashboard-stats", (req, res) => lguDashboardController.getDashboardStats(req, res));
router.get("/department-assignments", (req, res) => lguDashboardController.getDepartmentAssignments(req, res));

// --- Personal / Task-specific Routes (formerly Officer) ---
router.use(csrfProtection); // Added for state-changing routes

router.get("/assigned-tasks", lguOfficerController.getAssignedTasks.bind(lguOfficerController));
router.get("/my-tasks", lguOfficerController.getMyTasks.bind(lguOfficerController));
router.get("/tasks", lguOfficerController.getMyTasks.bind(lguOfficerController));
router.get("/statistics", lguOfficerController.getStatistics.bind(lguOfficerController));
router.get("/activities", lguOfficerController.getActivities.bind(lguOfficerController));
router.get("/updates", lguOfficerController.getUpdates.bind(lguOfficerController));

router.post("/complaints/:complaintId/resolve", lguOfficerController.markAsResolved.bind(lguOfficerController));
router.post("/complaints/:complaintId/update-status", lguOfficerController.updatecomplaintStatus.bind(lguOfficerController));
router.put("/tasks/:assignmentId/status", lguOfficerController.updateTaskStatus.bind(lguOfficerController));
router.post("/tasks/:assignmentId/update", lguOfficerController.addProgressUpdate.bind(lguOfficerController));

module.exports = router;
