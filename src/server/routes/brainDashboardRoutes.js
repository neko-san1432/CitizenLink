const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const ComplaintService = require("../services/ComplaintService");
const { authenticateUser, requireRole } = require("../middleware/auth");
const path = require("path");
// const fs = require("fs"); // Unused if mock loading is removed

const router = express.Router();

// Simple 30-second TTL cache to avoid redundant DB hits from concurrent polling
let _ttlCache = { data: null, filters: null, expiresAt: 0 };
const TTL_MS = 30 * 1000;

function mapBodyRowToBraincomplaint(row) {
  const description =
    row.description ||
    row.descriptive_su ||
    row.title ||
    row.location_text ||
    "";

  return {
    id: row.id,
    category: row.category || "Others",
    subcategory: row.subcategory ?? null,
    description,
    latitude: row.latitude ?? row.lat,
    longitude: row.longitude ?? row.lng,
    timestamp: row.submitted_at || row.timestamp || new Date().toISOString(),
    source: "body",
    status: row.workflow_status || row.status || null,
    title: row.title || null,
    location_text: row.location_text || null,
    departments: row.departments || row.department_r || [],
    priority: row.priority || null,
  };
}

router.get(
  "/complaints",
  authenticateUser,
  requireRole([
    "super-admin",
    "lgu",
  ]),
  async (req, res) => {
    try {
      const includeResolved =
        req.query.includeResolved !== undefined
          ? String(req.query.includeResolved).toLowerCase() === "true"
          : true;

      const filters = {
        status: req.query.status,
        confirmationStatus: req.query.confirmationStatus,
        category: req.query.category,
        subcategory: req.query.subcategory,
        department: req.query.department,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        includeResolved,
      };

      console.log(`[BRAIN-API] Fetching complaints. Filters:`, {
        startDate: filters.startDate,
        endDate: filters.endDate,
        category: filters.category,
        department: filters.department,
        includeResolved
      });

      // Check TTL cache — reuse if same filters and not expired
      const filterKey = JSON.stringify(filters);
      let complaints;

      if (_ttlCache.data && _ttlCache.filters === filterKey && Date.now() < _ttlCache.expiresAt) {
        complaints = _ttlCache.data;
        console.log(`[BRAIN-API] TTL cache hit: ${complaints.length} complaints`);
      } else {
        // Direct query via ComplaintService
        const complaintService = new ComplaintService();
        const result = await complaintService.getcomplaintLocations(filters);
        complaints = Array.isArray(result)
          ? result
          : Array.isArray(result?.data)
            ? result.data
            : [];
        
        // Update TTL cache
        _ttlCache = { data: complaints, filters: filterKey, expiresAt: Date.now() + TTL_MS };
        console.log(`[BRAIN-API] DB query: ${complaints.length} complaints (cached for ${TTL_MS / 1000}s)`);
      }

      const mappedComplaints = complaints.map(mapBodyRowToBraincomplaint);

      res.json({
        success: true,
        count: mappedComplaints.length,
        complaints: mappedComplaints,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to load brain complaint feed",
        details: error?.message || String(error),
      });
    }
  }
);

router.get(
  "/stream",
  authenticateUser,
  requireRole([
    "super-admin",
    "lgu",
  ]),
  async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    let lastSeen = new Date().toISOString();
    const pollMs = 5000;

    const send = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send({ type: "CONNECTED", clientId: Date.now() });

    const timer = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("complaints")
          .select(
            "id, title, description, workflow_status, priority, latitude, longitude, location_text, submitted_at, departments, category, subcategory"
          )
          .gt("submitted_at", lastSeen)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("submitted_at", { ascending: true })
          .limit(100);

        if (error) {
          send({ type: "ERROR", message: error.message });
          return;
        }

        if (!Array.isArray(data) || data.length === 0) return;

        for (const row of data) {
          const complaint = mapBodyRowToBraincomplaint(row);
          send({ type: "NEW_COMPLAINT", complaint });
        }

        const newest = data[data.length - 1]?.submitted_at;
        if (newest) lastSeen = newest;
      } catch (e) {
        send({ type: "ERROR", message: e?.message || String(e) });
      }
    }, pollMs);

    req.on("close", () => {
      clearInterval(timer);
      res.end();
    });
  }
);

module.exports = router;
