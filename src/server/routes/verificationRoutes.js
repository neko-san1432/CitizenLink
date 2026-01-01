const express = require("express");
const router = express.Router();
const IDVerificationService = require("../services/IDVerificationService");
const { authenticateUser } = require("../middleware/auth");

/**
 * Store ID verification data after OCR processing
 * POST /api/verification/store
 * Body: { idType, fields, confidence }
 */
router.post("/store", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated"
      });
    }

    const { idType, fields, confidence } = req.body;

    // Validate required fields
    if (!fields || !fields.idNumber) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: idNumber"
      });
    }

    // Check if ID number already exists
    const exists = await IDVerificationService.checkIdNumberExists(fields.idNumber);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: "ID_NUMBER_ALREADY_REGISTERED",
        message: "This ID number is already registered in the system. Each ID can only be used once."
      });
    }

    // Store verification data
    const verification = await IDVerificationService.storeVerification(userId, {
      idType,
      fields,
      confidence
    });

    return res.json({
      success: true,
      data: {
        verificationId: verification.id,
        status: verification.verification_status,
        createdAt: verification.created_at
      },
      message: "ID verification stored successfully"
    });
  } catch (error) {
    console.error("[VERIFICATION] Store error:", error);

    // Handle specific error cases
    if (error.message === "ID_NUMBER_ALREADY_REGISTERED") {
      return res.status(409).json({
        success: false,
        error: "ID_NUMBER_ALREADY_REGISTERED",
        message: "This ID number is already registered in the system."
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to store verification",
      message: error.message
    });
  }
});

/**
 * Get current user's verification status
 * GET /api/verification/status
 */
router.get("/status", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated"
      });
    }

    const verification = await IDVerificationService.getVerificationStatus(userId);

    if (!verification) {
      return res.json({
        success: true,
        data: {
          hasVerification: false,
          status: null
        }
      });
    }

    return res.json({
      success: true,
      data: {
        hasVerification: true,
        verificationId: verification.id,
        status: verification.verification_status,
        idType: verification.id_type,
        verifiedAt: verification.verified_at,
        createdAt: verification.created_at
      }
    });
  } catch (error) {
    console.error("[VERIFICATION] Get status error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get verification status",
      message: error.message
    });
  }
});

/**
 * Check if an ID number exists (for duplicate prevention)
 * POST /api/verification/check-id
 * Body: { idNumber }
 */
router.post("/check-id", async (req, res) => {
  try {
    const { idNumber } = req.body;

    if (!idNumber) {
      return res.status(400).json({
        success: false,
        error: "ID number is required"
      });
    }

    const exists = await IDVerificationService.checkIdNumberExists(idNumber);

    return res.json({
      success: true,
      data: {
        exists,
        available: !exists
      }
    });
  } catch (error) {
    console.error("[VERIFICATION] Check ID error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to check ID number",
      message: error.message
    });
  }
});

module.exports = router;
