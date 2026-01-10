const express = require("express");
const authRoutes = require("./authRoutes");
const complaintRoutes = require("./complaintRoutes");
const departmentRoutes = require("./departmentRoutes");
const supabaseRoutes = require("./supabaseRoutes");
const captchaRoutes = require("./captchaRoutes");
const verificationRoutes = require("./verificationRoutes");
const notificationRoutes = require("./notificationRoutes");
const storageRoutes = require("./storageRoutes");
const rateLimitRoutes = require("./rateLimitRoutes");
const healthRoutes = require("./healthRoutes");
const complianceRoutes = require("./complianceRoutes");
const publicApiRoutes = require("./publicApiRoutes");

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
router.use("/verification", verificationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/storage", storageRoutes);
router.use("/rate-limit", rateLimitRoutes);
router.use("/health", healthRoutes);
router.use("/compliance", complianceRoutes);
router.use("/department-structure", require("./departmentStructureRoutes"));
// Public API routes (boundaries, geocoding)
router.use("/", publicApiRoutes);
// User routes (roles, profile info)
router.use("/user", require("./userRoutes"));

module.exports = router;
