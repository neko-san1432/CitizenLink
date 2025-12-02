const express = require('express');
const authRoutes = require('./authRoutes');
const complaintRoutes = require('./complaintRoutes');
const departmentRoutes = require('./departmentRoutes');
const settingRoutes = require('./settingRoutes');
const supabaseRoutes = require('./supabaseRoutes');
const captchaRoutes = require('./captchaRoutes');
const coordinatorRoutes = require('./coordinatorRoutes');
const ocrRoutes = require('./ocrRoutes');
const verificationRoutes = require('./verificationRoutes');
const { apiLimiter } = require('../middleware/rateLimiting');

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
const healthRoutes = require('./healthRoutes');
const departmentStructureRoutes = require('./departmentStructureRoutes');
const complianceRoutes = require('./complianceRoutes');
const officeConfirmationRoutes = require('./officeConfirmationRoutes');
const publicApiRoutes = require('./publicApiRoutes');

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
router.use('/identity', ocrRoutes);
router.use('/verification', verificationRoutes);
router.use('/hr', hrRoutes);
router.use('/superadmin', superAdminRoutes);
router.use('/lgu-admin', lguAdminRoutes);
router.use('/lgu', lguRoutes); // LGU officer routes (lgu-wst, lgu-engineering, etc.)
router.use('/notifications', notificationRoutes);
router.use('/storage', storageRoutes);
router.use('/content', contentRoutes);
router.use('/rate-limit', rateLimitRoutes);
router.use('/health', healthRoutes);
router.use('/department-structure', departmentStructureRoutes);
router.use('/compliance', complianceRoutes);
router.use('/office-confirmation', officeConfirmationRoutes);
// Public API routes (boundaries, geocoding)
router.use('/', publicApiRoutes);

module.exports = router;
