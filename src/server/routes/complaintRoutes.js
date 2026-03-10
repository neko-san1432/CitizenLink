const express = require("express");
const multer = require("multer");
const ComplaintController = require("../controllers/complaintController");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");
const {
  complaintLimiter,
  _uploadLimiter,
} = require("../middleware/rateLimiting");
const { ErrorHandler } = require("../middleware/errorHandler");
const { validate, schemas } = require("../middleware/validation");

const router = express.Router();
const complaintController = new ComplaintController();
// Helper to wrap controller methods with error handling and context binding
const wrap = (method) =>
  ErrorHandler.asyncWrapper(method.bind(complaintController));

// Configure multer to handle both files and form fields
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "video/mp4",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
}).fields([
  { name: "evidenceFiles", maxCount: 5 },
  { name: "_csrf", maxCount: 1 },
]);

router.get(
  "/check-duplicates",
  authenticateUser,
  wrap(complaintController.checkDuplicates)
);

router.post(
  "/",
  authenticateUser,
  complaintLimiter,
  upload,
  csrfProtection,
  validate(schemas.createcomplaint),
  wrap(complaintController.createcomplaint)
);

router.get(
  "/my",
  authenticateUser,
  requireRole(["citizen"]),
  wrap(complaintController.getMycomplaints)
);

router.get(
  "/my-statistics",
  authenticateUser,
  requireRole(["citizen"]),
  wrap(complaintController.getMyStatistics)
);

router.get(
  "/stats",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.getcomplaintStats)
);

router.get(
  "/locations",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.getcomplaintLocations)
);

router.get(
  "/",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.getAllcomplaints)
);

router.get(
  "/:complaintId/evidence",
  authenticateUser,
  requireRole([
    "citizen",
    "lgu",
    "super-admin",
  ]),
  wrap(complaintController.getcomplaintEvidence)
);

router.get(
  "/:id/history",
  authenticateUser,
  wrap(complaintController.getcomplaintHistory)
);

router.get(
  "/:id",
  authenticateUser,
  wrap(complaintController.getcomplaintById)
);

router.patch(
  "/:id/status",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  validate(schemas.updateStatus),
  wrap(complaintController.updatecomplaintStatus)
);

router.get(
  "/:id/status",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.getcomplaintStatus)
);

// Human confirmation workflow transitions (officer -> admin -> citizen)
router.patch(
  "/:id/transition",
  authenticateUser,
  requireRole(["lgu", "super-admin", "citizen"]),
  upload, // allow evidence on transition
  wrap(complaintController.transitionStatus)
);

router.patch(
  "/:id/assign-coordinator",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  validate(schemas.assignCoordinator),
  wrap(complaintController.assignCoordinator)
);

router.patch(
  "/:id/transfer",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  validate(schemas.transfercomplaint),
  wrap(complaintController.transfercomplaint)
);


router.post(
  "/:id/remind",
  authenticateUser,
  requireRole(["citizen"]),
  validate(schemas.sendReminder),
  wrap(complaintController.sendReminder)
);

router.post(
  "/:id/confirm-resolution",
  authenticateUser,
  requireRole(["citizen"]),
  validate(schemas.confirmResolution),
  wrap(complaintController.confirmResolution)
);

// Configure multer for completion evidence uploads
const completionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "video/mp4",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
}).fields([{ name: "completionEvidence", maxCount: 5 }]);

// LGU Officer/Admin endpoints for assignment completion
router.post(
  "/:id/mark-complete",
  authenticateUser,
  requireRole(["lgu"]),
  completionUpload,
  wrap(complaintController.markAssignmentComplete)
);

// Get confirmation message for any user
router.get(
  "/:id/confirmation-message",
  authenticateUser,
  wrap(complaintController.getConfirmationMessage)
);

// False complaint endpoints
router.post(
  "/:id/mark-false",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  validate(schemas.markAsFalse),
  wrap(complaintController.markAsFalsecomplaint)
);

// SEC-20 FIX: Add role check to potential-duplicates
router.get(
  "/:id/potential-duplicates",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.getPotentialDuplicatesForId)
);

// SEC-20 FIX: Add role check to bulk-merge
router.post(
  "/:id/bulk-merge",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.bulkMergecomplaints)
);

router.post(
  "/:id/mark-duplicate",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  validate(schemas.markAsDuplicate),
  wrap(complaintController.markAsDuplicate)
);

router.post(
  "/:id/upvote",
  authenticateUser,
  wrap(complaintController.upvotecomplaint)
);

router.get(
  "/false-reports",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.getFalsecomplaints)
);

router.get(
  "/false-reports/statistics",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  wrap(complaintController.getFalsecomplaintStatistics)
);

module.exports = router;
