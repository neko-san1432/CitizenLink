const express = require("express");
const path = require("path");
const config = require("../../../config/app");
const {
  authenticateUser,
  requireRole,
  redirectIfAuthenticated,
} = require("../middleware/auth");
const { normalizeRole } = require("../utils/roleValidation");

const router = express.Router();

// Helper for dashboard path
// Helper for dashboard path
const getDashboardPath = (userRole) => {
  const normalizedRole = normalizeRole(userRole);

  // Admin roles -> Reports
  if (
    ["super-admin", "lgu-admin", "complaint-coordinator"].includes(
      normalizedRole
    )
  ) {
    return path.join(
      config.rootDir,
      "views",
      "pages",
      "lgu-admin",
      "reports.html"
    );
  }

  // Default / Citizen -> File Complaint
  return path.join(
    config.rootDir,
    "views",
    "pages",
    "citizen",
    "fileComplaint.html"
  );
};

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

// Dashboard route - protected and routed by role
router.get("/dashboard", authenticateUser, (req, res) => {
  const userRole = req.user?.role || "citizen";
  const dashboardPath = getDashboardPath(userRole);
  res.sendFile(dashboardPath);
});

// My Profile
router.get("/myProfile", authenticateUser, (req, res) => {
  res.sendFile(path.join(config.rootDir, "views", "pages", "myProfile.html"));
});

// File Complaint (Citizen)
router.get("/fileComplaint", authenticateUser, (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "citizen", "fileComplaint.html")
  );
});

// Reports (Admin)
router.get(
  "/lgu-admin/reports",
  authenticateUser,
  requireRole(["lgu-admin", "super-admin", "complaint-coordinator"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "lgu-admin", "reports.html")
    );
  }
);

// Reports Alias
router.get(
  "/reports",
  authenticateUser,
  requireRole(["lgu-admin", "super-admin", "complaint-coordinator"]),
  (req, res) => {
    res.redirect("/lgu-admin/reports");
  }
);

// Complaint Details
router.get("/complaint-details", authenticateUser, (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "complaint-details.html")
  );
});
router.get("/complaint-details/:id", authenticateUser, (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "complaint-details.html")
  );
});

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

// Root route
router.get("/", (req, res) => {
  res.sendFile(path.join(config.rootDir, "views", "pages", "index.html"));
});

// Auth pages - redirect to dashboard if already logged in
const authPages = [
  "login",
  "signup",
  "resetPass",
  // "reset-password", // Allow logged-in users to access reset password page
  "confirm-password-change",
  "OAuthContinuation",
  "success",
  "email-verification-success",
];
authPages.forEach((page) => {
  router.get(`/${page}`, redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(config.rootDir, "views", "pages", `${page}.html`));
  });
});

// Explicitly define reset-password route without redirectIdAuthenticated
router.get("/reset-password", (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "reset-password.html")
  );
});

// OAuth continuation aliases (lowercase, hyphenated)
router.get(
  ["/oauth-continuation", "/oauthcontinuation"],
  redirectIfAuthenticated,
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "OAuthContinuation.html")
    );
  }
);

// OAuth callback page (handles OAuth redirect)
router.get("/oauth-callback", (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "oauth-callback.html")
  );
});

// Special signup with code page
router.get("/signup-with-code", redirectIfAuthenticated, (req, res) => {
  const filePath = path.join(
    config.rootDir,
    "views",
    "pages",
    "auth",
    "signup-with-code.html"
  );
  res.sendFile(filePath);
});

router.get(["/privacy-notice", "/privacy"], (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "privacy-notice.html")
  );
});

// Complete Position Signup page (public - no auth required)
router.get("/complete-position-signup", (req, res) => {
  res.sendFile(
    path.join(
      config.rootDir,
      "views",
      "pages",
      "auth",
      "complete-position-signup.html"
    )
  );
});

module.exports = router;
