const express = require("express");
const Database = require("../config/database");
const { authenticateUser } = require("../middleware/auth");

const router = express.Router();
const db = Database.getInstance();
const supabase = db.getClient();
// GET /api/storage/signed-url?path=bucketPath
// SEC-29 FIX: Verify ownership — citizens can only access their own complaint evidence
router.get("/signed-url", authenticateUser, async (req, res) => {
  try {
    const {path} = req.query;
    if (!path) return res.status(400).json({ error: "path is required" });

    // SEC-29: Ownership check for citizens
    const userRole = req.user?.role || "citizen";
    const userId = req.user?.id;

    if (userRole === "citizen") {
      // Extract complaint ID from the storage path (format: complaint-evidence/{complaintId}/...)
      const pathParts = path.split("/");
      const complaintId = pathParts[0]; // First segment is usually the complaint ID

      if (complaintId) {
        // Verify citizen owns this complaint
        const { data: complaint, error: ownerError } = await supabase
          .from("complaints")
          .select("user_id")
          .eq("id", complaintId)
          .single();

        if (ownerError || !complaint) {
          return res.status(404).json({ error: "complaint not found" });
        }

        if (complaint.user_id !== userId) {
          return res.status(403).json({ error: "Access denied: you do not own this complaint" });
        }
      }
    }

    // 5 minutes expiry
    const expiresIn = 60 * 5;
    const { data, error } = await supabase
      .storage
      .from("complaint-evidence")
      .createSignedUrl(path, expiresIn);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ url: data.signedUrl, expiresAt: Date.now() + expiresIn * 1000 });
  } catch (e) {
    console.error("[STORAGE] signed-url error:", e);
    res.status(500).json({ error: "Failed to create signed URL" });
  }
});

module.exports = router;
