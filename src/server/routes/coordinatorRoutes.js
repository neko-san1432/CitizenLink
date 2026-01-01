const express = require("express");
const CoordinatorController = require("../controllers/CoordinatorController");
const { authenticateUser } = require("../middleware/auth");

const router = express.Router();
const coordinatorController = new CoordinatorController();
// Middleware to check if user is a coordinator
// For now, we'll let any authenticated user access (can be restricted later)
const requireCoordinator = (req, res, next) => {
  if (req.user && req.user.role === "complaint-coordinator") {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Coordinator role required." });
  }
};

/**
 * Coordinator Dashboard
 */
router.get("/dashboard",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.getDashboard(req, res)
);
/**
 * Check coordinator status
 */
router.get("/status",
  authenticateUser,
  (req, res) => coordinatorController.checkStatus(req, res)
);
/**
 * Review Queue
 */
router.get("/review-queue",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.getReviewQueue(req, res)
);
router.get("/review-queue/:id",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.getComplaintForReview(req, res)
);
router.post("/review-queue/:id/decide",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.processDecision(req, res)
);
/**
 * Bulk Operations
 */
router.post("/bulk-assign",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.bulkAssign(req, res)
);
/**
 * Cluster Detection
 */
router.post("/detect-clusters",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.detectClusters(req, res)
);
/**
 * Rejected Complaints
 */
router.get("/rejected",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.getRejectedComplaints(req, res)
);
/**
 * Barangay Insights
 */
router.get("/insights",
  authenticateUser,
  requireCoordinator,
  (req, res) => coordinatorController.getBarangayInsights(req, res)
);

module.exports = router;
