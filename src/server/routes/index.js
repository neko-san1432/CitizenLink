const express = require('express');
const authRoutes = require('./authRoutes');
const complaintRoutes = require('./complaintRoutes');
const departmentRoutes = require('./departmentRoutes');
const settingRoutes = require('./settingRoutes');
const supabaseRoutes = require('./supabaseRoutes');
const captchaRoutes = require('./captchaRoutes');
const coordinatorRoutes = require('./coordinatorRoutes');
let hrRoutes;
try {
  hrRoutes = require('./hrRoutes');
  // console.log removed for security
} catch (error) {
  console.error('[ROUTES] Error loading HR routes:', error);
  throw error;
}
const superAdminRoutes = require('./superAdminRoutes');
const lguAdminRoutes = require('./lguAdminRoutes');
const lguRoutes = require('./lguOfficerRoutes'); // LGU officer routes (using lguOfficerRoutes file)
const notificationRoutes = require('./notificationRoutes');
const storageRoutes = require('./storageRoutes');
const contentRoutes = require('./contentRoutes');
const rateLimitRoutes = require('./rateLimitRoutes');

const router = express.Router();

// CAPTCHA routes
router.use('/captcha', captchaRoutes);

// Supabase public config
router.use('/supabase', supabaseRoutes);

// Auth routes
router.use('/auth', authRoutes);

// Resource routes
router.use('/complaints', complaintRoutes);
router.use('/departments', departmentRoutes);
router.use('/settings', settingRoutes);
router.use('/coordinator', coordinatorRoutes);
router.use('/hr', hrRoutes);
router.use('/superadmin', superAdminRoutes);
router.use('/lgu-admin', lguAdminRoutes);
router.use('/lgu', lguRoutes); // LGU officer routes (lgu-wst, lgu-engineering, etc.)
router.use('/notifications', notificationRoutes);
router.use('/storage', storageRoutes);
router.use('/content', contentRoutes);
router.use('/rate-limit', rateLimitRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
