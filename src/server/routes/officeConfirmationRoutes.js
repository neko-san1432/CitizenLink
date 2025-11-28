const express = require('express');
const router = express.Router();
const OfficeConfirmationController = require('../controllers/OfficeConfirmationController');
const { authenticateUser, requireRole } = require('../middleware/auth');

const controller = new OfficeConfirmationController();

// Middleware to ensure user is authenticated
router.use(authenticateUser);

// Get pending confirmations for the current user
router.get('/pending', (req, res) => controller.getPending(req, res));

// Get details of a specific assignment
router.get('/:id', (req, res) => controller.getDetails(req, res));

// Confirm or decline an assignment
router.post('/:id/confirm', (req, res) => controller.confirm(req, res));

module.exports = router;
