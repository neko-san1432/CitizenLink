const express = require("express");
const Database = require("../config/database");
const { authenticateUser, requireRole } = require("../middleware/auth");

const router = express.Router();
// ============================================================================
// NEWS ROUTES
// ============================================================================
// GET /api/content/news - Get all published news
router.get("/news", async (req, res) => {
  try {
    const { limit = 10, offset = 0, category, from, to, office, status } = req.query;
    let query = Database.getClient()
      .from("news")
      .select("*")
      .eq("status", status || "published")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (category) query = query.eq("category", category);
    // map office -> category for filtering
    if (office) query = query.eq("category", office);
    if (from) query = query.gte("published_at", from);
    if (to) query = query.lte("published_at", to);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch news"
    });
  }
});
// GET /api/content/news/:id - Get single news article
router.get("/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await Database.getClient()
      .from("news")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .single();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "News article not found"
      });
    }
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error fetching news article:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch news article"
    });
  }
});
// POST /api/content/news - Create news (admin only)
router.post("/news", authenticateUser, requireRole(["lgu-admin"]), async (req, res) => {
  try {
    const { title, content, excerpt, image_url, category, tags, status } = req.body;
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: "Title and content are required"
      });
    }
    // Convert empty strings to null for optional fields
    const newsData = {
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt?.trim() || null,
      image_url: image_url?.trim() || null,
      category: category?.trim() || null,
      tags: Array.isArray(tags) && tags.length > 0 ? tags : (tags ? [tags] : "{}"),
      status: status || "published",
      published_at: status === "published" ? new Date().toISOString() : null,
      author_id: req.user?.id
    };
    // console.log removed for security
    const dbClient = Database.getClient();
    const { data, error } = await dbClient
      .from("news")
      .insert([newsData])
      .select();
    if (error) {
      console.error("[CONTENT] Database error inserting news:", error);
      console.error("[CONTENT] Error code:", error.code);
      console.error("[CONTENT] Error message:", error.message);
      console.error("[CONTENT] Error details:", error.details);
      console.error("[CONTENT] Error hint:", error.hint);
      return res.status(500).json({
        success: false,
        error: "Failed to create news",
        details: error.message || error.code || "Database error",
        code: error.code,
        hint: error.hint
      });
    }
    if (!data || data.length === 0) {
      console.error("[CONTENT] Insert succeeded but no data returned");
      return res.status(500).json({
        success: false,
        error: "Failed to create news",
        details: "Insert operation returned no data"
      });
    }
    const insertedNews = data[0];
    // console.log removed for security
    return res.json({
      success: true,
      data: insertedNews
    });
  } catch (error) {
    console.error("[CONTENT] Error creating news:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create news",
      details: error.message || error.code || "Unknown error"
    });
  }
});
// ============================================================================
// EVENTS ROUTES
// ============================================================================
// GET /api/content/events - Get upcoming events
router.get("/events", async (req, res) => {
  try {
    const { limit = 10, offset = 0, status = "upcoming", from, to, office } = req.query;
    const { data, error } = await Database.getClient()
      .from("events")
      .select("*")
      .in("status", status.split(","))
      .gte("event_date", from || new Date(0).toISOString())
      .lte("event_date", to || "9999-12-31T23:59:59.999Z")
      .order("event_date", { ascending: true })
      .range(offset, offset + limit - 1);
    if (office) {
      // Filter by organizer as office proxy
      const filtered = (data || []).filter(e => (e.organizer || "").toLowerCase() === String(office).toLowerCase());
      return res.json({ success: true, data: filtered, count: filtered.length });
    }
    if (error) throw error;
    return res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch events"
    });
  }
});
// GET /api/content/events/:id - Get single event
router.get("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await Database.getClient()
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Event not found"
      });
    }
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event"
    });
  }
});
// POST /api/content/events - Create event (admin only)
router.post("/events", authenticateUser, requireRole(["lgu-admin"]), async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      event_date,
      end_date,
      image_url,
      organizer,
      category,
      tags,
      max_participants,
      registration_required
    } = req.body;
    if (!title || !description || !event_date) {
      return res.status(400).json({
        success: false,
        error: "Title, description, and event date are required"
      });
    }
    // Convert empty strings to null for optional fields
    const eventData = {
      title: title.trim(),
      description: description.trim(),
      location: location?.trim() || null,
      event_date,
      end_date: end_date || null,
      image_url: image_url?.trim() || null,
      organizer: organizer?.trim() || null,
      category: category?.trim() || null,
      tags: tags || null,
      max_participants: max_participants || null,
      registration_required: registration_required || false,
      status: "upcoming",
      created_by: req.user?.id
    };
    // console.log removed for security
    const dbClient = Database.getClient();
    const { data, error } = await dbClient
      .from("events")
      .insert([eventData])
      .select();
    if (error) {
      console.error("[CONTENT] Database error inserting event:", error);
      console.error("[CONTENT] Error code:", error.code);
      console.error("[CONTENT] Error message:", error.message);
      throw error;
    }
    if (!data || data.length === 0) {
      console.error("[CONTENT] Insert succeeded but no data returned");
      return res.status(500).json({
        success: false,
        error: "Failed to create event",
        details: "Insert operation returned no data"
      });
    }
    const insertedEvent = data[0];
    // console.log removed for security
    return res.json({
      success: true,
      data: insertedEvent
    });
  } catch (error) {
    console.error("[CONTENT] Error creating event:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create event",
      details: error.message || error.code || "Unknown error"
    });
  }
});
// ============================================================================
// NOTICES ROUTES
// ============================================================================
// GET /api/content/notices - Get active notices
router.get("/notices", async (req, res) => {
  try {
    const { limit = 10, offset = 0, priority, from, to, office, status = "active" } = req.query;
    let query = Database.getClient()
      .from("notices")
      .select("*")
      .eq("status", status)
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
      .order("priority", { ascending: false })
      .order("valid_from", { ascending: false })
      .range(offset, offset + limit - 1);
    if (priority) query = query.eq("priority", priority);
    if (office) query = query.eq("type", office);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error("Error fetching notices:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch notices"
    });
  }
});
// GET /api/content/notices/:id - Get single notice
router.get("/notices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await Database.getClient()
      .from("notices")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Notice not found"
      });
    }
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error fetching notice:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch notice"
    });
  }
});
// POST /api/content/notices - Create notice (admin only)
router.post("/notices", authenticateUser, requireRole(["lgu-admin"]), async (req, res) => {
  try {
    const {
      title,
      content,
      priority,
      type,
      target_audience,
      image_url,
      valid_from,
      valid_until
    } = req.body;
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: "Title and content are required"
      });
    }
    // Convert empty strings to null for optional fields
    const noticeData = {
      title: title.trim(),
      content: content.trim(),
      priority: priority || "normal",
      type: type?.trim() || null,
      target_audience: target_audience || null,
      image_url: image_url?.trim() || null,
      valid_from: valid_from || new Date().toISOString(),
      valid_until: valid_until || null,
      status: "active",
      created_by: req.user?.id
    };
    // console.log removed for security
    const dbClient = Database.getClient();
    const { data, error } = await dbClient
      .from("notices")
      .insert([noticeData])
      .select();
    if (error) {
      console.error("[CONTENT] Database error inserting notice:", error);
      console.error("[CONTENT] Error code:", error.code);
      console.error("[CONTENT] Error message:", error.message);
      console.error("[CONTENT] Error details:", error.details);
      throw error;
    }
    if (!data || data.length === 0) {
      console.error("[CONTENT] Insert succeeded but no data returned");
      // Try to query the notices table to verify insert
      const { data: verifyData, error: verifyError } = await dbClient
        .from("notices")
        .select("*")
        .eq("title", noticeData.title)
        .eq("created_by", noticeData.created_by)
        .order("created_at", { ascending: false })
        .limit(1);
      // console.log removed for security
      return res.status(500).json({
        success: false,
        error: "Failed to create notice",
        details: `Insert operation returned no data. Verification query: ${  verifyError ? verifyError.message : "No matching record found"}`
      });
    }
    const insertedNotice = data[0];
    // console.log removed for security
    return res.json({
      success: true,
      data: insertedNotice
    });
  } catch (error) {
    console.error("[CONTENT] Error creating notice:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create notice",
      details: error.message || error.code || "Unknown error"
    });
  }
});

module.exports = router;
