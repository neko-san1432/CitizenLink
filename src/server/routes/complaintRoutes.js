const express = require('express');
const multer = require('multer');
const ComplaintController = require('../controllers/ComplaintController');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { complaintLimiter, uploadLimiter } = require('../middleware/rateLimiting');

const router = express.Router();
const complaintController = new ComplaintController();
// Configure multer to handle both files and form fields
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
}).fields([
  { name: 'evidenceFiles', maxCount: 5 },
  { name: '_csrf', maxCount: 1 }
]);
router.post('/',
  authenticateUser,
  complaintLimiter,
  upload,
  csrfProtection,
  (req, res) => complaintController.createComplaint(req, res)
);
router.get('/my',
  authenticateUser,
  requireRole(['citizen']),
  (req, res) => complaintController.getMyComplaints(req, res)
);
router.get('/my-statistics',
  authenticateUser,
  requireRole(['citizen']),
  (req, res) => complaintController.getMyStatistics(req, res)
);
router.get('/stats',
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin', 'complaint-coordinator']),
  (req, res) => complaintController.getComplaintStats(req, res)
);
router.get('/locations',
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin', 'complaint-coordinator']),
  (req, res) => complaintController.getComplaintLocations(req, res)
);
router.get('/',
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin']),
  (req, res) => complaintController.getAllComplaints(req, res)
);
router.get('/:complaintId/evidence',
  authenticateUser,
  requireRole(['citizen', 'coordinator', 'lgu-admin', 'lgu-officer', 'hr', 'super-admin']),
  (req, res) => complaintController.getComplaintEvidence(req, res)
);
router.get('/:id',
  authenticateUser,
  (req, res) => complaintController.getComplaintById(req, res)
);
router.patch('/:id/status',
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin']),
  (req, res) => complaintController.updateComplaintStatus(req, res)
);
// Human confirmation workflow transitions (officer -> admin -> citizen)
router.patch('/:id/transition',
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin', 'citizen']),
  upload, // allow evidence on transition
  (req, res) => complaintController.transitionStatus(req, res)
);
router.patch('/:id/assign-coordinator',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => complaintController.assignCoordinator(req, res)
);
router.patch('/:id/transfer',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => complaintController.transferComplaint(req, res)
);
// Citizen-specific endpoints
router.post('/:id/cancel',
  authenticateUser,
  requireRole(['citizen']),
  (req, res) => complaintController.cancelComplaint(req, res)
);
router.post('/:id/remind',
  authenticateUser,
  requireRole(['citizen']),
  (req, res) => complaintController.sendReminder(req, res)
);
router.post('/:id/confirm-resolution',
  authenticateUser,
  requireRole(['citizen']),
  (req, res) => complaintController.confirmResolution(req, res)
);
// Configure multer for completion evidence uploads
const completionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
}).fields([
  { name: 'completionEvidence', maxCount: 5 }
]);
// LGU Officer/Admin endpoints for assignment completion
// Admins can also complete assignments they've created
router.post('/:id/mark-complete',
  authenticateUser,
  requireRole(['lgu', /^lgu-(?!hr)/]), // Allow both officers and admins
  completionUpload,
  (req, res) => complaintController.markAssignmentComplete(req, res)
);
// Get confirmation message for any user
router.get('/:id/confirmation-message',
  authenticateUser,
  (req, res) => complaintController.getConfirmationMessage(req, res)
);
// False complaint endpoints (coordinator only)
router.post('/:id/mark-false',
  authenticateUser,
  requireRole(['complaint-coordinator']),
  (req, res) => complaintController.markAsFalseComplaint(req, res)
);
router.get('/false-reports',
  authenticateUser,
  requireRole(['complaint-coordinator', 'super-admin']),
  (req, res) => complaintController.getFalseComplaints(req, res)
);
router.get('/false-reports/statistics',
  authenticateUser,
  requireRole(['complaint-coordinator', 'super-admin']),
  (req, res) => complaintController.getFalseComplaintStatistics(req, res)
);

module.exports = router;
