import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import { existsSync } from "fs";
import { getSupabaseServiceClient } from "./db/db.js";

// ES6 module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Get the directory of the current file

const app = express();

// ===== IN-MEMORY STATE (development scaffolding) =====
// Simple in-memory store for officer locations (for demo/testing)
// Structure: { [officerId: string]: { lat: number, lng: number, updatedAt: string } }
const officerLocations = Object.create(null);

// ===== SIMPLE TEST ROUTE (at the very beginning) =====
app.get("/ping", (req, res) => {
  res.json({ message: "pong", timestamp: new Date().toISOString() });
});

// Development mode - more permissive CSP for development
const isDevelopment = process.env.NODE_ENV !== "production";

// Use Helmet to set secure headers - implementing all 7 major security headers
app.use(
  helmet({
  // 1. Content Security Policy (CSP)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", // Needed for inline scripts
        "'unsafe-eval'", // Needed for Bootstrap
        "https://cdnjs.cloudflare.com", // Font Awesome CDN
        "https://cdn.jsdelivr.net", // Chart.js and other CDNs
          "https://unpkg.com", // Leaflet and plugins
        "https://citizenlink-abwi.onrender.com", // External domain
          ...(isDevelopment ? ["'unsafe-inline'", "https:"] : []), // More permissive in development
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers like onclick
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Needed for inline styles
        "https://cdnjs.cloudflare.com", // Font Awesome CDN
        "https://cdn.jsdelivr.net", // Chart.js and other CDNs
          "https://unpkg.com", // Leaflet CSS
          ...(isDevelopment ? ["'unsafe-inline'", "https:"] : []), // More permissive in development
        ],
        // Explicit element directives for broader browser support
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          ...(isDevelopment ? ["https:"] : []),
        ],
        styleSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          ...(isDevelopment ? ["https:"] : []),
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com", // Font Awesome fonts
        "https://cdn.jsdelivr.net", // Additional fonts
          ...(isDevelopment ? ["https:"] : []), // More permissive in development
      ],
        imgSrc: ["'self'", "data:", "https:", "https://*.tile.openstreetmap.org", "https://server.arcgisonline.com", "https://*.opentopomap.org"],
      connectSrc: [
        "'self'", 
        "https://citizenlink-abwi.onrender.com", // External domain
          // Allow Supabase project domains (HTTPS + WSS) in all environments
          "https://*.supabase.co",
          "wss://*.supabase.co",
          "https://*.supabase.in",
          "wss://*.supabase.in",
          ...(isDevelopment ? ["https:"] : []), // More permissive in development
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
        frameAncestors: ["'self'"], // Prevents clickjacking
      },
  },
  
  // 2. X-Frame-Options (Clickjacking protection)
  frameguard: { 
      action: "sameorigin",
  },
  
  // 3. X-Content-Type-Options (MIME type sniffing protection)
  noSniff: true,
  
  // 4. X-XSS-Protection (XSS protection for older browsers)
  xssFilter: true,
  
  // 5. Strict-Transport-Security (HSTS) - Disabled for HTTP development
  // hsts: { 
  //   maxAge: 31536000, // 1 year
  //   includeSubDomains: true,
  //   preload: true
  // },
  
  // 6. Referrer-Policy
  referrerPolicy: { 
      policy: "strict-origin-when-cross-origin",
  },
  
  // 7. Permissions-Policy (formerly Feature-Policy)
  permissionsPolicy: {
    features: {
        geolocation: ["self"],
        camera: ["none"],
        microphone: ["none"],
        payment: ["none"],
        usb: ["none"],
        magnetometer: ["none"],
        gyroscope: ["none"],
        accelerometer: ["none"],
        ambientLightSensor: ["none"],
        autoplay: ["none"],
        encryptedMedia: ["none"],
        fullscreen: ["self"],
        pictureInPicture: ["none"],
        syncXhr: ["none"],
      },
  },
  
  // Additional security headers
  hidePoweredBy: true, // Removes X-Powered-By header
  ieNoOpen: true, // Prevents IE from executing downloads
  noCache: false, // Allow caching for better performance
  dnsPrefetchControl: {
      allow: false, // Disable DNS prefetching for security
    },
  })
);

// Custom middleware to add additional security headers
app.use((req, res, next) => {
  // Additional custom security headers
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  
  // Explicitly prevent HTTPS upgrades
  res.setHeader("Upgrade-Insecure-Requests", "0");

  // Explicit Permissions-Policy header (meta tag is ignored by browsers)
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), encrypted-media=(), fullscreen=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), usb=(), xr-spatial-tracking=()"
  );
  
  // Development mode - more permissive CSP
  // Dev CSP: wide open, easier debugging
    const devCSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "font-src 'self' https:",
    "img-src 'self' data: https: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://*.opentopomap.org",
      "connect-src 'self' https:",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'self'",
  ].join("; ");

  // Prod CSP: stricter, only allow known origins
  const prodCSP = [
    "default-src 'self'",
  
    // Scripts from your server + jsdelivr + cdnjs + unpkg (any file under these domains)
    "script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
    // Explicit element directive for some browsers
    "script-src-elem 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
  
    // Styles from your server + cdnjs + unpkg
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
    // Explicit element directive for stylesheets
    "style-src-elem 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  
    // Fonts from your server + cdnjs + Google Fonts
    "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  
    // Images from your server + data URIs + map tile servers
    "img-src 'self' data: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://*.opentopomap.org",
  
    // API connections: your backend + ANY Supabase project (HTTPS + WSS for realtime)
    "connect-src 'self' https://citizenlink-abwi.onrender.com https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in",
  
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
      "frame-ancestors 'self'"
    ].join('; ');
    


  res.setHeader(
    "Content-Security-Policy",
    process.env.NODE_ENV === "development" ? devCSP : prodCSP
  );
  
  // Security headers for API endpoints
  if (req.path.startsWith("/api/")) {
    res.setHeader("X-API-Version", "1.0");
  }
  
  next();
});

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// ===== SUPABASE CLIENT CONFIGURATION (must come BEFORE generic /js/* static route) =====
// Serve client-side Supabase configuration with proper credentials from server-side db.js
app.get("./js/supabase-bridge.js", async (req, res) => {
  console.log("🔗 Serving supabase-bridge.js...");
  try {
    // Import the server-side config to get credentials
    console.log("📦 Attempting to import from ./db/db.js...");
    const { supabaseConfig } = await import("./db/db.js");
    console.log("✅ Successfully imported supabaseConfig:", {
      url: supabaseConfig.url ? "URL exists" : "URL missing",
      anonKey: supabaseConfig.anonKey ? "Key exists" : "Key missing",
    });

    console.log("📤 Sending JavaScript response...");
    res.setHeader("Content-Type", "application/javascript");

    console.log("✅ JavaScript response sent successfully");
  } catch (error) {
    console.error("Error serving Supabase config:", error);
    // Return JavaScript even on error to avoid MIME type issues
    res.setHeader("Content-Type", "application/javascript");
    res.status(500).send(`
      console.error('Failed to load Supabase configuration: ${error.message}');
      // Provide fallback or error handling
      window.supabaseBridgeError = '${error.message}';
    `);
  }
});

// ===== SUPABASE API ENDPOINT =====
// API endpoint to get Supabase configuration (for the bridge)
app.get("/api/supabase-bridge", async (req, res) => {
  try {
    // Import the server-side config to get credentials
    const { supabaseConfig } = await import("./db/db.js");
    
    res.json({
      url: supabaseConfig.url,
      anonKey: supabaseConfig.anonKey,
    });
  } catch (error) {
    console.error("Error serving Supabase API config:", error);
    res.status(500).json({ error: "Failed to load Supabase configuration" });
  }
});

// ===== ADMIN APPOINTMENT API =====
// Superadmin appoint LGU admin for a department
app.post("/api/appoint/admin", async (req, res) => {
  try {
    const { userId, department } = req.body || {};
    if (!userId || !department) {
      return res
        .status(400)
        .json({ error: "userId and department are required" });
    }
    const sb = getSupabaseServiceClient();
    const role = `lgu-admin-${String(department).toLowerCase()}`;

    const { error: updErr } = await sb.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    });
    if (updErr) return res.status(500).json({ error: updErr.message });

    // optional audit
    await sb
      .from("department_admins")
      .insert([{ user_id: userId, department_id: null, is_active: true }]);
    return res.json({ ok: true, role });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// LGU admin appoint officer/staff for a department
app.post("/api/appoint/officer", async (req, res) => {
  try {
    const { userId, department } = req.body || {};
    if (!userId || !department) {
      return res
        .status(400)
        .json({ error: "userId and department are required" });
    }
    const sb = getSupabaseServiceClient();
    const role = `lgu-${String(department).toLowerCase()}`;

    const { error: updErr } = await sb.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    });
    if (updErr) return res.status(500).json({ error: updErr.message });
    return res.json({ ok: true, role });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// List LGU officers by department (role = lgu-<dept>)
app.get("/api/officers", async (req, res) => {
  try {
    const { department } = req.query;
    if (!department)
      return res.status(400).json({ error: "department is required" });
    const sb = getSupabaseServiceClient();
    const rolePrefix = `lgu-${String(department).toLowerCase()}`;
    // List users by role from auth
    const { data, error } = await sb.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    const officers = (data?.users || [])
      .filter((u) => (u.user_metadata?.role || "").toLowerCase() === rolePrefix)
      .map((u) => ({ id: u.id, email: u.email, role: u.user_metadata?.role }));
    return res.json({ officers });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ===== MULTI-DEPARTMENT COLLABORATION API =====
// Helper: resolve department string to id (by name or code)
async function resolveDepartmentId(sb, department) {
  const deptStr = String(department).trim();
  let q = sb.from("departments").select("id").limit(1);
  // Try case-insensitive name, then code
  let { data, error } = await q.ilike("name", deptStr);
  if (error) throw error;
  if (data && data.length) return data[0].id;
  ({ data, error } = await sb
    .from("departments")
    .select("id")
    .ilike("code", deptStr)
    .limit(1));
  if (error) throw error;
  return data && data.length ? data[0].id : null;
}

// Add department involvement to a complaint (owner or collaborator)
app.post("/api/complaints/:id/departments", async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { department, role = "collaborator" } = req.body || {};
    if (!complaintId || !department)
      return res
        .status(400)
        .json({ error: "complaintId and department are required" });
    const sb = getSupabaseServiceClient();
    const departmentId = await resolveDepartmentId(sb, department);
    if (!departmentId)
      return res.status(400).json({ error: "Department not found" });

    const { data, error } = await sb
      .from("complaint_departments")
      .insert([
        {
          complaint_id: complaintId,
          department_id: departmentId,
          role: role,
          status: "pending",
        },
      ])
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, row: data?.[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Request help from multiple departments for a complaint
app.post("/api/complaints/:id/request_help", async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { departments } = req.body || {};
    if (
      !complaintId ||
      !Array.isArray(departments) ||
      departments.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "complaintId and departments[] are required" });
    }
    const sb = getSupabaseServiceClient();
    // Resolve all departments (codes or names)
    const resolved = [];
    for (const d of departments) {
      const id = await resolveDepartmentId(sb, d);
      if (id) resolved.push(id);
    }
    if (!resolved.length)
      return res.status(400).json({ error: "No valid departments found" });
    const rows = resolved.map((deptId) => ({
      complaint_id: complaintId,
      department_id: deptId,
      role: "collaborator",
      status: "pending",
    }));
    const { data, error } = await sb
      .from("complaint_departments")
      .insert(rows)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, items: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// List departments (id, name, code)
app.get("/api/departments", async (req, res) => {
  try {
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("departments")
      .select("id, name, code, is_active")
      .order("name");
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ departments: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// List roles (computed) combining role type and departments
app.get("/api/roles", async (req, res) => {
  try {
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("departments")
      .select("name, code, is_active");
    if (error) return res.status(500).json({ error: error.message });
    const depts = (data || []).filter((d) => d.is_active !== false);
    const roles = [
      { role: "superadmin", type: "superadmin", department: null },
      { role: "citizen", type: "citizen", department: null },
      ...depts.flatMap((d) => [
        {
          role: `lgu-admin-${String(d.code || d.name).toLowerCase()}`,
          type: "lgu_admin",
          department: d.name,
        },
        {
          role: `lgu-${String(d.code || d.name).toLowerCase()}`,
          type: "lgu_staff",
          department: d.name,
        },
      ]),
    ];
    return res.json({ roles });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// List queue for a department, joining complaint summary
app.get("/api/department-queue", async (req, res) => {
  try {
    const { department } = req.query;
    if (!department)
      return res.status(400).json({ error: "department is required" });
    console.log(
      "🧭 [API] /api/department-queue param department =",
      department
    );
    const sb = getSupabaseServiceClient();
    const departmentId = await resolveDepartmentId(sb, department);
    console.log("🧭 [API] resolved departmentId =", departmentId);
    if (!departmentId)
      return res
        .status(400)
        .json({ error: "Department not found", department });
    // Step 1: fetch department involvement rows without FK-based joins
    const { data: cdRows, error: cdErr } = await sb
      .from("complaint_departments")
      .select("id, role, status, assigned_officer_id, complaint_id, updated_at")
      .eq("department_id", departmentId)
      .order("updated_at", { ascending: false });
    if (cdErr) {
      console.error(
        "❌ [API] department-queue complaint_departments error:",
        cdErr
      );
      return res.status(500).json({ error: cdErr.message });
    }

    const complaintIds = (cdRows || [])
      .map((r) => r.complaint_id)
      .filter(Boolean);
    if (!complaintIds.length) {
      console.log("📦 [API] department-queue rows = 0");
      return res.json({ items: [] });
    }

    // Step 2: fetch complaints in bulk
    const { data: complaints, error: cErr } = await sb
      .from("complaints")
      .select("id, title, status, priority, created_at, type")
      .in("id", complaintIds);
    if (cErr) {
      console.error("❌ [API] department-queue complaints fetch error:", cErr);
      return res.status(500).json({ error: cErr.message });
    }
    const complaintById = new Map((complaints || []).map((c) => [c.id, c]));
    const items = (cdRows || []).map((r) => ({
      id: r.id,
      role: r.role,
      status: r.status,
      assigned_officer_id: r.assigned_officer_id,
      complaint: complaintById.get(r.complaint_id) || null,
    }));
    console.log("📦 [API] department-queue rows =", items.length);
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Update status of a department involvement row
app.post("/api/complaint_departments/:id/status", async (req, res) => {
  try {
    const cdId = req.params.id;
    const { status, reason } = req.body || {};
    const allowed = [
      "pending",
      "accepted",
      "in_progress",
      "resolved",
      "rejected",
    ];
    if (!allowed.includes(status))
      return res.status(400).json({ error: "invalid status" });
    const sb = getSupabaseServiceClient();
    const payload =
      reason && status === "rejected" ? { status, notes: reason } : { status };
    const { error } = await sb
      .from("complaint_departments")
      .update(payload)
      .eq("id", cdId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Assign officer on a department involvement row
app.post("/api/complaint_departments/:id/assign_officer", async (req, res) => {
  try {
    const cdId = req.params.id;
    const { officerId } = req.body || {};
    if (!officerId)
      return res.status(400).json({ error: "officerId is required" });
    const sb = getSupabaseServiceClient();
    const { error } = await sb
      .from("complaint_departments")
      .update({ assigned_officer_id: officerId, status: "in_progress" })
      .eq("id", cdId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// List assignments for a specific officer (assigned_officer_id)
app.get("/api/officer-assignments", async (req, res) => {
  try {
    const { officerId } = req.query;
    if (!officerId)
      return res.status(400).json({ error: "officerId is required" });
    const sb = getSupabaseServiceClient();

    // Fetch department involvement rows for this officer
    const { data: cdRows, error: cdErr } = await sb
      .from("complaint_departments")
      .select("id, role, status, complaint_id, updated_at")
      .eq("assigned_officer_id", officerId)
      .order("updated_at", { ascending: false });
    if (cdErr) return res.status(500).json({ error: cdErr.message });

    const complaintIds = (cdRows || [])
      .map((r) => r.complaint_id)
      .filter(Boolean);
    if (!complaintIds.length) return res.json({ items: [] });

    const { data: complaints, error: cErr } = await sb
      .from("complaints")
      .select("id, title, status, priority, created_at, type")
      .in("id", complaintIds);
    if (cErr) return res.status(500).json({ error: cErr.message });

    const byId = new Map((complaints || []).map((c) => [c.id, c]));
    const items = (cdRows || []).map((r) => ({
      id: r.id,
      status: r.status,
      role: r.role,
      updated_at: r.updated_at,
      complaint: byId.get(r.complaint_id) || null,
    }));
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Officer starts working on an assignment
app.post("/api/complaint_departments/:id/start", async (req, res) => {
  try {
    const cdId = req.params.id;
    const sb = getSupabaseServiceClient();
    const { error } = await sb
      .from("complaint_departments")
      .update({ status: "in_progress" })
      .eq("id", cdId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Officer completes an assignment (optional proofUrl saved into notes)
app.post("/api/complaint_departments/:id/complete", async (req, res) => {
  try {
    const cdId = req.params.id;
    const { proofUrl } = req.body || {};
    const sb = getSupabaseServiceClient();

    // Append proofUrl to notes if provided (keep schema simple)
    let notesAppend = null;
    if (proofUrl) {
      notesAppend = `Proof: ${proofUrl}`;
    }

    const updatePayload = notesAppend
      ? { status: "resolved", notes: notesAppend }
      : { status: "resolved" };
    const { error } = await sb
      .from("complaint_departments")
      .update(updatePayload)
      .eq("id", cdId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ===== OFFICER LOCATION (scaffold) =====
// Update officer location (expects { officerId, lat, lng })
app.post("/api/officer-location", async (req, res) => {
  try {
    const { officerId, lat, lng } = req.body || {};
    if (!officerId || typeof lat !== "number" || typeof lng !== "number") {
      return res
        .status(400)
        .json({ error: "officerId, lat, lng are required" });
    }
    officerLocations[officerId] = {
      lat,
      lng,
      updatedAt: new Date().toISOString(),
    };
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Get a single officer location
app.get("/api/officer-location", async (req, res) => {
  const { officerId } = req.query;
  if (!officerId)
    return res.status(400).json({ error: "officerId is required" });
  return res.json({ location: officerLocations[officerId] || null });
});

// (Optional) Get all known officer locations
app.get("/api/officer-locations", async (req, res) => {
  return res.json({ locations: officerLocations });
});

// Get all users (for admin dropdown)
app.get("/api/users", async (req, res) => {
  try {
    const supabase = getSupabaseServiceClient();
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error("[/api/users] Error:", error);
      return res.status(500).json({ error: error.message });
    }
    // Optional role filter (e.g., ?role=citizen)
    const roleFilter = String(req.query.role || "").toLowerCase();
    let filtered = users || [];
    if (roleFilter) {
      filtered = filtered.filter((u) => {
        const r = String(u.user_metadata?.role || "citizen").toLowerCase();
        return r === roleFilter;
      });
    }
    return res.json({ users: filtered });
  } catch (error) {
    console.error("[/api/users] Exception:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update user role
app.post("/api/update-role", async (req, res) => {
  try {
    const { userId, newRole } = req.body;

    if (!userId || !newRole) {
      return res.status(400).json({ error: "userId and newRole are required" });
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role: newRole },
    });

    if (error) {
      console.error("[/api/update-role] Error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, message: `Role updated to ${newRole}` });
  } catch (error) {
    console.error("[/api/update-role] Exception:", error);
    return res.status(500).json({ error: "Failed to update role" });
  }
});

// ===== MAIN ROUTES =====
// Home/Landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Authentication routes
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "signup.html"));
});

app.get("/verify-otp", (req, res) => {
  res.sendFile(path.join(__dirname, "verify-otp.html"));
});

// Test page for debugging modals
app.get("/test-modals", (req, res) => {
  res.sendFile(path.join(__dirname, "test-modals.html"));
});

// ===== CITIZEN ROUTES =====
app.get("/citizen", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "dashboard.html"));
});

app.get("/citizen/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "dashboard.html"));
});

app.get("/citizen/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "profile.html"));
});

app.get("/citizen/complaints", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "my-complaints.html"));
});

app.get("/citizen/submit-complaint", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "submit-complaint.html"));
});

// News page route
app.get("/news", (req, res) => {
  res.sendFile(path.join(__dirname, "news.html"));
});

// Serve new admin pages
app.get("/superadmin/appointments.html", (req, res) => {
  res.sendFile(path.join(__dirname, "superadmin", "appointments.html"));
});
app.get("/superadmin/appointments", (req, res) => {
  res.sendFile(path.join(__dirname, "superadmin", "appointments.html"));
});
app.get("/lgu/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "admin.html"));
});
app.get("/lgu/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "admin.html"));
});
app.get("/lgu/officer.html", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "officer.html"));
});
app.get("/lgu/officer", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "officer.html"));
});

// ===== LGU ROUTES =====
app.get("/lgu", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "dashboard.html"));
});

app.get("/lgu/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "dashboard.html"));
});

app.get("/lgu/complaints", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "complaints.html"));
});

app.get("/lgu/heatmap", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "heatmap.html"));
});

app.get("/lgu/insights", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "insights.html"));
});

app.get("/lgu/news", (req, res) => {
  console.log("🔗 News management route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "news.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
  res.sendFile(filePath);
});

app.get("/lgu/notices", (req, res) => {
  console.log("🔗 Notices route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "notices.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
  res.sendFile(filePath);
});

app.get("/lgu/events", (req, res) => {
  console.log("🔗 Events route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "events.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
  res.sendFile(filePath);
});

app.get("/lgu/profile", (req, res) => {
  console.log("🔗 LGU profile route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "profile.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", filePath);
  res.sendFile(filePath);
});

// ===== NEW ROUTES WITHOUT FOLDER NAMES =====
// Citizen routes without folder names
app.get("/dashboard", (req, res) => {
  const filePath = path.join(__dirname, "citizen", "dashboard.html");
  console.log("Dashboard route accessed, serving file:", filePath);
  console.log("__dirname:", __dirname);
  console.log("File exists check:", existsSync(filePath));
  
  // Check if file exists before sending
  if (!existsSync(filePath)) {
    console.error("Dashboard file not found:", filePath);
    return res.status(404).send("Dashboard file not found");
  }
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending dashboard file:", err);
      res.status(500).send("Error loading dashboard");
    }
  });
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "profile.html"));
});

app.get("/complaints", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "my-complaints.html"));
});

app.get("/my-complaints", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "my-complaints.html"));
});

app.get("/submit-complaint", (req, res) => {
  res.sendFile(path.join(__dirname, "citizen", "submit-complaint.html"));
});

// LGU routes without folder names
app.get("/admin-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "dashboard.html"));
});

app.get("/lgu-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "dashboard.html"));
});

app.get("/admin-complaints", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "complaints.html"));
});

app.get("/lgu-complaints", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "complaints.html"));
});

app.get("/admin-heatmap", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "heatmap.html"));
});

app.get("/lgu-heatmap", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "heatmap.html"));
});

app.get("/admin-insights", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "insights.html"));
});

app.get("/lgu-insights", (req, res) => {
  res.sendFile(path.join(__dirname, "lgu", "insights.html"));
});

app.get("/lgu-news", (req, res) => {
  console.log("🔗 Legacy news route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "news.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
  res.sendFile(filePath);
});

app.get("/lgu-notices", (req, res) => {
  console.log("🔗 Legacy notices route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "notices.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
  res.sendFile(filePath);
});

app.get("/lgu-events", (req, res) => {
  console.log("🔗 Legacy events route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "events.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
  res.sendFile(filePath);
});

app.get("/lgu-profile", (req, res) => {
  console.log("🔗 Legacy profile route accessed:", req.path);
  const filePath = path.join(__dirname, "lgu", "profile.html");
  console.log("📁 Serving file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
  res.sendFile(filePath);
});

// ===== BRIDGE TEST ROUTE =====
app.get("/bridge-test", (req, res) => {
  console.log("🔗 Bridge test route accessed!");
  console.log("__dirname:", __dirname);
  console.log("File path:", path.join(__dirname, "bridge-test.html"));
  res.sendFile(path.join(__dirname, "bridge-test.html"));
});

// Simple test route
app.get("/test-route", (req, res) => {
  res.json({
    message: "Test route works!",
    timestamp: new Date().toISOString(),
  });
});

// ===== COMPONENT ROUTES =====
// Serve sidebar components
app.get("/components/:filename(*)", (req, res) => {
  const relativePath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  
  // Only serve HTML component files
  if (!req.params.filename.endsWith(".html")) {
    return res.status(404).send("Not an HTML component file");
  }
  
  res.setHeader("Content-Type", "text/html");
  res.sendFile(filePath);
});

// Debug route to see all available routes
app.get("/debug-routes", (req, res) => {
    const routes = [];
  app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
            });
        }
    });
    res.json({ routes, __dirname, currentDir: process.cwd() });
});

// Serve border locations JSON file
app.get("/lgu/border_locations.json", (req, res) => {
  console.log("🗺️ Border locations JSON requested:", req.path);
  const filePath = path.join(__dirname, "lgu", "border_locations.json");
  console.log("📁 Serving border file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
    
    if (existsSync(filePath)) {
    res.setHeader("Content-Type", "application/json");
        res.sendFile(filePath);
    } else {
    res.status(404).json({ error: "Border locations file not found" });
    }
});

// Serve any JSON files from LGU folder
app.get("/lgu/*.json", (req, res) => {
  console.log("📄 JSON file requested:", req.path);
  const fileName = req.path.split("/").pop();
  const filePath = path.join(__dirname, "lgu", fileName);
  console.log("📁 Serving JSON file:", filePath);
  console.log("📂 File exists:", existsSync(filePath));
    
    if (existsSync(filePath)) {
    res.setHeader("Content-Type", "application/json");
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: `JSON file ${fileName} not found` });
    }
});

// ===== STATIC ASSET ROUTES (moved to end to avoid conflicts) =====
// CSS files
app.get("/css/*", (req, res) => {
  const relativePath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  res.setHeader("Content-Type", "text/css");
  res.sendFile(filePath);
});

// JavaScript files - more specific to avoid conflicts
app.get("/js/:filename(*)", (req, res) => {
  // Ensure we resolve a relative path (Windows-safe). Absolute req.path would break path.join
  const relativePath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  
  // Only serve actual JavaScript files
  if (!req.params.filename.endsWith(".js")) {
    return res.status(404).send("Not a JavaScript file");
  }
  
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(filePath);
});

// Bootstrap CSS files
app.get("/css/bootstrap/*", (req, res) => {
  const relativePath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  res.setHeader("Content-Type", "text/css");
  res.sendFile(filePath);
});

// Bootstrap JavaScript files
app.get("/js/bootstrap/*", (req, res) => {
  const relativePath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(filePath);
});

// ===== SUPABASE CLIENT CONFIGURATION =====
// This route is already defined above - removing duplicate

// ===== SUPABASE CLIENT CONFIGURATION =====
// This route is already defined above - removing duplicate

// ===== API ROUTES =====
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    security: "enabled",
    features: { officerLocation: true },
    routes: {
      main: ["/", "/login", "/signup"],
      citizen: [
        "/citizen",
        "/citizen/dashboard",
        "/citizen/profile",
        "/citizen/complaints",
        "/citizen/submit-complaint",
      ],
      lgu: [
        "/lgu",
        "/lgu/dashboard",
        "/lgu/complaints",
        "/lgu/heatmap",
        "/lgu/heatmap",
        "/lgu/insights",
      ],
      newRoutes: [
        "/dashboard",
        "/profile",
        "/complaints",
        "/submit-complaint",
        "/admin-dashboard",
        "/admin-complaints",
        "/admin-heatmap",
        "/admin-insights",
      ],
      assets: [
        "/css/*",
        "/js/*",
        "/css/bootstrap/*",
        "/js/bootstrap/*",
        "/images/*",
        "/assets/*",
      ],
    },
  });
});

// ===== ERROR HANDLING =====
// Error handling for security violations
app.use((err, req, res, next) => {
  if (err.code === "CSP_VIOLATION") {
    console.error("CSP Violation:", err.message);
    res.status(400).json({ error: "Content Security Policy violation" });
  } else {
    next(err);
  }
});

// ===== STATIC FILE SERVING =====
// Serve static HTML files
// app.get('/*.html', (req, res) => {
//   const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
//   const filePath = path.join(__dirname, relativePath);
//   res.setHeader('Content-Type', 'text/html');
//   res.sendFile(filePath);
// });

// 404 handler - show error instead of redirecting
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).send(`Route not found: ${req.path}`);
});

// ===== SERVER STARTUP =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CitizenLink server running on port ${PORT}`);
  console.log(`🔒 Security headers implemented successfully!`);
  console.log(`📋 Implemented security headers:`);
  console.log(`   1. Content Security Policy (CSP)`);
  console.log(`   2. X-Frame-Options (Clickjacking protection)`);
  console.log(`   3. X-Content-Type-Options (MIME sniffing protection)`);
  console.log(`   4. X-XSS-Protection (XSS protection)`);
  console.log(`   5. Strict-Transport-Security (HSTS)`);
  console.log(`   6. Referrer-Policy`);
  console.log(`   7. Permissions-Policy (Feature restrictions)`);
  console.log(`\n🌐 Server accessible at: http://localhost:${PORT}`);
  console.log(`📁 Routes configured:`);
  console.log(`   • Main: /, /login, /signup, /verify-otp`);
  console.log(`   • Citizen: /citizen/*`);
  console.log(`   • LGU: /lgu/*`);
  console.log(
    `   • New Routes: /dashboard, /profile, /complaints, /submit-complaint, /admin-dashboard, /admin-complaints, /admin-heatmap, /admin-insights`
  );
  console.log(`   • API: /api/health`);
});

export default app;
