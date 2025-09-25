import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";
import multer from "multer";
import { promises as fs } from 'fs';
// Load environment variables
dotenv.config();

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing required environment variables: SUPABASE_URL or SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

// Use anon key for token validation - more secure and follows principle of least privilege
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for now
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5, // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images, audio, and video files
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images, audio, and video files are allowed"), false);
    }
  },
});

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for development
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Serve node_modules for browser ESM imports (required for ESM modules)
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

// ============================================================================
// STATIC FILE ROUTES (Explicit routing only)
// ============================================================================

// CSS files
app.get("/css/*", (req, res) => {
  res.sendFile(path.join(__dirname, req.path));
});

// JavaScript files
app.get("/js/*", (req, res) => {
  try {
    const filePath = path.join(__dirname, req.path);
    res.set("Content-Type", "application/javascript");
    res.sendFile(path.join(__dirname, req.path));
  } catch (err) {
    console.log("bruh");
  }
});
app.use('/assets', express.static(path.join(__dirname, 'assets')));
// Assets files
app.get("/assets/*", (req, res) => {
  res.sendFile(path.join(__dirname, req.path));
});

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware - validates user tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateUser = async (req, res, next) => {
  try {
    const token =
      req.cookies?.sb_access_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      console.log("[AUTH] No token found");
      return res.status(401).json({
        success: false,
        error: "No authentication token",
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log(
        "[AUTH] Token invalid or expired:",
        error?.message || "No user"
      );
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH] Authentication error:", error.message);
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

/**
 * Role-based authorization middleware with regex support
 * @param {Array} allowedRoles - Array of allowed roles (strings or regex patterns)
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const rawRole = req.user?.user_metadata?.role;
    const userRole = (rawRole == null ? "" : String(rawRole))
      .trim()
      .toLowerCase();

    if (!userRole) {
      console.log("[AUTH] No user role found");
      return res.status(404).sendFile(path.join(__dirname, "404.html"));
    }

    // Check if user role matches any allowed role (including regex patterns)
    const hasPermission = allowedRoles.some((allowedRole) => {
      if (typeof allowedRole === "string") {
        return userRole === allowedRole;
      } else if (allowedRole instanceof RegExp) {
        // Use case-insensitive regex matching
        return allowedRole.test(userRole) || allowedRole.test(rawRole);
      }
      return false;
    });

    if (!hasPermission) {
      console.log(`[AUTH] Permission denied for role: ${userRole}`);
      return res.status(404).sendFile(path.join(__dirname, "404.html"));
    }

    next();
  };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determines dashboard path based on user role
 * @param {string} userRole - User's role
 * @returns {string} Path to appropriate dashboard
 */
const getDashboardPath = (userRole) => {
  const normalizedRole = (userRole == null ? "" : String(userRole))
    .trim()
    .toLowerCase();

  // Super admin dashboard
  if (normalizedRole === "super-admin") {
    return path.join(__dirname, "pages", "super-admin", "dashboard.html");
  }

  // LGU departments (regex pattern: lgu-*)
  if (/^lgu-/.test(normalizedRole)) {
    const afterPrefix = normalizedRole.replace(/^lgu-/, "");
    const firstSegment = afterPrefix.split("-")[0] || "";

    if (firstSegment === "admin") {
      return path.join(__dirname, "pages", "lgu-admin", "dashboard.html");
    }

    return path.join(__dirname, "pages", "lgu", "dashboard.html");
  }

  // Default to citizen dashboard
  return path.join(__dirname, "pages", "citizen", "dashboard.html");
};

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * Set HttpOnly cookie with access token
 */
app.post("/auth/session", (req, res) => {
  try {
    const { access_token: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Missing access token",
      });
    }

    res.cookie("sb_access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4 * 1000, // 4 hours (matches Supabase token)
    });

    console.log(
      `[AUTH] Session cookie set for token length: ${String(token).length}`
    );
    return res.json({ success: true });
  } catch (error) {
    console.error("[AUTH] Session creation error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * Clear authentication session (logout)
 */
app.delete("/auth/session", (req, res) => {
  try {
    res.clearCookie("sb_access_token", { path: "/" });
    console.log("[AUTH] Session cleared");
    return res.json({ success: true });
  } catch (error) {
    console.error("[AUTH] Session clear error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ============================================================================
// ENVIRONMENT & UTILITY ENDPOINTS
// ============================================================================

/**
 * SECURITY: Environment variables are no longer exposed to client-side
 * All sensitive operations are handled server-side through API endpoints
 */

/**
 * Supabase operations endpoint - handles all database operations server-side
 */
app.post("/api/supabase", async (req, res) => {
  try {
    const { operation, table, data, filters } = req.body;
    
    let result;
    switch (operation) {
      case 'select':
        result = await supabase.from(table).select(filters?.select || '*');
        if (filters?.where) {
          result = result.eq(filters.where.column, filters.where.value);
        }
        break;
      case 'insert':
        result = await supabase.from(table).insert(data);
        break;
      case 'update':
        result = await supabase.from(table).update(data);
        if (filters?.where) {
          result = result.eq(filters.where.column, filters.where.value);
        }
        break;
      case 'delete':
        result = await supabase.from(table).delete();
        if (filters?.where) {
          result = result.eq(filters.where.column, filters.where.value);
        }
        break;
      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }
    
    const { data: responseData, error } = await result;
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ data: responseData });
  } catch (error) {
    console.error('Supabase operation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Supabase configuration endpoint - returns only public configuration
 */
app.get("/api/supabase/config", (req, res) => {
  res.json({ 
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || ""
  });
});

/**
 * CAPTCHA key endpoint - returns only the client-side key
 */
app.get("/api/captcha/key", (req, res) => {
  res.json({ key: process.env.CAPTCHA_CLIENT_KEY || "" });
});

/**
 * CAPTCHA verification endpoint
 */
app.post("/captcha/verify", async (req, res) => {
  try {
    const token = req.body?.token || req.body?.captcha || req.body?.response;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Missing CAPTCHA token",
      });
    }

    const secret = process.env.CAPTCHA_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({
        success: false,
        error: "Server misconfigured",
      });
    }

    const params = new URLSearchParams({
      secret,
      response: token,
      ...(req.ip && { remoteip: req.ip }),
    });

    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );

    const result = await response.json();

    if (result?.success) {
      return res.json({
        success: true,
        score: result.score,
        action: result.action,
      });
    }

    return res.status(400).json({
      success: false,
      error: "CAPTCHA verification failed",
      details: result,
    });
  } catch (error) {
    console.error("[CAPTCHA] Verification error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "signup.html"));
});

app.get("/resetPassword", (req, res) => {
  res.sendFile(path.join(__dirname, "resetPass.html"));
});

app.get("/success", (req, res) => {
  res.sendFile(path.join(__dirname, "success.html"));
});

app.get("/oauth-continuation", (req, res) => {
  res.sendFile(path.join(__dirname, "OAuthContinuation.html"));
});

// ============================================================================
// PROTECTED ROUTES (Authentication Required)
// ============================================================================

/**
 * Dashboard route - protected and routed by role
 */
app.get("/dashboard", authenticateUser, (req, res) => {
  const userRole = req.user?.user_metadata?.role || "citizen";
  const dashboardPath = getDashboardPath(userRole);

  console.log(
    `[DASHBOARD] Role: ${userRole}, Path: ${dashboardPath}, User ID: ${req.user?.id}`
  );
  res.sendFile(dashboardPath);
});

/**
 * General protected pages
 */
app.get("/myProfile", authenticateUser, (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "myProfile.html"));
});

app.get("/fileComplaint", authenticateUser, (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "fileComplaint.html"));
});

// Chart routes removed

/**
 * LGU-specific pages
 */
app.get(
  "/taskAssigned",
  authenticateUser,
  requireRole(["lgu", /^lgu-/]),
  (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "lgu", "taskAssigned.html"));
  }
);

/**
 * LGU Admin specific pages
 */
app.get(
  "/heatmap",
  authenticateUser,
  requireRole([/^lgu-admin(?:-|$)/]),
  (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "lgu-admin", "heatmap.html"));
  }
);

app.get(
  "/publish",
  authenticateUser,
  requireRole([/^lgu-admin(?:-|$)/]),
  (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "lgu-admin", "publish.html"));
  }
);

app.get(
  "/appointMembers",
  authenticateUser,
  requireRole([/^lgu-admin(?:-|$)/]),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "pages", "lgu-admin", "appointMembers.html")
    );
  }
);

app.get(
  "/content-published",
  authenticateUser,
  requireRole([/^lgu-admin(?:-|$)/]),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "pages", "lgu-admin", "content-published.html")
    );
  }
);

/**
 * Super Admin specific pages
 */
app.get(
  "/appointAdmins",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "pages", "super-admin", "appointAdmins.html")
    );
  }
);

/**
 * Role-based dashboard shortcuts
 */
app.get("/citizen", authenticateUser, requireRole(["citizen"]), (req, res) => {
  res.redirect("/dashboard");
});

app.get("/lgu", authenticateUser, requireRole(["lgu", /^lgu-/]), (req, res) => {
  res.redirect("/dashboard");
});

app.get(
  "/lgu-admin",
  authenticateUser,
  requireRole(["lgu-admin"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

app.get(
  "/super-admin",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Get user profile information
 */
app.get("/api/user/profile", authenticateUser, (req, res) => {
  const { user } = req;

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name,
      role: user.user_metadata?.role,
      mobile: user.user_metadata?.mobile,
      oauth_providers: user.user_metadata?.oauth_providers || [],
    },
  });
});

/**
 * Get user role
 */
app.get("/api/user/role", authenticateUser, (req, res) => {
  const { user } = req;

  res.json({
    success: true,
    data: {
      role: user.user_metadata?.role || "citizen",
    },
  });
});

/**
 * Submit a new complaint
 * POST /api/complaints
 */
app.post(
  "/api/complaints",
  authenticateUser,
  upload.array("evidenceFiles", 5),
  async (req, res) => {
    try {
      const { user } = req;
      const {
        complaintTitle,
        complaintType,
        complaintSubtype,
        departments,
        description,
        location,
      } = req.body;

      // Validate required fields
      if (!complaintTitle || !description || !location) {
        return res.status(400).json({
          success: false,
          error:
            "Missing required fields: title, description, and location are required",
        });
      }

      // Parse departments array
      let departmentsArray = [];
      try {
        departmentsArray = departments ? JSON.parse(departments) : [];
      } catch (error) {
        console.error("Error parsing departments:", error);
        departmentsArray = [];
      }

      // Create complaint object
      const complaint = {
        id: Date.now().toString(), // Simple ID generation
        title: complaintTitle,
        type: complaintType || null,
        subtype: complaintSubtype || null,
        departments: departmentsArray,
        description: description,
        location: location,
        status: "pending",
        priority: "medium",
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Handle file uploads if any
      const evidenceFiles = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          evidenceFiles.push({
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            buffer: file.buffer, // Store file data in memory
          });
        });
      }

      complaint.evidence = evidenceFiles;

      // TODO: Save to database
      // For now, just log the complaint
      console.log("New complaint submitted:", {
        id: complaint.id,
        title: complaint.title,
        type: complaint.type,
        departments: complaint.departments,
        created_by: complaint.created_by,
      });

      res.json({
        success: true,
        data: {
          complaintId: complaint.id,
          message: "Complaint submitted successfully",
        },
      });
    } catch (error) {
      console.error("[COMPLAINT] Submission error:", error);

      // Handle multer errors
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            error: "File too large. Maximum size is 10MB per file.",
          });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            success: false,
            error: "Too many files. Maximum 5 files allowed.",
          });
        }
      }

      res.status(500).json({
        success: false,
        error: "Failed to submit complaint",
      });
    }
  }
);
/**
 * Heatmap
 */
// Route to serve the barangay boundaries JSON
app.get("/api/boundaries", async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'assets', 'brgy_boundaries_location.json');
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Boundaries data not found' });
    }

    const jsonData = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(jsonData));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load boundaries data' });
  }
});
// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * 404 handler for unmatched routes
 */
app.use((req, res) => {
  console.log(`[404] Route not found: ${req.method} ${req.path}`);
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

/**
 * Global error handler
 */
app.use((error, req, res, next) => {
  console.error("[ERROR] Unhandled error:", error.message);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("🚀 Server is running");
  console.log(`📍 Running at: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
