const express = require('express');
const multer = require('multer');
const ComplaintController = require('../controllers/ComplaintController');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

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
    
    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false);
    }
    
    // Additional security: Check file extension matches MIME type
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp4'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      return cb(new Error('File extension does not match allowed types'), false);
    }
    
    cb(null, true);
  }
}).fields([
  { name: 'evidenceFiles', maxCount: 5 },
  { name: '_csrf', maxCount: 1 }
]);

router.post('/',
  authenticateUser,
  upload,
  csrfProtection,
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

router.get('/locations', 
  authenticateUser,
  requireRole([/^lgu-/, 'super-admin']),
  (req, res) => complaintController.getComplaintLocations(req, res)
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

module.exports = router;
