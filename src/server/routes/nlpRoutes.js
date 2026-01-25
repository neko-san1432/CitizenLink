const express = require("express");
const router = express.Router();
const NlpProposalController = require("../controllers/NlpProposalController");
const NlpManagementController = require("../controllers/NlpManagementController");
const { authenticateUser, requireRole } = require("../middleware/auth");

// ============ PROPOSAL WORKFLOW ROUTES ============

// Get proposals (All authenticated staff can view status, but filtering might be useful)
router.get(
    "/proposals",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpProposalController.getProposals
);

// Get Stats (Counts)
router.get(
    "/stats",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpProposalController.getStats
);

// Submit Proposal (LGU Admin)
router.post(
    "/proposals",
    authenticateUser,
    requireRole(["lgu-admin", "complaint-coordinator", "super-admin"]),
    NlpProposalController.createProposal
);

// Approve by Coordinator
router.post(
    "/proposals/:id/approve-coordinator",
    authenticateUser,
    requireRole(["complaint-coordinator"]),
    NlpProposalController.approveByCoordinator
);

// Approve by Super Admin (Final)
router.post(
    "/proposals/:id/approve-admin",
    authenticateUser,
    requireRole(["super-admin"]),
    NlpProposalController.approveBySuperAdmin
);

// Reject Proposal (Both can reject)
router.post(
    "/proposals/:id/reject",
    authenticateUser,
    requireRole(["complaint-coordinator", "super-admin"]),
    NlpProposalController.rejectProposal
);

// ============ SUPER ADMIN DIRECT MANAGEMENT ROUTES ============

// Complete Dictionary (for simulation engine)
router.get(
    "/dictionary",
    authenticateUser,
    NlpManagementController.getCompleteDictionary
);

// Management Stats
router.get(
    "/management/stats",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.getManagementStats
);

// Keywords CRUD
router.get(
    "/keywords",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.getKeywords
);

router.post(
    "/keywords",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.addKeyword
);

router.delete(
    "/keywords/:id",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.deleteKeyword
);

// Categories CRUD
router.get(
    "/categories",
    authenticateUser,
    requireRole(["super-admin"]),
    NlpManagementController.getCategories
);

router.post(
    "/categories",
    authenticateUser,
    requireRole(["super-admin"]),
    NlpManagementController.addCategory
);

router.delete(
    "/categories/:category",
    authenticateUser,
    requireRole(["super-admin"]),
    NlpManagementController.deleteCategory
);

// Anchors CRUD
router.get(
    "/anchors",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.getAnchors
);

router.post(
    "/anchors",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.addAnchor
);

router.delete(
    "/anchors/:id",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.deleteAnchor
);

// Metaphors CRUD
router.get(
    "/metaphors",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.getMetaphors
);

router.post(
    "/metaphors",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.addMetaphor
);

router.delete(
    "/metaphors/:id",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.deleteMetaphor
);

// Dictionary Rules CRUD
router.get(
    "/dictionary-rules",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.getDictionaryRules
);

router.post(
    "/dictionary-rules",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.addDictionaryRule
);

router.delete(
    "/dictionary-rules/:id",
    authenticateUser,
    requireRole(["super-admin", "lgu-admin", "complaint-coordinator"]),
    NlpManagementController.deleteDictionaryRule
);

module.exports = router;

