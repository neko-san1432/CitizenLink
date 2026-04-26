const express = require("express");
const authRoutes = require("./authRoutes");
const complaintRoutes = require("./complaintRoutes");
const departmentRoutes = require("./departmentRoutes");
const settingRoutes = require("./settingRoutes");
const supabaseRoutes = require("./supabaseRoutes");
const captchaRoutes = require("./captchaRoutes");
const coordinatorRoutes = require("./coordinatorRoutes");
const ocrRoutes = require("./ocrRoutes");
const verificationRoutes = require("./verificationRoutes");
const { apiLimiter } = require("../middleware/rateLimiting");
const superAdminRoutes = require("./superAdminRoutes");
const lguRoutes = require("./lguRoutes");
const notificationRoutes = require("./notificationRoutes");
const storageRoutes = require("./storageRoutes");
const contentRoutes = require("./contentRoutes");
const rateLimitRoutes = require("./rateLimitRoutes");
const healthRoutes = require("./healthRoutes");
const departmentStructureRoutes = require("./departmentStructureRoutes");
const complianceRoutes = require("./complianceRoutes");
const officeConfirmationRoutes = require("./officeConfirmationRoutes");
const publicApiRoutes = require("./publicApiRoutes");
const brainDashboardRoutes = require("./brainDashboardRoutes");


const router = express.Router();
// CAPTCHA routes
router.use("/captcha", captchaRoutes);
// Supabase public config
router.use("/supabase", supabaseRoutes);
// Auth routes
router.use("/auth", authRoutes);
// Resource routes
router.use("/complaints", complaintRoutes);
router.use("/departments", departmentRoutes);
router.use("/settings", settingRoutes);
router.use("/coordinator", coordinatorRoutes);
router.use("/identity", ocrRoutes);
router.use("/verification", verificationRoutes);
router.use("/superadmin", superAdminRoutes);
router.use("/lgu", lguRoutes);
router.use("/lgu-admin", lguRoutes); // Backward compatibility
router.use("/notifications", notificationRoutes);
router.use("/storage", storageRoutes);
router.use("/content", contentRoutes);
router.use("/rate-limit", rateLimitRoutes);
router.use("/health", healthRoutes);
router.use("/department-structure", departmentStructureRoutes);
router.use("/compliance", complianceRoutes);
router.use("/office-confirmation", officeConfirmationRoutes);
// NLP Routes
router.use("/nlp", require("./nlpRoutes"));
router.use("/brain", brainDashboardRoutes);
// Public config route (formerly in publicApiRoutes, moved here for correct path /api/config)
router.get("/config", apiLimiter, (req, res) => {
  const config = require("../../../config/app");
  const devAccounts = require("../../../config/devAccounts");
  
  res.json({
    legacyRolesEnabled: process.env.ENABLE_LEGACY_ROLES === "true",
    legacyRoleManagementEnabled: process.env.ENABLE_LEGACY_ROLES === "true",
    testLoginEnabled: config.env === "development" || process.env.ENABLE_TEST_LOGIN === "true",
    testEmails: {
      citizen: devAccounts.citizen.email,
      lgu: devAccounts.lgu.email,
      superAdmin: devAccounts.superAdmin.email,
      password: devAccounts.citizen.password // Defaulting to citizen password for the quick UI
    }
  });
});

// Public API routes (boundaries, geocoding)
router.use("/public", publicApiRoutes);
// User routes (roles, profile info)
router.use("/user", require("./userRoutes"));

module.exports = router;
