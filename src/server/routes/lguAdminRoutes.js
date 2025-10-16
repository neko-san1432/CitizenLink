/**
 * LGU Admin Routes
 * Routes for department-specific admin operations
 */

const express = require('express');
const router = express.Router();
const LguAdminController = require('../controllers/LguAdminController');
const { authenticateUser, requireRole } = require('../middleware/auth');

// All routes require authentication and LGU Admin role
router.use(authenticateUser);
router.use(requireRole(['lgu-admin', /^lgu-admin/])); // Match lgu-admin and lgu-admin-* roles

// Get department assignments
router.get('/department-assignments', LguAdminController.getDepartmentAssignments.bind(LguAdminController));

// Get department officers
router.get('/department-officers', LguAdminController.getDepartmentOfficers.bind(LguAdminController));

// Assign complaint to officer
router.post('/assign-complaint', LguAdminController.assignComplaint.bind(LguAdminController));

module.exports = router;

