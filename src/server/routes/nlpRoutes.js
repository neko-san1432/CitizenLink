const express = require("express");
const router = express.Router();
const nlpProposalController = require("../controllers/nlpProposalController");
const nlpManagementController = require("../controllers/nlpManagementController");
const nlpPendingReviewsController = require("../controllers/nlpPendingReviewsController");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");

// SEC-16 FIX: CSRF protection on all state-changing routes
router.use(csrfProtection);

// ============ HITL PENDING REVIEWS (Auto-Queue) ============

// Get pending reviews count
router.get(
  "/pending-reviews/count",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpPendingReviewsController.getCount
);

// Get all pending reviews
router.get(
  "/pending-reviews",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpPendingReviewsController.getAll
);

// Batch queue multiple items for review (used by analytics scan)
// IMPORTANT: This must come BEFORE :id routes to prevent Express matching "batch" as an id
router.post(
  "/pending-reviews/batch",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpPendingReviewsController.batchQueue
);

// Resolve a pending review (train keyword)
router.post(
  "/pending-reviews/:id/resolve",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpPendingReviewsController.resolve
);

// Dismiss a pending review
router.post(
  "/pending-reviews/:id/dismiss",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpPendingReviewsController.dismiss
);

// ============ PROPOSAL WORKFLOW ROUTES ============

// Get proposals (All authenticated staff can view status, but filtering might be useful)
router.get(
  "/proposals",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpProposalController.getProposals
);

// Get Stats (Counts)
router.get(
  "/stats",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpProposalController.getStats
);

// Submit Proposal (LGU Admin)
router.post(
  "/proposals",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  nlpProposalController.createProposal
);

// Approve by Coordinator
router.post(
  "/proposals/:id/approve-coordinator",
  authenticateUser,
  requireRole(["lgu"]),
  nlpProposalController.approveByCoordinator
);

// Approve by Super Admin (Final)
router.post(
  "/proposals/:id/approve-admin",
  authenticateUser,
  requireRole(["super-admin"]),
  nlpProposalController.approveBySuperAdmin
);

// Reject Proposal (Both can reject)
router.post(
  "/proposals/:id/reject",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  nlpProposalController.rejectProposal
);

// ============ SUPER ADMIN DIRECT MANAGEMENT ROUTES ============

// Complete Dictionary (for simulation engine) — SEC-07 FIX: require auth
router.get(
  "/dictionary",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  nlpManagementController.getCompleteDictionary
);

// Management Stats
router.get(
  "/management/stats",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.getManagementStats
);

// Keywords CRUD
router.get(
  "/keywords",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.getKeywords
);

router.post(
  "/keywords",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.addKeyword
);

router.put(
  "/keywords/:id",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.updateKeyword
);

router.delete(
  "/keywords/:id",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.deleteKeyword
);

// Categories CRUD
router.get(
  "/categories",
  authenticateUser,
  requireRole(["super-admin"]),
  nlpManagementController.getCategories
);

router.post(
  "/categories",
  authenticateUser,
  requireRole(["super-admin"]),
  nlpManagementController.addCategory
);

router.delete(
  "/categories/:category",
  authenticateUser,
  requireRole(["super-admin"]),
  nlpManagementController.deleteCategory
);

// Anchors CRUD
router.get(
  "/anchors",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.getAnchors
);

router.post(
  "/anchors",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.addAnchor
);

router.delete(
  "/anchors/:id",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.deleteAnchor
);

// Metaphors CRUD
router.get(
  "/metaphors",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.getMetaphors
);

router.post(
  "/metaphors",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.addMetaphor
);

router.delete(
  "/metaphors/:id",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.deleteMetaphor
);

// Dictionary Rules CRUD
router.get(
  "/dictionary-rules",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.getDictionaryRules
);

router.post(
  "/dictionary-rules",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.addDictionaryRule
);

router.delete(
  "/dictionary-rules/:id",
  authenticateUser,
  requireRole(["super-admin", "lgu"]),
  nlpManagementController.deleteDictionaryRule
);

module.exports = router;

