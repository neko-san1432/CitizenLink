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
    // LGU Role now uses the Coordinator Dashboard (as per user request)
    lgu: path.join(
      config.rootDir,
      "views",
      "pages",
      "coordinator",
      "dashboard.html"
    ),
    "super-admin": path.join(
      config.rootDir,
      "views",
      "pages",
      "super-admin",
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
  "/citizen/fileComplaint",
  authenticateUser,
  requireRole(["citizen"]),
  (req, res) => {
    res.redirect("/fileComplaint");
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
router.get(
  "/hr/link-generator",
  authenticateUser,
  requireRole(["lgu-hr"]),
  (req, res) => {
    res.redirect("/link-generator");
  }
);
router.get(
  "/hr/role-changer",
  authenticateUser,
  requireRole(["lgu-hr"]),
  (req, res) => {
    res.redirect("/role-changer");
  }
);
// Coordinator redirects -> Accessible by 'lgu'
router.get(
  "/coordinator/review-queue",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/review-queue");
  }
);
router.get(
  "/coordinator/assignments",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/assignments");
  }
);
router.get(
  "/coordinator/heatmap",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/heatmap");
  }
);
// LGU Admin redirects -> Accessible by 'lgu'
router.get(
  "/lgu-admin/dashboard",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);
router.get(
  "/lgu-admin/assignments",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/assignments");
  }
);
router.get(
  "/lgu-admin/heatmap",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/heatmap");
  }
);
router.get(
  "/lgu-admin/publish",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/publish");
  }
);
router.get(
  "/lgu-officer/task-assigned",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/task-assigned");
  }
);

// Dashboard route - protected and routed by role
router.get("/dashboard", authenticateUser, (req, res) => {
  const userRole = req.user?.role || "citizen";
  const dashboardPath = getDashboardPath(userRole);
  res.sendFile(dashboardPath);
});

// General protected pages (simplified URLs)
router.get("/myProfile", authenticateUser, (req, res) => {
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

// File Complaint page (citizen only or staff in citizen mode)
router.get("/fileComplaint", authenticateUser, (req, res) => {
  res.sendFile(
    path.join(config.rootDir, "views", "pages", "citizen", "fileComplaint.html")
  );
});

// Departments page (role-aware)
router.get("/departments", authenticateUser, (req, res) => {
  const userRole = req.user?.role || "citizen";
  if (userRole === "super-admin") {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "admin",
        "department-structure.html"
      )
    );
  } else {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "citizen", "departments.html")
    );
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

// Complaint Details page (authenticated users only)
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
        "nlp-training.html"
      )
    );
  }
);

router.get(
  "/role-changer",
  authenticateUser,
  requireRole(["super-admin", "lgu-hr"]),
  (req, res) => {
    const userRole = req.user?.role || "citizen";
    if (userRole === "super-admin") {
      res.redirect("/super-admin/user-manager");
    } else {
      res
        .status(403)
        .send(
          "Role changer access has been removed. Please contact super-admin for role changes."
        );
    }
  }
);

// LGU-specific pages (simplified URLs)
router.get(
  "/task-assigned",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "lgu-officer",
        "assigned-tasks.html"
      )
    );
  }
);

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
        "lgu-admin",
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
      path.join(config.rootDir, "views", "pages", "lgu-admin", "heatmap.html")
    );
  }
);
router.get(
  "/brain-analytics-page",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "lgu-admin",
        "brain-analytics.html"
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
        "lgu-admin",
        "dictionary-manager.html"
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
      path.join(config.rootDir, "views", "pages", "lgu-admin", "publish.html")
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
router.get(
  "/coordinator",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);
router.get(
  "/lgu-admin",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

// HR specific pages (simplified URLs)
router.get(
  "/link-generator",
  authenticateUser,
  requireRole(["lgu-hr"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "hr", "link-generator.html")
    );
  }
);

// Super Admin access to HR Link Generator
router.get(
  "/super-admin/link-generator",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "views", "pages", "hr", "link-generator.html")
    );
  }
);

// Super Admin access to Pending Signups
router.get(
  "/super-admin/pending-signups",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "super-admin",
        "pending-signups.html"
      )
    );
  }
);

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
        "super-admin",
        "server-logs.html"
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
        "coordinator",
        "review-queue.html"
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
      path.join(config.rootDir, "views", "pages", "coordinator", "review.html")
    );
  }
);

// Legacy coordinator review page -> redirect
router.get(
  "/coordinator/review/:id",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect(`/review/${req.params.id}`);
  }
);

// LGU Officer legacy dashboard URL → redirect to unified dashboard
router.get(
  "/lgu-officer/dashboard",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

// LGU Officer tasks page (alias for task-assigned)
router.get(
  "/lgu-officer/tasks",
  authenticateUser,
  requireRole(["lgu"]),
  (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "views",
        "pages",
        "lgu-officer",
        "assigned-tasks.html"
      )
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
        "super-admin",
        "user-manager.html"
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
