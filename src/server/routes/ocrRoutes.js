const express = require('express');
const multer = require('multer');
const OCRController = require('../controllers/OCRController');
const { authLimiter } = require('../middleware/rateLimiting');

const router = express.Router();
const upload = multer({ dest: 'uploads/ocr/' });

router.post('/ocr', authLimiter, upload.single('file'), OCRController.processId);

module.exports = router;



