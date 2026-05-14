const express = require("express");
const multer = require("multer");
const path = require("path");
const oCRController = require("../controllers/OCRController");
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

// Primary ID OCR — Accessible to guests for signup verification
router.post(
  "/ocr",
  authLimiter,
  upload.single("file"),
  oCRController.processId
);

// Secondary Residency Verification — Accessible to guests for signup verification
router.post(
  "/ocr/verify-residency",
  authLimiter,
  upload.single("file"),
  oCRController.processResidencyDoc
);

// Diagnostic GET handlers to help debug "Route not found" errors
router.get("/ocr", (req, res) => {
  res.json({ 
    success: false, 
    message: "This endpoint requires a POST request with an ID image file.",
    diagnostics: { method: req.method, path: req.originalUrl, timestamp: new Date() }
  });
});

router.get("/ocr/verify-residency", (req, res) => {
  res.json({ 
    success: false, 
    message: "This endpoint requires a POST request with a residency document file.",
    diagnostics: { method: req.method, path: req.originalUrl, timestamp: new Date() }
  });
});

module.exports = router;
