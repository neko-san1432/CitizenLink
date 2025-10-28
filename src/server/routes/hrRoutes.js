/**
 * HR Routes
 * Handles HR-specific operations
 */

const express = require('express');
const router = express.Router();
const HRController = require('../controllers/HRController');
const { authenticateUser, requireRole } = require('../middleware/auth');

// Initialize controller
let hrController;
try {
  hrController = new HRController();
  // console.log removed for security
} catch (error) {
  console.error('[HR-ROUTES] Error initializing HR Controller:', error);
  throw error;
}

// Test route (no auth required)
router.get('/test', (req, res) => {
  // console.log removed for security
  res.json({ success: true, message: 'HR routes are working!' });
});

// All other routes require authentication
router.use(authenticateUser);

// Generate signup link
router.post('/signup-links',
  requireRole(['lgu-hr', 'super-admin', 'complaint-coordinator']),
  (req, res) => hrController.generateSignupLink(req, res)
);

// Get signup links
router.get('/signup-links',
  requireRole(['lgu-hr', 'super-admin', 'complaint-coordinator']),
  (req, res) => hrController.getSignupLinks(req, res)
);

// Deactivate signup link
router.delete('/signup-links/:linkId',
  requireRole(['lgu-hr', 'super-admin', 'complaint-coordinator']),
  (req, res) => hrController.deactivateSignupLink(req, res)
);

// Get HR dashboard
router.get('/dashboard',
  requireRole(['lgu-hr', 'super-admin', 'complaint-coordinator']),
  (req, res) => hrController.getDashboard(req, res)
);

// Public endpoint for validating signup codes
router.get('/validate-signup-code/:code',
  (req, res) => hrController.validateSignupCode(req, res)
);

// Role management actions
router.post('/promote-to-officer',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.promoteToOfficer(req, res)
);

router.post('/promote-to-admin',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.promoteToAdmin(req, res)
);

router.post('/demote-to-officer',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.demoteToOfficer(req, res)
);

router.post('/strip-titles',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.stripTitles(req, res)
);

router.post('/assign-department',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.assignDepartment(req, res)
);

// User listing and details (search + barangay filter)
router.get('/users',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.getUsers(req, res)
);

router.get('/users/:id',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.getUserDetails(req, res)
);

router.get('/users/:id/complaints',
  requireRole(['lgu-hr', 'super-admin']),
  (req, res) => hrController.getUserComplaints(req, res)
);

module.exports = router;