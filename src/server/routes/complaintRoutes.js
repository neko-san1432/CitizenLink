const express = require("express");
const multer = require("multer");
const ComplaintController = require("../controllers/ComplaintController");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");
const { complaintLimiter, _uploadLimiter } = require("../middleware/rateLimiting");
const { ErrorHandler } = require("../middleware/errorHandler");
const { validate, schemas } = require("../middleware/validation");

const router = express.Router();
const complaintController = new ComplaintController();
// Helper to wrap controller methods with error handling and context binding
const wrap = (method) => ErrorHandler.asyncWrapper(method.bind(complaintController));

// Configure multer to handle both files and form fields
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  }
}).fields([
  { name: "evidenceFiles", maxCount: 5 },
  { name: "_csrf", maxCount: 1 }
]);

router.post("/",
  authenticateUser,
  complaintLimiter,
  upload,
  csrfProtection,
  validate(schemas.createComplaint),
  wrap(complaintController.createComplaint)
);

router.get("/my",
  authenticateUser,
  requireRole(["citizen"]),
  wrap(complaintController.getMyComplaints)
);

router.get("/my-statistics",
  authenticateUser,
  requireRole(["citizen"]),
  wrap(complaintController.getMyStatistics)
);

router.get("/stats",
  authenticateUser,
  requireRole([/^lgu-/, "super-admin", "complaint-coordinator"]),
  wrap(complaintController.getComplaintStats)
);

router.get("/locations",
  authenticateUser,
  requireRole([/^lgu-/, "super-admin", "complaint-coordinator"]),
  wrap(complaintController.getComplaintLocations)
);

router.get("/",
  authenticateUser,
  requireRole([/^lgu-/, "super-admin"]),
  wrap(complaintController.getAllComplaints)
);

router.get("/:complaintId/evidence",
  authenticateUser,
  requireRole(["citizen", "coordinator", "lgu-admin", "lgu-officer", "hr", "super-admin"]),
  wrap(complaintController.getComplaintEvidence)
);

router.get("/:id",
  authenticateUser,
  wrap(complaintController.getComplaintById)
);

router.patch("/:id/status",
  authenticateUser,
  requireRole([/^lgu-/, "super-admin"]),
  requireRole([/^lgu-/, "super-admin"]),
  validate(schemas.updateStatus),
  wrap(complaintController.updateComplaintStatus)
);

// Human confirmation workflow transitions (officer -> admin -> citizen)
router.patch("/:id/transition",
  authenticateUser,
  requireRole([/^lgu-/, "super-admin", "citizen"]),
  upload, // allow evidence on transition
  wrap(complaintController.transitionStatus)
);

router.patch("/:id/assign-coordinator",
  authenticateUser,
  requireRole(["lgu-admin", "super-admin"]),
  requireRole(["lgu-admin", "super-admin"]),
  validate(schemas.assignCoordinator),
  wrap(complaintController.assignCoordinator)
);

router.patch("/:id/transfer",
  authenticateUser,
  requireRole(["lgu-admin", "super-admin"]),
  requireRole(["lgu-admin", "super-admin"]),
  validate(schemas.transferComplaint),
  wrap(complaintController.transferComplaint)
);

// Citizen-specific endpoints
router.post("/:id/cancel",
  authenticateUser,
  requireRole(["citizen"]),
  requireRole(["citizen"]),
  validate(schemas.cancelComplaint),
  wrap(complaintController.cancelComplaint)
);

router.post("/:id/remind",
  authenticateUser,
  requireRole(["citizen"]),
  requireRole(["citizen"]),
  validate(schemas.sendReminder),
  wrap(complaintController.sendReminder)
);

router.post("/:id/confirm-resolution",
  authenticateUser,
  requireRole(["citizen"]),
  requireRole(["citizen"]),
  validate(schemas.confirmResolution),
  wrap(complaintController.confirmResolution)
);

// Configure multer for completion evidence uploads
const completionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  }
}).fields([
  { name: "completionEvidence", maxCount: 5 }
]);

// LGU Officer/Admin endpoints for assignment completion
// Admins can also complete assignments they've created
router.post("/:id/mark-complete",
  authenticateUser,
  requireRole(["lgu", /^lgu-(?!hr)/]), // Allow both officers and admins
  completionUpload,
  wrap(complaintController.markAssignmentComplete)
);

// Get confirmation message for any user
router.get("/:id/confirmation-message",
  authenticateUser,
  wrap(complaintController.getConfirmationMessage)
);

// False complaint endpoints (coordinator only)
router.post("/:id/mark-false",
  authenticateUser,
  requireRole(["complaint-coordinator"]),
  requireRole(["complaint-coordinator"]),
  validate(schemas.markAsFalse),
  wrap(complaintController.markAsFalseComplaint)
);

router.post("/:id/mark-duplicate",
  authenticateUser,
  requireRole(["complaint-coordinator"]),
  requireRole(["complaint-coordinator"]),
  validate(schemas.markAsDuplicate),
  wrap(complaintController.markAsDuplicate)
);

router.get("/false-reports",
  authenticateUser,
  requireRole(["complaint-coordinator", "super-admin"]),
  wrap(complaintController.getFalseComplaints)
);

router.get("/false-reports/statistics",
  authenticateUser,
  requireRole(["complaint-coordinator", "super-admin"]),
  wrap(complaintController.getFalseComplaintStatistics)
);

module.exports = router;
