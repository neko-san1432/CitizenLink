const express = require("express");

const router = express.Router();
const LguOfficerController = require("../controllers/LguOfficerController");
const { authenticateUser, requireRole } = require("../middleware/auth");

// Create controller instance
const lguOfficerController = new LguOfficerController();
// All routes require authentication and LGU officer role
router.use(authenticateUser);
router.use((req, res, next) => {
  // console.log removed for security
  next();
});
router.use(requireRole(["lgu"])); // Simplified role requirement
// Get assigned tasks for officer
router.get("/assigned-tasks", lguOfficerController.getAssignedTasks.bind(lguOfficerController));
// Mark complaint as resolved
router.post("/complaints/:complaintId/resolve", lguOfficerController.markAsResolved.bind(lguOfficerController));
// Get all tasks assigned to the officer
router.get("/my-tasks", lguOfficerController.getMyTasks.bind(lguOfficerController));
// Update task status
router.put("/tasks/:assignmentId/status", lguOfficerController.updateTaskStatus.bind(lguOfficerController));
// Add progress update to a task
router.post("/tasks/:assignmentId/update", lguOfficerController.addProgressUpdate.bind(lguOfficerController));
// Get officer statistics
router.get("/statistics", lguOfficerController.getStatistics.bind(lguOfficerController));
// Get officer activities
router.get("/activities", lguOfficerController.getActivities.bind(lguOfficerController));
// Get department updates
router.get("/updates", lguOfficerController.getUpdates.bind(lguOfficerController));
// Get tasks (alias for my-tasks)
router.get("/tasks", lguOfficerController.getMyTasks.bind(lguOfficerController));

module.exports = router;
