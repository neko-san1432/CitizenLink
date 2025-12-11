const express = require('express');
const router = express.Router();
const complianceController = require('../controllers/ComplianceController');
const { authenticateUser } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiting');
const { ErrorHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/compliance/export
 * @desc    Export user data (GDPR Right to Data Portability)
 * @access  Private
 */
router.get('/export',
  authenticateUser,
  authLimiter,
  ErrorHandler.asyncWrapper((req, res) => complianceController.exportUserData(req, res))
);

/**
 * @route   DELETE /api/compliance/delete
 * @desc    Delete user data (GDPR Right to Deletion/Erasure)
 * @access  Private
 */
router.delete('/delete',
  authenticateUser,
  authLimiter,
  ErrorHandler.asyncWrapper((req, res) => complianceController.deleteUserData(req, res))
);

/**
 * @route   GET /api/compliance/requests
 * @desc    Get user's data requests history
 * @access  Private
 */
router.get('/requests',
  authenticateUser,
  authLimiter,
  ErrorHandler.asyncWrapper((req, res) => complianceController.getUserDataRequests(req, res))
);

module.exports = router;


