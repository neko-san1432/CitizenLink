const { _createClient } = require("@supabase/supabase-js");
const Database = require("../config/database");
const Complaint = require("../models/Complaint");
const crypto = require("crypto");

class ComplaintRepository {
  constructor() {
    this.supabase = Database.getClient();
  }
  async create(complaintData, token = null) {
    const client = this.supabase;

    // Generate ID client-side to avoid needing .select() after .insert().
    // Chaining .select() triggers RLS SELECT policies on the complaints table,
    // which recurse through user_profiles → check_is_admin_safe → user_profiles,
    // causing "infinite recursion detected in policy for relation 'complaints'".
    const id = complaintData.id || crypto.randomUUID();
    const dataWithId = { ...complaintData, id };

    const { error } = await client
      .from("complaints")
      .insert(dataWithId);
    if (error) throw error;
    return new Complaint(dataWithId);
  }
  async findById(id, token = null) {
    try {
      // Use service client to bypass RLS recursion on complaints table
      const client = Database.getServiceClient();

      // Original logic commented out to prevent RLS trigger
      /*
      if (token) {
        const { createClient } = require("@supabase/supabase-js");
        const supabaseUrl = process.env.SUPABASE_URL;
        const anonKey =
          process.env.SUPABASE_ANON_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY;
        client = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: token } },
        });
      }
      */

      const { data, error } = await client
        .from("complaints")
        .select("*")
        .eq("id", id)
        .maybeSingle(); // Use maybeSingle() instead of single() to return null when no rows found

      if (error) {
        // PGRST116 = no rows returned (expected when complaint doesn't exist)
        if (error.code === "PGRST116") {
          console.log(`[COMPLAINT_REPO] complaint ${id} not found (PGRST116)`);
          return null;
        }
        // Log other errors for debugging
        console.error(
          `[COMPLAINT_REPO] Error fetching complaint ${id}:`,
          error
        );
        throw error;
      }

      if (!data) {
        console.log(`[COMPLAINT_REPO] complaint ${id} not found (no data)`);
        return null;
      }

      // Resolve UUID category/subcategory to name
      const [resolved] = await this._resolveCategoryNames([data]);
      const complaint = new Complaint(resolved);
      // Get assignment data for progress tracking (without accessing auth.users)
      const { data: assignments } = await client
        .from("complaint_assignments")
        .select(
          "id, complaint_id, assigned_to, assigned_by, status, priority, assignment_type, assignment_group_id, officer_order, created_at, updated_at"
        )
        .eq("complaint_id", id)
        .order("officer_order", { ascending: true });
      // Add assignments to complaint object
      complaint.assignments = assignments || [];
      return complaint;
    } catch (error) {
      console.error(
        `[COMPLAINT_REPO] Unexpected error in findById for ${id}:`,
        error
      );
      throw error;
    }
  }
  async findByIds(ids, fields = "*") {
    if (!ids || ids.length === 0) return [];
    const { data, error } = await this.supabase
      .from("complaints")
      .select(fields)
      .in("id", ids);
    if (error) throw error;

    // Resolve UUID-based category/subcategory values to names
    return await this._resolveCategoryNames(data || []);
  }
  async findByUserId(userId, options = {}) {
    try {
      const { page = 1, limit = 10, status, type, token } = options;
      const offset = (page - 1) * limit;

      // Use service client to bypass RLS recursion on complaints table
      const client = Database.getServiceClient();


      /*
      if (token) {
        ...
      }
      */

      let query = client
        .from("complaints")
        .select("*", { count: "exact" })
        .eq("submitted_by", userId)
        .order("submitted_at", { ascending: false });
      if (status) {
        query = query.eq("workflow_status", status);
      }
      if (type) {
        query = query.eq("category", type);
      }
      // First get the count without range, applying same filters
      let countQuery = client
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("submitted_by", userId);
      if (status) {
        countQuery = countQuery.eq("workflow_status", status);
      }
      if (type) {
        countQuery = countQuery.eq("category", type);
      }
      const { count: totalCount, error: countError } = await countQuery;
      if (countError) {
        console.error("[COMPLAINT_REPO] Count query error:", countError);
      }
      // DIAGNOSTIC: Get ALL complaints for this user without pagination (non-blocking)
      // This runs in parallel and doesn't block the main query
      client
        .from("complaints")
        .select(
          "id, description, workflow_status, submitted_at, is_duplicate, cancelled_at"
        )
        .eq("submitted_by", userId)
        .order("submitted_at", { ascending: false })
        .then(() => {
          // Diagnostic query removed for cleaner logs
        })
        .catch(() => {
          // Silent catch for diagnostic query
        });
      // Then get the paginated data
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) {
        console.error("[COMPLAINT_REPO] Database query error:", error);
        throw error;
      }

      // Resolve UUID-based category/subcategory values to names
      const resolvedData = await this._resolveCategoryNames(data || []);

      return {
        complaints: resolvedData,
        total: totalCount || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((totalCount || 0) / limit),
      };
    } catch (error) {
      console.error("[COMPLAINT_REPO] Error in findByUserId:", error);
      console.error("[COMPLAINT_REPO] Error stack:", error.stack);
      throw error;
    }
  }

  /**
   * Resolve UUID-based category/subcategory values to human-readable names.
   * Uses a simple in-memory cache (5 min TTL) to avoid repeated DB lookups.
   */
  async _resolveCategoryNames(complaints) {
    if (!complaints || complaints.length === 0) return complaints;

    // UUID v4 regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Check if any complaints need resolution
    const needsResolution = complaints.some(
      c => uuidRegex.test(c.category || "") || uuidRegex.test(c.subcategory || "")
    );
    if (!needsResolution) return complaints;

    // Use cached lookup maps (refresh every 5 minutes)
    const now = Date.now();
    if (!this._categoryCache || now - this._categoryCacheTime > 5 * 60 * 1000) {
      try {
        const client = Database.getServiceClient();
        const [catRes, subRes] = await Promise.all([
          client.from("categories").select("id, name"),
          client.from("subcategories").select("id, name"),
        ]);
        this._categoryMap = new Map((catRes.data || []).map(c => [c.id, c.name]));
        this._subcategoryMap = new Map((subRes.data || []).map(s => [s.id, s.name]));
        this._categoryCache = true;
        this._categoryCacheTime = now;
      } catch (err) {
        console.warn("[REPO] Failed to load category lookup tables:", err.message);
        return complaints; // Return unresolved rather than crashing
      }
    }

    // Resolve UUIDs to names
    return complaints.map(complaint => {
      const resolved = { ...complaint };
      if (uuidRegex.test(resolved.category || "")) {
        resolved.category_name = this._categoryMap.get(resolved.category) || resolved.category;
        resolved.category = resolved.category_name;
      }
      if (uuidRegex.test(resolved.subcategory || "")) {
        resolved.subcategory_name = this._subcategoryMap.get(resolved.subcategory) || resolved.subcategory;
        resolved.subcategory = resolved.subcategory_name;
      }
      return resolved;
    });
  }

  async findAll(options = {}) {
    // Extract filter parameters
    const { page = 1, limit = 20, status, type, department, search, startDate, endDate } = options;
    const offset = (page - 1) * limit;

    console.log("[DEBUG-REPO] findAll called with options:", JSON.stringify(options));

    // Use service client to bypass RLS recursion on complaints table
    const client = Database.getServiceClient();

    let query = client
      .from("complaints")
      .select("*", { count: "exact" })
      .order("submitted_at", { ascending: false });

    // Date Range Filtering
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query = query.gte("submitted_at", start.toISOString());
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("submitted_at", end.toISOString());
    }

    if (status) {
      if (status === "pending review") {
        const activeStatuses = ["submitted", "assigned", "verified", "under_review", "action_taken", "in_progress", "pending_approval"];
        query = query.in("workflow_status", activeStatuses);
      } else {
        query = query.eq("workflow_status", status);
      }
    }
    if (type) {
      query = query.eq("category", type);
    }
    if (department) {
      query = query.contains("departments", [department]);
    }
    if (search) {
      query = query.or(
        `description.ilike.%${search}%,location_text.ilike.%${search}%`
      );
    }
    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1
    );
    if (error) throw error;

    // Resolve UUID-based category/subcategory values to names
    const resolved = await this._resolveCategoryNames(data);

    return {
      complaints: resolved.map((complaint) => new Complaint(complaint)),
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    };
  }
  async update(id, updateData) {
    const { data, error } = await this.supabase
      .from("complaints")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return new Complaint(data);
  }
  async updateStatus(id, status, notes = null) {
    const updateData = { status, updated_at: new Date().toISOString() };
    if (notes) {
      updateData.coordinator_notes = notes;
    }
    const { data, error } = await this.supabase
      .from("complaints")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return new Complaint(data);
  }
  async updateEvidence(id, evidence, userId = null) {
    // Store evidence files in the complaint_evidence table
    if (!evidence || evidence.length === 0) {
      return { success: true };
    }
    try {
      const evidenceRecords = evidence.map((file) => ({
        complaint_id: id,
        file_name: file.fileName,
        file_path: file.filePath,
        file_size: file.fileSize,
        file_type: file.fileType,
        mime_type: file.fileType,
        uploaded_by: userId,
        is_public: false,
        // Removed description, tags, metadata as they don't exist in the table schema
      }));

      const { data, error } = await this.supabase
        .from("complaint_evidence")
        .insert(evidenceRecords)
        .select();
      if (error) {
        console.error("[COMPLAINT_REPO] Evidence storage error:", error);
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      console.error("[COMPLAINT_REPO] Evidence update failed:", error);
      return { success: false, error: error.message };
    }
  }
  async assignCoordinator(id, coordinatorId) {
    const { data, error } = await this.supabase
      .from("complaints")
      .update({
        assigned_coordinator_id: coordinatorId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return new Complaint(data);
  }
  async autoAssigndepartments(id) {
    const { data, error } = await this.supabase.rpc("auto_assign_departments", {
      p_complaint_id: id,
    });
    if (error) throw error;
    return data;
  }
  async findActiveCoordinator(department) {
    // Use admin auth API to find coordinators instead of complaint_coordinators table
    try {
      const { data: authUsers, error: authError } =
        await this.supabase.auth.admin.listUsers();
      if (authError) {
        console.error("[COMPLAINT_REPO] Error fetching auth users:", authError);
        return null;
      }
      if (!authUsers?.users) {
        console.warn("[COMPLAINT_REPO] No users found in auth system");
        return null;
      }
      // Find LGU staff users (covers legacy complaint-coordinator, lgu-admin, etc.)
      const coordinators = authUsers.users.filter((user) => {
        const metadata = user.user_metadata || {};
        const rawMetadata = user.raw_user_meta_data || {};
        const baseRole = metadata.base_role || rawMetadata.base_role;
        const role = metadata.role || rawMetadata.role || "";
        const isLguStaff = baseRole === "lgu" || baseRole === "complaint-coordinator" ||
          role === "lgu" || role === "complaint-coordinator" || role.startsWith("lgu-");
        // Optional: filter by department if specified
        if (department && department !== "GENERAL") {
          const userDept =
            metadata.department ||
            rawMetadata.department ||
            metadata.dpt ||
            rawMetadata.dpt;
          return isLguStaff && userDept === department;
        }
        return isLguStaff;
      });
      if (coordinators.length === 0) {
        console.warn("[COMPLAINT_REPO] No LGU staff found");
        return null;
      }
      // Return the first available coordinator
      const coordinator = coordinators[0];
      // console.log removed for security
      return {
        user_id: coordinator.id,
        email: coordinator.email,
        name:
          coordinator.user_metadata?.name ||
          coordinator.raw_user_meta_data?.name ||
          coordinator.email,
      };
    } catch (error) {
      console.error("[COMPLAINT_REPO] Error finding coordinator:", error);
      return null;
    }
  }
  async logAction(complaintId, actionType, details = {}) {
    const { error } = await this.supabase.rpc("log_complaint_action", {
      p_complaint_id: complaintId,
      p_action_type: actionType,
      p_reason: details.reason || null,
      p_to_dept: details.to_dept || null,
      p_details: details.details ? JSON.stringify(details.details) : null,
    });
    if (error) throw error;
    return true;
  }
  async createAssignments(complaintId, officerIds, assignedBy) {
    try {
      const assignments = [];
      for (let i = 0; i < officerIds.length; i++) {
        const officerId = officerIds[i];
        const assignment = {
          complaint_id: complaintId,
          assigned_to: officerId, // Fixed: was officer_id, should be assigned_to
          assigned_by: assignedBy,
          status: "assigned",
          priority: "medium",
          assignment_type: officerIds.length > 1 ? "multi" : "single",
          assignment_group_id: crypto.randomUUID(),
          officer_order: i + 1,
        };
        const { data, error } = await this.supabase
          .from("complaint_assignments")
          .insert(assignment)
          .select();
        if (error) throw error;
        assignments.push(data[0]);
      }
      return assignments;
    } catch (error) {
      console.error(
        "[COMPLAINT-REPO] Error creating assignments:",
        error.message
      );
      throw error;
    }
  }
  async updateStatusAndComment(id, mappingKey, statusData, rawStatus = null) {
    if (!mappingKey || !statusData) {
      throw new Error("Mapping key and status data are required");
    }

    const workflowStatus = rawStatus || mappingKey;
    try {
      // 1. Fetch current comment JSON
      const { data: current, error: fetchError } = await this.supabase
        .from("complaints")
        .select("comment")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const newComment = current && current.comment ? current.comment : {};

      // 2. [TIMELINE] Append/Overwrite new phase data
      // Structure: { [mappingKey]: { date: ..., comment: ... } }
      newComment[mappingKey] = statusData;

      // 3. Update record
      const { data, error } = await this.supabase
        .from("complaints")
        .update({
          workflow_status: workflowStatus,
          comment: newComment,
          last_activity_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? new Complaint(data) : null;
    } catch (error) {
      console.error("[COMPLAINT-REPO] Update status and comment error:", error.message);
      throw error;
    }
  }

  /**
   * Fetch a minimal set of fields needed for the heatmap layer.
   * Much faster than findAll() — no full-row scan, no joins.
   */
  async getLocations(filters = {}) {
    return await this.findLocationsSlim(filters);
  }

  async getStats(filters = {}) {
    try {
      const client = Database.getServiceClient();
      let query = client.from("complaints").select("workflow_status, priority, category");

      const { department, startDate, endDate } = filters;

      if (department) {
        if (Array.isArray(department)) {
          query = query.contains("departments", department);
        } else {
          query = query.contains("departments", [department]);
        }
      }

      if (startDate) {
        query = query.gte("submitted_at", startDate);
      }
      if (endDate) {
        query = query.lte("submitted_at", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        byStatus: {},
        byPriority: {},
        byCategory: {}
      };

      data.forEach(c => {
        const status = c.workflow_status || "unknown";
        const priority = c.priority || "medium";
        const category = c.category || "General";

        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error("[COMPLAINT-REPO] getStats error:", error.message);
      throw error;
    }
  }

  async findLocationsSlim(filters = {}) {
    try {
      const client = Database.getServiceClient();
      const {
        status,
        confirmationStatus,
        category,
        subcategory,
        department,
        startDate,
        endDate,
        includeResolved = true,
      } = filters;

      let query = client
        .from("complaints")
        .select("id, latitude, longitude, priority, workflow_status, confirmation_status, category, subcategory, departments, submitted_at")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      // Exclude resolved/cancelled unless includeResolved is true
      if (!includeResolved) {
        query = query.not("workflow_status", "in", '("completed","cancelled")');
      }

      if (status && status.length > 0) {
        query = query.in("workflow_status", status);
      }

      if (confirmationStatus && confirmationStatus.length > 0) {
        query = query.in("confirmation_status", confirmationStatus);
      }

      if (category && category.length > 0) {
        query = query.in("category", category);
      }

      if (subcategory) {
        query = query.eq("subcategory", subcategory);
      }

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query = query.gte("submitted_at", start.toISOString());
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte("submitted_at", end.toISOString());
      }

      // v4.5.3: Explicitly increase limit to 10000 for heatmap clustering
      const { data, error } = await query.limit(10000);
      if (error) throw error;

      // Filter by department in-memory (department_r is an array field)
      let results = data || [];
      if (department && department.length > 0) {
        const deptUpper = department.map(d => String(d).toUpperCase().trim());
        results = results.filter(c => {
          const depts = Array.isArray(c.departments) ? c.departments : [];
          return depts.some(d => deptUpper.includes(String(d).toUpperCase().trim()));
        });
      }

      // Resolve UUID-based category/subcategory values to names
      const resolvedResults = await this._resolveCategoryNames(results);

      // Remap to lat/lng fields for consistency with existing frontend contract
      return resolvedResults.map(c => ({
        id: c.id,
        lat: parseFloat(c.latitude),
        lng: parseFloat(c.longitude),
        priority: c.priority || "medium",
        status: c.workflow_status || "new",
        workflow_status: c.workflow_status || "new",
        confirmation_status: c.confirmation_status || "pending",
        category: c.category || null,
        subcategory: c.subcategory || null,
        departments: c.departments || [],
        submitted_at: c.submitted_at,
      }));
    } catch (error) {
      console.error("[COMPLAINT-REPO] findLocationsSlim error:", error.message);
      throw error;
    }
  }

  async getLocations(filters = {}) {
    return await this.findLocationsSlim(filters);
  }

  async getUserStatistics(userId) {
    try {
      const client = Database.getServiceClient();

      const { data: complaints, error } = await client
        .from("complaints")
        .select("id, workflow_status, confirmation_status, submitted_at, priority, category, description")
        .eq("submitted_by", userId);

      if (error) throw error;

      const catRes = await client.from("categories").select("id, name");
      const categoryMap = new Map((catRes.data || []).map(c => [c.id, c.name]));
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const getCategoryName = (catId) => {
        if (uuidRegex.test(catId || "")) {
          return categoryMap.get(catId) || catId;
        }
        return catId || "General";
      };

      const stats = {
        total: complaints.length,
        byStatus: {},
        byConfirmationStatus: {},
        byPriority: {},
        categoryCounts: {},
        recentActivity: []
      };

      complaints.forEach(c => {
        stats.byStatus[c.workflow_status] = (stats.byStatus[c.workflow_status] || 0) + 1;
        stats.byConfirmationStatus[c.confirmation_status] = (stats.byConfirmationStatus[c.confirmation_status] || 0) + 1;
        stats.byPriority[c.priority] = (stats.byPriority[c.priority] || 0) + 1;

        const cat = getCategoryName(c.category);
        stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + 1;
      });

      const sortedByDate = [...complaints].sort((a, b) =>
        new Date(b.submitted_at) - new Date(a.submitted_at)
      );

      const complaintIds = complaints.map(c => c.id);
      let statusChanges = [];
      if (complaintIds.length > 0) {
        const historyRes = await client
          .from("complaint_history")
          .select("id, complaint_id, action, created_at")
          .in("complaint_id", complaintIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (historyRes.data && historyRes.data.length > 0) {
          const complaintMap = new Map(complaints.map(c => [c.id, c]));
          statusChanges = historyRes.data.map(h => {
            const comp = complaintMap.get(h.complaint_id);
            return {
              id: h.complaint_id,
              status: h.action,
              submitted_at: h.created_at,
              category: comp ? getCategoryName(comp.category) : "General",
              description: comp?.description || ""
            };
          });
        }
      }

      stats.recentActivity = statusChanges.length > 0 ? statusChanges : sortedByDate.slice(0, 10).map(c => ({
        id: c.id,
        status: c.workflow_status,
        submitted_at: c.submitted_at,
        category: getCategoryName(c.category),
        description: c.description || ""
      }));

      return stats;
    } catch (error) {
      console.error("[COMPLAINT-REPO] getUserStatistics error:", error.message);
      throw error;
    }
  }
}

module.exports = ComplaintRepository;
