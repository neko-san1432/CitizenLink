/**
 * LGU Admin Routes
 * Routes for department-specific admin operations
 */

const express = require('express');
const router = express.Router();
const LguAdminController = require('../controllers/LguAdminController');
const { authenticateUser, requireRole } = require('../middleware/auth');

// Create controller instance
const lguAdminController = new LguAdminController();

// All routes require authentication and LGU Admin role
router.use(authenticateUser);
router.use(requireRole(['lgu-admin', /^lgu-admin/])); // Match lgu-admin and lgu-admin-* roles

// Get department queue
router.get('/department-queue', lguAdminController.getDepartmentQueue.bind(lguAdminController));

// Get department assignments
router.get('/department-assignments', lguAdminController.getDepartmentAssignments.bind(lguAdminController));

// Get department officers
router.get('/department-officers', lguAdminController.getDepartmentOfficers.bind(lguAdminController));

// Assign complaint to officer
router.post('/assign-complaint', lguAdminController.assignComplaint.bind(lguAdminController));

// Assign complaint to officer (new endpoint)
router.post('/complaints/:complaintId/assign', lguAdminController.assignToOfficer.bind(lguAdminController));

module.exports = router;
