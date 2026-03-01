const express = require("express");
const authRoutes = require("./authRoutes");
const complaintRoutes = require("./complaintRoutes");
const departmentRoutes = require("./departmentRoutes");
const settingRoutes = require("./settingRoutes");
const supabaseRoutes = require("./supabaseRoutes");
const captchaRoutes = require("./captchaRoutes");
// [LEGACY] Coordinator routes moved to legacy/routes/coordinatorRoutes.js
// const coordinatorRoutes = require("./coordinatorRoutes");
const ocrRoutes = require("./ocrRoutes");
const verificationRoutes = require("./verificationRoutes");
const { _apiLimiter } = require("../middleware/rateLimiting");

// [LEGACY] HR routes moved to legacy/routes/hrRoutes.js
// let hrRoutes;
// try {
//   hrRoutes = require("./hrRoutes");
// } catch (error) {
//   console.error("[ROUTES] Error loading HR routes:", error);
//   throw error;
// }
const superAdminRoutes = require("./superAdminRoutes");
// [LEGACY] LGU Admin routes moved to legacy/routes/lguAdminRoutes.js
// const lguAdminRoutes = require("./lguAdminRoutes");
const lguRoutes = require("./lguOfficerRoutes"); // LGU officer routes (using lguOfficerRoutes file)
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
const coordinatorRoutes = require("./coordinatorRoutes");

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
// [LEGACY] Coordinator routes disabled — sub-role deprecated
// router.use("/coordinator", coordinatorRoutes);
router.use("/identity", ocrRoutes);
router.use("/verification", verificationRoutes);
// [LEGACY] HR routes disabled — lgu-hr sub-role deprecated
// router.use("/hr", hrRoutes);
router.use("/superadmin", superAdminRoutes);
// [LEGACY] LGU Admin routes disabled — lgu-admin sub-role deprecated
// router.use("/lgu-admin", lguAdminRoutes);
router.use("/lgu", lguRoutes); // LGU officer routes (lgu-wst, lgu-engineering, etc.)
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
router.use("/coordinator", coordinatorRoutes);
// Public API routes (boundaries, geocoding)
router.use("/", publicApiRoutes);
// User routes (roles, profile info)
router.use("/user", require("./userRoutes"));

module.exports = router;
