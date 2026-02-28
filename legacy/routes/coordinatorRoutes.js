const express = require("express");
const router = express.Router();
const { authenticateUser, requireRole } = require("../middleware/auth");
const ComplaintController = require("../controllers/ComplaintController");
const complaintController = new ComplaintController();
const wrapper = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware: All routes require authentication and coordinator role
router.use(authenticateUser);
// Allow super-admin, lgu-admin, and lgu (simple mode) to access these routes
router.use(requireRole(["complaint-coordinator", "super-admin", "lgu-admin", "lgu"]));

// Dashboard Stats
router.get(
    "/start-counts",
    wrapper(complaintController.getCoordinatorStats.bind(complaintController))
);

// Review Queue
router.get(
    "/review-queue",
    wrapper(complaintController.getReviewQueue.bind(complaintController))
);

// Barangay Insights for Prioritization Widget
router.get(
    "/barangay-insights",
    wrapper(complaintController.getBarangayInsights.bind(complaintController))
);

module.exports = router;
