const express = require("express");
const router = express.Router();
const OfficeConfirmationController = require("../controllers/officeConfirmationController");
const { authenticateUser, _requireRole } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");

// SEC-16 FIX: CSRF protection on all state-changing routes
router.use(csrfProtection);

const controller = new OfficeConfirmationController();

// Middleware to ensure user is authenticated
router.use(authenticateUser);

// Get pending confirmations for the current user
router.get("/pending", (req, res) => controller.getPending(req, res));

// Get details of a specific assignment
router.get("/:id", (req, res) => controller.getDetails(req, res));

// Confirm or decline an assignment
router.post("/:id/confirm", (req, res) => controller.confirm(req, res));

module.exports = router;
