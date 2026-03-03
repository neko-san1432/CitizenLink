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
const { _apiLimiter } = require("../middleware/rateLimiting");
const superAdminRoutes = require("./superAdminRoutes");
const lguRoutes = require("./lguOfficerRoutes");
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
// Public API routes (boundaries, geocoding)
router.use("/", publicApiRoutes);
// User routes (roles, profile info)
router.use("/user", require("./userRoutes"));

module.exports = router;
