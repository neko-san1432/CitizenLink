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
const getDashboardPath = (userRole) => {
  const normalizedRole = normalizeRole(userRole);

  const roleDashboards = {
    citizen: path.join(
      config.rootDir,
      "views",
      "pages",
      "citizen",
      "dashboard.html"
    ),
    // LGU Role now uses its own dashboard
    lgu: path.join(
      config.rootDir,
      "views",
      "pages",
      "lgu",
      "dashboard.html"
    ),
    "super-admin": path.join(
      config.rootDir,
      "views",
      "pages",
      "superAdmin",
      "dashboard.html"
    ),
  };

  return roleDashboards[normalizedRole] || roleDashboards.citizen;
};

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

// Redirects from role-prefixed URLs to simplified URLs (backward compatibility)
router.get(
  "/citizen/filecomplaint",
  authenticateUser,
  requireRole(["citizen"]),
  (req, res) => {
    res.redirect("/filecomplaint");
  }
);
router.get(
  "/citizen/departments",
  authenticateUser,
  requireRole(["citizen"]),
  (req, res) => {
    res.redirect("/departments");
  }
);
router.get(
  "/admin/appoint-admins",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/appoint-admins");
  }
);
router.get(
  "/admin/departments",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/departments");
  }
);
router.get(
  "/admin/role-changer",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/role-changer");
  }
);
router.get(
  "/admin/settings",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/settings");
  }
);

// =============================================================
// LGU prefix redirects (sidebar navigation uses /lgu/ prefix)
router.get(
  "/lgu/dictionary-manager",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/dictionary-manager");
  }
);
router.get(
  "/lgu/dashboard",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);
router.get(
  "/lgu/reports",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/reports");
  }
);
router.get(
  "/lgu/publish",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/publish");
  }
);

// Map alias (sidebar uses /map, actual route is /digos-map)
router.get("/map", authenticateUser, (req, res) => {
  res.redirect("/digos-map");
});

// Dashboard route - protected and routed by role
router.get("/dashboard", authenticateUser, (req, res) => {
  const userRole = req.user?.role || "citizen";
  const dashboardPath = getDashboardPath(userRole);
  res.sendFile(dashboardPath);
});

// General protected pages (simplified URLs)
router.get("/myprofile", authenticateUser, (req, res) => {
  res.redirect("/profile");
});

router.get("/profile", authenticateUser, (req, res) => {
  res.sendFile(path.join(config.rootDir, "views", "pages", "profile.html"));
});

router.get("/settings", authenticateUser, (req, res) => {
  res.sendFile(path.join(config.rootDir, "views", "pages", "settings.html"));
});

// Publication page (all authenticated roles)
router.get("/publication", authenticateUser, (req, res) => {
  res.sendFile(path.join(config.rootDir, "views", "pages", "publication.html"));
});

// File complaint page (citizen only or staff in citizen mode)
router.get("/filecomplaint", authenticateUser, (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "citizen", "fileComplaint.html")
  );
});

// Departments page (role-aware)
router.get("/departments", authenticateUser, (req, res) => {
  const userRole = req.user?.role || "citizen";
  if (userRole === "super-admin" || userRole === "lgu") {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "admin",
        "departmentStructure.html"
      )
    );
  } else {
    // Citizen departments.html is missing, redirect to dashboard
    res.redirect("/dashboard");
  }
});

// Digos City Map (citizen only)
router.get(
  "/digos-map",
  authenticateUser,
  requireRole(["citizen"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "citizen", "digosMap.html")
    );
  }
);

// complaint Details page (authenticated users only)
router.get("/complaint-details", authenticateUser, (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "complaintDetails.html")
  );
});
router.get("/complaint-details/:id", authenticateUser, (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "complaintDetails.html")
  );
});

// Admin pages (simplified URLs)
router.get(
  "/appoint-admins",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/super-admin/user-manager");
  }
);

router.get(
  "/admin/nlp-training",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "admin",
        "nlpTraining.html"
      )
    );
  }
);

router.get(
  "/role-changer",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/super-admin/user-manager");
  }
);

// LGU-specific pages (simplified URLs)

// LGU Admin specific pages (simplified URLs)
router.get(
  "/assignments",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "lgu",
        "assignments.html"
      )
    );
  }
);
router.get(
  "/heatmap",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "lgu", "heatmap.html")
    );
  }
);
router.get(
  "/brainAnalytics-page",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "lgu",
        "brainAnalytics.html"
      )
    );
  }
);
router.get(
  "/dictionary-manager",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "lgu",
        "dictionaryManager.html"
      )
    );
  }
);
router.get(
  "/publish",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "publication.html")
    );
  }
);
router.get(
  "/reports",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "lgu", "assignments.html")
    );
  }
);

// Super Admin specific pages - redirect to User Manager
router.get(
  "/appointAdmins",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/super-admin/user-manager");
  }
);

// Role-based dashboard shortcuts
router.get(
  "/citizen",
  authenticateUser,
  requireRole(["citizen"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);
router.get("/lgu", authenticateUser, requireRole(["lgu"]), (req, res) => {
  res.redirect("/dashboard");
});

// Super Admin server logs route below

// Super Admin Server Logs page
router.get(
  "/super-admin/server-logs",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "superAdmin",
        "serverLogs.html"
      )
    );
  }
);

// Super Admin System Settings page
router.get(
  "/super-admin/system-settings",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "superAdmin",
        "systemSettings.html"
      )
    );
  }
);

// Coordinator review queue list page (simplified URLs)
router.get(
  "/review-queue",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "lgu",
        "reviewQueue.html"
      )
    );
  }
);

// Coordinator complaint review page (individual)
// Coordinator review link (simplified URL)
router.get(
  "/review/:id",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "lgu", "review.html")
    );
  }
);

// Super Admin Role Changer dedicated page - redirect to User Manager
router.get(
  "/super-admin/role-changer",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/super-admin/user-manager");
  }
);

// Legacy role-manager route - redirect to user-manager
router.get(
  "/super-admin/role-manager",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/super-admin/user-manager");
  }
);

// Super Admin User Manager page (user management with ban system)
router.get(
  "/super-admin/user-manager",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "superAdmin",
        "userManager.html"
      )
    );
  }
);

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
  // "resetPassword", // Allow logged-in users to access reset password page
  "confirmPasswordChange",
  "oAuthContinuation",
  "success",
  "emailVerificationSuccess",
];
authPages.forEach((page) => {
  router.get(`/${page}`, redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(config.rootDir, "views", "pages", `${page}.html`));
  });
});

// Explicitly define reset-password route without redirectIdAuthenticated
router.get("/reset-password", (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "resetPassword.html")
  );
});

// OAuth continuation aliases (lowercase, hyphenated)
router.get(
  ["/oauth-continuation", "/oauthcontinuation"],
  redirectIfAuthenticated,
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "oAuthContinuation.html")
    );
  }
);

// OAuth callback page (handles OAuth redirect)
router.get("/oauth-callback", (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "oauthCallback.html")
  );
});

// Special signup with code page
router.get("/signup-with-code", redirectIfAuthenticated, (req, res) => {
  const filePath = path.join(
    config.rootDir,
    "views",
    "pages",
    "auth",
    "signupWithCode.html"
  );
  res.sendFile(filePath);
});

// Privacy and Terms Pages
router.get(["/privacy-notice", "/privacy"], (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "privacy.html")
  );
});

router.get("/terms", (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "terms.html")
  );
});

// Complete position signup — HR flow
router.get("/complete-position-signup", (req, res) => {
  res.sendFile(
    path.join(
      config.rootDir,
      "views",
      "pages",
      "auth",
      "completePositionSignup.html"
    )
  );
});

module.exports = router;
