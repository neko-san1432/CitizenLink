const express = require('express');
const authRoutes = require('./authRoutes');
const complaintRoutes = require('./complaintRoutes');
const departmentRoutes = require('./departmentRoutes');
const settingRoutes = require('./settingRoutes');
const captchaRoutes = require('./captchaRoutes');

const router = express.Router();

// CAPTCHA routes
router.use('/captcha', captchaRoutes);

// Auth routes
router.use('/auth', authRoutes);

// Resource routes
router.use('/complaints', complaintRoutes);
router.use('/departments', departmentRoutes);
router.use('/settings', settingRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
