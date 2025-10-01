const express = require('express');
const multer = require('multer');
const ComplaintController = require('../controllers/ComplaintController');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();
const complaintController = new ComplaintController();

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
});

router.post('/',
  authenticateUser,
  csrfProtection,
  upload.array('evidenceFiles', 5),
  (req, res) => complaintController.createComplaint(req, res)
);

router.get('/my', 
  authenticateUser,
  requireRole(['citizen']),
  (req, res) => complaintController.getMyComplaints(req, res)
);

router.get('/stats', 
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin']),
  (req, res) => complaintController.getComplaintStats(req, res)
);

router.get('/', 
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin']),
  (req, res) => complaintController.getAllComplaints(req, res)
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

module.exports = router;
