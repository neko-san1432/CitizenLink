const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const ComplaintService = require("../services/ComplaintService");
const { authenticateUser, requireRole } = require("../middleware/auth");
const path = require("path");
// const fs = require("fs"); // Unused if mock loading is removed

const router = express.Router();

function mapBodyRowToBrainComplaint(row) {
  const description =
    row.descriptive_su ||
    row.description ||
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
    department_r: row.department_r || [],
    priority: row.priority || null,
  };
}

router.get(
  "/complaints",
  authenticateUser,
  requireRole([
    "super-admin",
    "complaint-coordinator",
    "lgu-admin",
    "lgu-engineering",
    "lgu-wst",
    "lgu-treasury",
    "lgu-health",
    "lgu-pnp",
    "lgu-bfp",
    "lgu-mayor",
  ]),
  async (req, res) => {
    try {
      const complaintService = new ComplaintService();
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

      const result = await complaintService.getComplaintLocations(filters);
      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : [];
      let complaints = rows.map(mapBodyRowToBrainComplaint);



      res.json({
        success: true,
        count: complaints.length,
        complaints,
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
    "complaint-coordinator",
    "lgu-admin",
    "lgu-engineering",
    "lgu-wst",
    "lgu-treasury",
    "lgu-health",
    "lgu-pnp",
    "lgu-bfp",
    "lgu-mayor",
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
            "id, title, descriptive_su, workflow_status, priority, latitude, longitude, location_text, submitted_at, department_r, category, subcategory"
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
          const complaint = mapBodyRowToBrainComplaint(row);
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
