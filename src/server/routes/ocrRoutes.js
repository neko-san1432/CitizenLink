const express = require("express");
const multer = require("multer");
const path = require("path");
const OCRController = require("../controllers/OCRController");
const { authLimiter } = require("../middleware/rateLimiting");
const { authenticateUser } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");

const router = express.Router();

// SEC-16 FIX: CSRF protection on all state-changing routes
router.use(csrfProtection);

// SEC-01 FIX: File type filter — only accept image types
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const upload = multer({
  dest: "uploads/ocr/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP, GIF) and PDF are allowed"), false);
    }
  }
});

// Primary ID OCR — SEC-01 FIX: require authentication
router.post(
  "/ocr",
  authenticateUser,
  authLimiter,
  upload.single("file"),
  OCRController.processId
);

// Secondary Residency Verification (Bill/Cert/Cedula) — SEC-01 FIX: require authentication
router.post(
  "/ocr/verify-residency",
  authenticateUser,
  authLimiter,
  upload.single("file"),
  OCRController.processResidencyDoc
);

module.exports = router;
