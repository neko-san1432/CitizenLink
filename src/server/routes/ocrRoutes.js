const express = require("express");
const multer = require("multer");
const OCRController = require("../controllers/OCRController");
const { authLimiter } = require("../middleware/rateLimiting");

const router = express.Router();
const upload = multer({ dest: "uploads/ocr/" });

// Primary ID OCR
router.post(
  "/ocr",
  authLimiter,
  upload.single("file"),
  OCRController.processId
);

// Secondary Residency Verification (Bill/Cert/Cedula)
router.post(
  "/ocr/verify-residency",
  authLimiter,
  upload.single("file"),
  OCRController.processResidencyDoc
);

module.exports = router;
