const express = require('express');
const config = require('../../../config/app');

const router = express.Router();

// Get CAPTCHA site key
router.get('/key', (req, res) => {
  try {
    const siteKey = config.captcha?.siteKey;

    if (!siteKey) {
      return res.status(500).json({
        success: false,
        error: 'CAPTCHA not configured'
      });
    }

    res.json({
      success: true,
      key: siteKey
    });
  } catch (error) {
    console.error('CAPTCHA key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get CAPTCHA key'
    });
  }
});

// Get reCAPTCHA site key for OAuth continuation page
router.get('/oauth-key', (req, res) => {
  try {
    const siteKey = config.captcha?.siteKey;

    if (!siteKey) {
      return res.status(500).json({
        success: false,
        error: 'CAPTCHA not configured'
      });
    }

    res.json({
      success: true,
      key: siteKey
    });
  } catch (error) {
    console.error('CAPTCHA OAuth key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get CAPTCHA key'
    });
  }
});

// Verify CAPTCHA token (server-side verification would be needed for production)
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'CAPTCHA token is required'
      });
    }

    // For development/testing purposes, we'll accept the token as valid
    // In production, you would verify with the CAPTCHA service (reCAPTCHA, hCaptcha, etc.)
    if (config.isDevelopment) {
      return res.json({
        success: true,
        message: 'CAPTCHA verification successful (development mode)'
      });
    }

    // In production, implement actual CAPTCHA verification here
    // Example for Google reCAPTCHA:
    /*
    const secretKey = config.captcha?.secretKey;
    if (!secretKey) {
      return res.status(500).json({
        success: false,
        error: 'CAPTCHA not properly configured'
      });
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const result = await response.json();

    if (result.success) {
      res.json({
        success: true,
        message: 'CAPTCHA verification successful'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'CAPTCHA verification failed',
        details: result['error-codes']
      });
    }
    */

    // For now, return success (this should be replaced with actual verification)
    res.json({
      success: true,
      message: 'CAPTCHA verification successful'
    });

  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    res.status(500).json({
      success: false,
      error: 'CAPTCHA verification failed'
    });
  }
});

module.exports = router;