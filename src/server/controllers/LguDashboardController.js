/**
 * LGU Dashboard Controller
 * Handles department-specific dashboard statistics and analytics
 */
const Database = require("../config/database");

const db = Database.getInstance();
const supabase = db.getClient();

class LguDashboardController {
  /**
     * Get dashboard statistics
     * Returns aggregated metrics for the dashboard
     */
  async getDashboardStats(req, res) {
    try {
      const client = Database.getServiceClient();

      // Role-based filtering removed at user request - LGU role is global view
      console.log(`[LGU_DASH] Global Dashboard View for User: ${req.user.id} (${req.user.role})`);

      // 1. Calculate Timeframe
      const timeframe = req.query.timeframe || "weekly";
      const target = req.query.target || "all";
      const now = new Date();
      const dateLimit = new Date();

      if (timeframe === "daily") dateLimit.setDate(now.getDate() - 1);
      else if (timeframe === "weekly") dateLimit.setDate(now.getDate() - 7);
      else if (timeframe === "monthly") dateLimit.setMonth(now.getMonth() - 1);
      else if (timeframe === "yearly") dateLimit.setFullYear(now.getFullYear() - 1);
      else dateLimit.setFullYear(now.getFullYear() - 1); // Default to yearly for better initial visibility


      const responseData = {};
      const tasks = [];

      // Task: Stats & Priority
      if (target === "all" || target === "stats") {
        const activeStatuses = ["submitted", "new", "pending", "unassigned", "verified", "under_review", "assigned", "action_taken", "in_progress", "pending_approval"];
        const getBaseQuery = () => client.from("complaints").select("id", { count: "exact" });
        tasks.push(
          Promise.all([
            getBaseQuery().not("workflow_status", "in", '("completed","cancelled")'),
            getBaseQuery().in("workflow_status", ["submitted", "new", "unassigned"]),
            getBaseQuery().ilike("priority", "urgent").not("workflow_status", "in", '("completed","cancelled")'),
            getBaseQuery().ilike("priority", "high").not("workflow_status", "in", '("completed","cancelled")'),
            getBaseQuery().ilike("priority", "medium").not("workflow_status", "in", '("completed","cancelled")'),
            getBaseQuery().ilike("priority", "low").not("workflow_status", "in", '("completed","cancelled")'),
          ]).then(results => {
            const urgent = results[2].count || 0;
            const high = results[3].count || 0;
            const medium = results[4].count || 0;
            const low = results[5].count || 0;
            const total = results[0].count || 0;

            let avgScore = 0;
            if (total > 0) {
              avgScore = Math.round(((urgent * 100) + (high * 75) + (medium * 50) + (low * 25)) / total);
            }

            responseData.stats = {
              total_active: total,
              unassigned: results[1].count || 0,
              priority: { urgent, high, medium, low },
              avg_priority_score: avgScore
            };
          }).catch(err => {
            console.error("[LGU_DASH] Stats query error:", err?.message || "Unknown error");
            responseData.stats = { total_active: 0, unassigned: 0, priority: { urgent: 0, high: 0, medium: 0, low: 0 }, avg_priority_score: 0 };
          })
        );
      }

      // Task: Activity
      if (target === "all" || target === "activity") {
        tasks.push(
          client.from("complaints")
            .select("id, description, submitted_at, location_text, priority, category_id, workflow_status")
            .not("workflow_status", "in", '("completed","cancelled")')
            .order("submitted_at", { ascending: false })
            .limit(5)
            .then(({ data }) => responseData.recent_activity = data || [])
            .catch(err => {
              console.error("[LGU_DASH] Activity query error:", err?.message || "Unknown error");
              responseData.recent_activity = [];
            })
        );
      }

      // Task: Trend
      if (target === "all" || target === "trend") {
        tasks.push(
          client.from("complaints")
            .select("submitted_at")
            .gte("submitted_at", dateLimit.toISOString())
            .then(({ data }) => {
              const trendCounts = {};
              if (data) {
                data.forEach(c => {
                  const date = new Date(c.submitted_at).toISOString().split("T")[0];
                  trendCounts[date] = (trendCounts[date] || 0) + 1;
                });
              }
              responseData.charts = responseData.charts || {};
              responseData.charts.trend = trendCounts;
            })
            .catch(err => {
              console.error("[LGU_DASH] Trend query error:", err?.message || "Unknown error");
              responseData.charts = responseData.charts || {};
              responseData.charts.trend = {};
            })
        );
      }

      // Task: Distribution (Split for independence)
      if (target === "all" || target === "distribution" || target === "distribution_pie" || target === "distribution_bar") {
        tasks.push(
          (async () => {
            const { data: categoryDataRes } = await client.from("complaints")
              .select("category_id")
              .gte("submitted_at", dateLimit.toISOString())
              .not("workflow_status", "in", '("completed","cancelled")');

            const categoryDistribution = {};
            if (categoryDataRes) {
              const uniqueCatIds = [...new Set(categoryDataRes.filter(c => c.category_id).map(c => c.category_id))];
              const knownCategoryLabels = {};
              if (uniqueCatIds.length > 0) {
                const { data: catLookups } = await client.from("categories").select("id, name").in("id", uniqueCatIds);
                if (catLookups) catLookups.forEach(cat => knownCategoryLabels[cat.id] = cat.name);
              }
              categoryDataRes.forEach(c => {
                const catName = knownCategoryLabels[c.category_id] || "Uncategorized";
                categoryDistribution[catName] = (categoryDistribution[catName] || 0) + 1;
              });
            }

            responseData.charts = responseData.charts || {};
            // Determine which specific data to return based on target
            if (target === "all" || target === "distribution" || target === "distribution_pie") {
              responseData.charts.distribution_pie = categoryDistribution;
            }
            if (target === "all" || target === "distribution" || target === "distribution_bar") {
              responseData.charts.distribution_bar = categoryDistribution;
            }
          })()
        );
      }

      await Promise.all(tasks);
      res.json({ success: true, data: responseData });
    } catch (error) {
      console.error("[LGU_DASHBOARD] Get dashboard stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch dashboard stats",
        details: error.message,
      });
    }
  }

  /**
   * Get department assignments (paginated)
   * Used by the Office Assignments page
   */
  async getDepartmentAssignments(req, res) {
    try {
      const client = Database.getServiceClient();
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;

      const {
        status,
        priority,
        page = 1,
        limit = 10,
        date_start,
        date_end,
        assignment_filter, // all, unassigned, assigned
        barangay
      } = req.query;

      // Import service on demand to avoid circular deps
      const LguOfficerService = require("../services/LguOfficerService");
      const officerService = new LguOfficerService();

      // We'll reuse the logic from getAssignedTasks but with department focus
      // and proper mapping for the assignments.js frontend
      const filters = {
        department: departmentCode,
        status: status === "all" ? null : status,
        priority: priority === "all" ? null : priority,
        startDate: date_start,
        endDate: date_end,
        barangay,
        limit: parseInt(limit),
        page: parseInt(page)
      };

      // Get complaints for this department using the repository through the service
      const repoResult = await officerService.complaintRepo.findAll(filters);
      const complaints = repoResult.complaints || [];

      // If we have an assignment filter, we need to check the complaint_assignments table
      // This is slightly complex because one complaint can have multiple assignments
      // But for the overview, we usually want to know if it HAS any assignment
      const complaintIds = complaints.map(c => c.id);
      let assignments = [];
      if (complaintIds.length > 0) {
        assignments = await officerService.assignmentRepo.findBycomplaintIds(complaintIds);
      }

      // Map back to the expected frontend structure
      let data = complaints.map(c => {
        const cAssignments = assignments.filter(a => a.complaint_id === c.id);
        const hasAssignment = cAssignments.length > 0;
        const mainAssignment = cAssignments[0]; // Take first for display

        return {
          complaint_id: c.id,
          display_id: c.id.slice(-8).toUpperCase(),
          description: c.description,
          status: c.workflow_status,
          priority: c.priority,
          submitted_at: c.submitted_at,
          location_text: c.location_text,
          citizen_name: "Citizen", // Simplified, would need join for real name
          assigned_to: mainAssignment ? mainAssignment.assigned_to : null,
          officer_name: mainAssignment ? (mainAssignment.officer_name || "Assigned Officer") : null,
          has_other_assignments: cAssignments.length > 1
        };
      });

      // Apply assignment filter if specified
      if (assignment_filter === "unassigned") {
        data = data.filter(d => !d.assigned_to);
      } else if (assignment_filter === "assigned") {
        data = data.filter(d => Boolean(d.assigned_to));
      }

      // Calculate stats for the cards (Global city-wide for consistent view)
      const [unassignedCount, urgentCount, highCount] = await Promise.all([
        client.from("complaints").select("id", { count: "exact", head: true }).in("workflow_status", ["new", "pending", "unassigned"]).then(r => r.count || 0),
        client.from("complaints").select("id", { count: "exact", head: true }).ilike("priority", "urgent").not("workflow_status", "in", '("completed","cancelled")').then(r => r.count || 0),
        client.from("complaints").select("id", { count: "exact", head: true }).ilike("priority", "high").not("workflow_status", "in", '("completed","cancelled")').then(r => r.count || 0)
      ]);

      return res.json({
        success: true,
        data,
        pagination: {
          total: repoResult.total,
          page: parseInt(page),
          limit: parseInt(limit)
        },
        stats: {
          unassigned: unassignedCount,
          urgent: urgentCount,
          high: highCount
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch assignments" });
    }
  }

  /**
   * Get officers for the current department
   */
  async getDepartmentOfficers(req, res) {
    try {
      const userService = require("../services/user/UserService");

      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;

      const filters = {
        role: "lgu",
        department: departmentCode,
        status: "active"
      };

      // If no department specified and not super-admin, this might return nothing
      // We'll allow it; listUsers will return what's available
      const result = await userService.getUsers(filters, { limit: 100 });

      return res.json({
        success: true,
        data: result.users || []
      });
    } catch (error) {
      console.error("[LGU_DASHBOARD] Get officers error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch officers" });
    }
  }

  /**
   * Assign a complaint to an officer
   */
  async assignToOfficer(req, res) {
    try {
      const client = Database.getServiceClient();
      const complaintId = req.params.id;
      const { officerId, priority, deadline, notes } = req.body;
      const assignedBy = req.user.id;

      if (!officerId) {
        return res.status(400).json({ success: false, error: "Officer ID is required" });
      }

      // 1. Get complaint to find its primary department
      const { data: complaint, error: compError } = await client
        .from("complaints")
        .select("departments, description")
        .eq("id", complaintId)
        .single();

      if (compError || !complaint) {
        return res.status(404).json({ success: false, error: "Complaint not found" });
      }

      const primaryDept = (complaint.departments && complaint.departments.length > 0)
        ? complaint.departments[0]
        : "GENERAL";

      // 2. Create the assignment
      const { data: assignment, error: assignError } = await client
        .from("complaint_assignments")
        .insert({
          complaint_id: complaintId,
          assigned_to: officerId,
          assigned_by: assignedBy,
          department_id: primaryDept,
          status: "assigned",
          priority: priority || "medium",
          deadline: deadline || null,
          notes: notes || null
        })
        .select()
        .single();

      if (assignError) throw assignError;

      // 3. Update complaint status to 'assigned'
      await client
        .from("complaints")
        .update({
          workflow_status: "assigned",
          last_activity_at: new Date().toISOString()
        })
        .eq("id", complaintId);

      // 4. Log to history
      await client.from("complaint_history").insert({
        complaint_id: complaintId,
        action_type: "assignment",
        user_id: assignedBy,
        details: JSON.stringify({
          officer_id: officerId,
          priority,
          notes
        })
      });

      return res.json({
        success: true,
        data: assignment
      });
    } catch (error) {
      console.error("[LGU_DASHBOARD] Assign error:", error);
      res.status(500).json({ success: false, error: "Failed to assign complaint" });
    }
  }
}

module.exports = new LguDashboardController();
