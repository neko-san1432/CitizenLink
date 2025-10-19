const express = require('express');
const router = express.Router();
const LguOfficerController = require('../controllers/LguOfficerController');
const { authenticateUser, requireRole } = require('../middleware/auth');

// All routes require authentication and LGU officer role
router.use(authenticateUser);
router.use(requireRole([/^lgu-(?!admin|hr)/])); // Matches lgu-wst, lgu-engineering, etc.

// Get all tasks assigned to the officer
router.get('/my-tasks', LguOfficerController.getMyTasks);

// Update task status
router.put('/tasks/:assignmentId/status', LguOfficerController.updateTaskStatus);

// Add progress update to a task
router.post('/tasks/:assignmentId/update', LguOfficerController.addProgressUpdate);

module.exports = router;
