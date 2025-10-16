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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing required environment variables: SUPABASE_URL or SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
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
// STATIC FILE ROUTES
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
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authenticate user using Supabase JWT token
 */
const authenticateUser = async (req, res, next) => {
  try {
    const token =
      req.cookies?.sb_access_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      console.log("[AUTH] No token found");
      // Check if this is an API request or regular page request
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: "No authentication token",
        });
      }
      // For regular page requests, redirect to login with toast message
      return res.redirect('/login?message=' + encodeURIComponent('Please login first') + '&type=error');
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
      // Check if this is an API request or regular page request
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired token",
        });
      }
      // For regular page requests, redirect to login with toast message
      return res.redirect('/login?message=' + encodeURIComponent('Your session has expired. Please login again') + '&type=error');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH] Authentication error:", error.message);
    // Check if this is an API request or regular page request
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }
    // For regular page requests, redirect to login with toast message
    return res.redirect('/login?message=' + encodeURIComponent('Authentication failed. Please try again') + '&type=error');
  }
};

/**
 * Require specific user roles
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
        return allowedRole.test(userRole);
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

/**
 * Get dashboard path based on user role
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
// AUTHENTICATION ROUTES
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
// PAGE ROUTES
// ============================================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", async (req, res) => {
  try {
    // Check if user is already authenticated
    const token = req.cookies?.sb_access_token;
    
    if (token) {
      // Verify the token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (user && !error) {
        console.log("[LOGIN] User is already authenticated, redirecting to dashboard");
        // User is already logged in, redirect to dashboard
        return res.redirect('/dashboard');
      }
    }
    
    // User is not authenticated, serve the login page
    res.sendFile(path.join(__dirname, "login.html"));
  } catch (error) {
    console.error("[LOGIN] Error checking authentication:", error.message);
    // On error, serve the login page normally
    res.sendFile(path.join(__dirname, "login.html"));
  }
});

app.get("/signup", async (req, res) => {
  try {
    // Check if user is already authenticated
    const token = req.cookies?.sb_access_token;
    
    if (token) {
      // Verify the token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (user && !error) {
        console.log("[SIGNUP] User is already authenticated, redirecting to dashboard");
        // User is already logged in, redirect to dashboard
        return res.redirect('/dashboard');
      }
    }
    
    // User is not authenticated, serve the signup page
    res.sendFile(path.join(__dirname, "signup.html"));
  } catch (error) {
    console.error("[SIGNUP] Error checking authentication:", error.message);
    // On error, serve the signup page normally
    res.sendFile(path.join(__dirname, "signup.html"));
  }
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
// API ROUTES
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

/**
 * Reverse Geocoding endpoint - Server-side proxy to avoid CORS issues
 */
app.get("/api/reverse-geocode", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'CitizenLink/1.0 (https://citizenlink.local)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: 'Failed to get address information' });
  }
});

// ============================================================================
// COMPLAINT API ROUTES
// ============================================================================

/**
 * Submit a new complaint
 */
app.post("/api/complaints", authenticateUser, upload.array('evidenceFiles', 5), async (req, res) => {
  try {
    const { user } = req;
    const {
      title,
      type,
      subtype,
      description,
      location,
      latitude,
      longitude,
      departments
    } = req.body;

    // Basic validation
    if (!title || !description || !location) {
      return res.status(400).json({
        success: false,
        error: "Title, description, and location are required"
      });
    }

    // Parse departments if it's a string
    let departmentArray = [];
    if (departments) {
      try {
        departmentArray = typeof departments === 'string' ? JSON.parse(departments) : departments;
      } catch (e) {
        departmentArray = Array.isArray(departments) ? departments : [departments];
      }
    }

    // ========================================================================
    // ENHANCED COMPLAINT CREATION WITH MULTI-DEPARTMENT WORKFLOW
    // ========================================================================

    // Step 1: Prepare basic complaint data with new workflow fields
    const complaintData = {
      submitted_by: user.id,
      title: title.trim(),
      type: type || null,
      subtype: subtype || null,
      descriptive_su: description.trim(),
      location_text: location.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      department_r: departmentArray,
      status: 'pending review',           // Legacy status
      workflow_status: 'new',             // New workflow status
      priority: 'low',
      evidence: [],
      submitted_at: new Date().toISOString(),
      // New workflow fields (will be set by auto-assignment)
      primary_department: null,
      secondary_departments: [],
      assigned_coordinator_id: null,
      response_deadline: null
    };

    console.log("[COMPLAINT] Creating complaint with workflow:", {
      user_id: user.id,
      title: complaintData.title,
      type: complaintData.type,
      departments: departmentArray.length,
      workflow_enabled: true
    });

    // Step 2: Insert complaint into database
    const { data: complaint, error: insertError } = await supabase
      .from('complaints')
      .insert(complaintData)
      .select()
      .single();

    if (insertError) {
      console.error("[COMPLAINT] Database insert error:", insertError);
      return res.status(500).json({
        success: false,
        error: "Failed to create complaint"
      });
    }

    console.log("[COMPLAINT] Complaint created with ID:", complaint.id);

    // Step 3: Auto-assign departments based on complaint type
    try {
      if (complaint.type) {
        const { data: autoAssignResult } = await supabase
          .rpc('auto_assign_departments', { p_complaint_id: complaint.id });
        
        if (autoAssignResult && autoAssignResult.length > 0) {
          const [assignmentResult] = autoAssignResult;
          console.log("[COMPLAINT] Auto-assignment successful:", {
            primary: assignmentResult.primary_dept,
            secondary: assignmentResult.secondary_depts
          });
        }
      }
    } catch (autoAssignError) {
      console.warn("[COMPLAINT] Auto-assignment failed:", autoAssignError.message);
      // Continue with manual department assignment
    }

    // Step 4: Try to assign a coordinator
    try {
      if (complaint.primary_department || departmentArray.length > 0) {
        const targetDept = complaint.primary_department || departmentArray[0];
        
        // Find an active coordinator for this department
        const { data: coordinator } = await supabase
          .from('complaint_coordinators')
          .select('user_id')
          .eq('department', targetDept)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (coordinator) {
          const { error: coordinatorError } = await supabase
            .from('complaints')
            .update({ assigned_coordinator_id: coordinator.user_id })
            .eq('id', complaint.id);

          if (!coordinatorError) {
            console.log("[COMPLAINT] Coordinator assigned:", coordinator.user_id);
            
            // Log coordinator assignment
            await supabase.rpc('log_complaint_action', {
              p_complaint_id: complaint.id,
              p_action_type: 'coordinator_assigned',
              p_to_dept: targetDept,
              p_reason: 'Auto-assigned available coordinator'
            });
          }
        }
      }
    } catch (coordinatorError) {
      console.warn("[COMPLAINT] Coordinator assignment failed:", coordinatorError.message);
    }

    // Step 5: Log complaint creation in audit trail
    try {
      await supabase.rpc('log_complaint_action', {
        p_complaint_id: complaint.id,
        p_action_type: 'created',
        p_reason: 'Complaint submitted by citizen',
        p_details: JSON.stringify({
          title: complaint.title,
          type: complaint.type,
          departments: departmentArray,
          has_evidence: req.files && req.files.length > 0
        })
      });
    } catch (logError) {
      console.warn("[COMPLAINT] Audit logging failed:", logError.message);
    }

    // Step 6: Handle file uploads (existing logic)
    let evidenceFiles = [];
    if (req.files && req.files.length > 0) {
      console.log(`[COMPLAINT] Processing ${req.files.length} evidence files`);
      
      for (const file of req.files) {
        try {
          const fileName = `${complaint.id}/${Date.now()}-${file.originalname}`;
          
          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('complaint-evidence')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
              upsert: false
            });

          if (uploadError) {
            console.error("[COMPLAINT] File upload error:", uploadError);
            continue; // Skip this file, don't fail the entire complaint
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('complaint-evidence')
            .getPublicUrl(fileName);

          evidenceFiles.push({
            fileName: file.originalname,
            filePath: fileName,
            fileType: file.mimetype,
            fileSize: file.size,
            publicUrl: publicUrl
          });

          console.log("[COMPLAINT] File uploaded:", file.originalname);
        } catch (fileError) {
          console.error("[COMPLAINT] File processing error:", fileError);
        }
      }

      // Update complaint with evidence metadata
      if (evidenceFiles.length > 0) {
        const { error: updateError } = await supabase
          .from('complaints')
          .update({ evidence: evidenceFiles })
          .eq('id', complaint.id);

        if (updateError) {
          console.error("[COMPLAINT] Evidence update error:", updateError);
        } else {
          console.log(`[COMPLAINT] Updated complaint with ${evidenceFiles.length} evidence files`);
        }
      }
    }

    // Step 7: Get the final complaint with all updates
    const { data: finalComplaint } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaint.id)
      .single();

    // Step 8: Return enhanced response
    res.json({
      success: true,
      data: {
        ...finalComplaint,
        evidence: evidenceFiles
      },
      message: "Complaint submitted successfully",
      workflow: {
        auto_assigned: !!finalComplaint.primary_department,
        coordinator_assigned: !!finalComplaint.assigned_coordinator_id,
        workflow_status: finalComplaint.workflow_status
      }
    });

    console.log("[COMPLAINT] Enhanced complaint submission completed successfully");

  } catch (error) {
    console.error("[COMPLAINT] Submission error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during complaint submission"
    });
  }
});

/**
 * Get user's complaints
 */
app.get("/api/complaints/my", authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    const { page = 1, limit = 10, status, type } = req.query;
    
    let query = supabase
      .from('complaints')
      .select('*')
      .eq('submitted_by', user.id)
      .order('submitted_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: complaints, error } = await query;

    if (error) {
      console.error("[COMPLAINT] Fetch error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch complaints"
      });
    }

    res.json({
      success: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: complaints.length
      }
    });

  } catch (error) {
    console.error("[COMPLAINT] Fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * Get complaint by ID (for viewing details)
 */
app.get("/api/complaints/:id", authenticateUser, async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    const { data: complaint, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("[COMPLAINT] Fetch by ID error:", error);
      return res.status(404).json({
        success: false,
        error: "Complaint not found"
      });
    }

    // Check if user owns this complaint or has appropriate role
    const userRole = user.user_metadata?.role || 'citizen';
    const isOwner = complaint.submitted_by === user.id;
    const hasPermission = isOwner || 
                         userRole === 'super-admin' || 
                         /^lgu-/.test(userRole);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "Access denied"
      });
    }

    res.json({
      success: true,
      data: complaint
    });

  } catch (error) {
    console.error("[COMPLAINT] Fetch by ID error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * Update complaint status (LGU/Admin only)
 */
app.patch("/api/complaints/:id/status", authenticateUser, requireRole([/^lgu-/, "super-admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const { user } = req;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required"
      });
    }

    // Valid status values
    const validStatuses = ['pending review', 'in progress', 'resolved', 'rejected', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status value"
      });
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    };

    if (notes) {
      updateData.admin_notes = notes;
    }

    const { data: complaint, error } = await supabase
      .from('complaints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("[COMPLAINT] Status update error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update complaint status"
      });
    }

    res.json({
      success: true,
      data: complaint,
      message: "Complaint status updated successfully"
    });

    console.log(`[COMPLAINT] Status updated for complaint ${id}: ${status}`);

  } catch (error) {
    console.error("[COMPLAINT] Status update error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * Get all complaints (LGU/Admin dashboard)
 */
app.get("/api/complaints", authenticateUser, requireRole([/^lgu-/, "super-admin"]), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, department, search } = req.query;
    
    let query = supabase
      .from('complaints')
      .select(`
        *,
        submitted_by_profile:submitted_by (
          email,
          raw_user_meta_data
        )
      `)
      .order('submitted_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (department) {
      query = query.contains('department_r', [department]);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,descriptive_su.ilike.%${search}%`);
    }

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: complaints, error } = await query;

    if (error) {
      console.error("[COMPLAINT] Admin fetch error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch complaints"
      });
    }

    res.json({
      success: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: complaints.length
      }
    });

  } catch (error) {
    console.error("[COMPLAINT] Admin fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});
// ============================================================================
// COORDINATOR MANAGEMENT API ROUTES
// ============================================================================

/**
 * Get all coordinators
 */
app.get("/api/coordinators", authenticateUser, requireRole([/^lgu-admin/, "super-admin"]), async (req, res) => {
  try {
    const { department } = req.query;
    
    let query = supabase
      .from('complaint_coordinators')
      .select(`
        id,
        user_id,
        department,
        assigned_at,
        is_active,
        created_at
      `)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    // Filter by department if specified
    if (department) {
      query = query.eq('department', department);
    }

    const { data: coordinators, error } = await query;

    if (error) {
      console.error("[COORDINATOR] Fetch error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch coordinators"
      });
    }

    res.json({
      success: true,
      data: coordinators
    });

    console.log(`[COORDINATOR] Retrieved ${coordinators.length} coordinators`);

  } catch (error) {
    console.error("[COORDINATOR] Fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * Assign user as coordinator
 */
app.post("/api/coordinators", authenticateUser, requireRole(["super-admin"]), async (req, res) => {
  try {
    const { user_id, department } = req.body;
    const { user } = req;

    // Validation
    if (!user_id || !department) {
      return res.status(400).json({
        success: false,
        error: "User ID and department are required"
      });
    }

    // Check if already a coordinator for this department
    const { data: existing } = await supabase
      .from('complaint_coordinators')
      .select('id')
      .eq('user_id', user_id)
      .eq('department', department)
      .eq('is_active', true)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "User is already a coordinator for this department"
      });
    }

    // Create coordinator assignment
    const { data: coordinator, error: insertError } = await supabase
      .from('complaint_coordinators')
      .insert({
        user_id,
        department,
        created_by: user.id,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("[COORDINATOR] Assignment error:", insertError);
      return res.status(500).json({
        success: false,
        error: "Failed to assign coordinator"
      });
    }

    res.json({
      success: true,
      data: coordinator,
      message: `User assigned as coordinator for ${department} department`
    });

    console.log(`[COORDINATOR] Assigned user ${user_id} as coordinator for ${department}`);

  } catch (error) {
    console.error("[COORDINATOR] Assignment error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * Remove coordinator assignment
 */
app.delete("/api/coordinators/:id", authenticateUser, requireRole(["super-admin"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Get coordinator details before deletion
    const { data: coordinator, error: fetchError } = await supabase
      .from('complaint_coordinators')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !coordinator) {
      return res.status(404).json({
        success: false,
        error: "Coordinator assignment not found"
      });
    }

    // Soft delete by setting is_active to false
    const { error: updateError } = await supabase
      .from('complaint_coordinators')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      console.error("[COORDINATOR] Removal error:", updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to remove coordinator"
      });
    }

    res.json({
      success: true,
      message: `Coordinator assignment removed for ${coordinator.department} department`
    });

    console.log(`[COORDINATOR] Removed coordinator ${id} for ${coordinator.department}`);

  } catch (error) {
    console.error("[COORDINATOR] Removal error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * Check if current user is a coordinator
 */
app.get("/api/coordinators/me", authenticateUser, async (req, res) => {
  try {
    const { user } = req;

    const { data: coordinatorRoles, error } = await supabase
      .from('complaint_coordinators')
      .select('id, department, assigned_at')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error("[COORDINATOR] Self-check error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to check coordinator status"
      });
    }

    const isCoordinator = coordinatorRoles && coordinatorRoles.length > 0;

    res.json({
      success: true,
      data: {
        is_coordinator: isCoordinator,
        departments: coordinatorRoles?.map(role => role.department) || [],
        assignments: coordinatorRoles || []
      }
    });

  } catch (error) {
    console.error("[COORDINATOR] Self-check error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
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

app.listen(PORT, () => {
  console.log("🚀 Server is running");
  console.log(`📍 Running at: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;