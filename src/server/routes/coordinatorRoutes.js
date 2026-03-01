const express = require("express");
const { authenticateUser, requireRole } = require("../middleware/auth");
const ComplaintController = require("../controllers/ComplaintController");

const router = express.Router();
const complaintController = new ComplaintController();

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// All coordinator endpoints require a valid session and an appropriate role
router.use(authenticateUser);
router.use(requireRole(["complaint-coordinator", "super-admin", "lgu-admin", "lgu"]));

// GET /api/coordinator/barangay-insights
router.get("/barangay-insights", wrap(complaintController.getBarangayInsights.bind(complaintController)));

// GET /api/coordinator/start-counts
router.get("/start-counts", wrap(complaintController.getCoordinatorStats.bind(complaintController)));

// GET /api/coordinator/review-queue
router.get("/review-queue", wrap(complaintController.getReviewQueue.bind(complaintController)));

module.exports = router;
