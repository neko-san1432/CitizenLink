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
      // Extract department from user metadata
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        return res.status(400).json({
          success: false,
          error: "department not specified in user metadata.",
        });
      }

      // Get department details
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("id, name, code")
        .eq("code", departmentCode)
        .single();

      if (deptError || !department) {
        return res
          .status(404)
          .json({ success: false, error: "department not found" });
      }

      // 1. Parallel Count Queries (Case Insensitive)
      // Note: We use raw string matching for performance rather than regex
      const [totalActive, unassigned, urgent, high, medium, low] =
        await Promise.all([
          // Total Active (Not completed)
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("departments", [departmentCode])
            .not("workflow_status", "ilike", "completed")
            .then((res) => res.count || 0),

          // Unassigned (New/Pending/Unassigned)
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("departments", [departmentCode])
            .in("workflow_status", [
              "new", "pending", "unassigned",
              "New", "Pending", "Unassigned",
              "NEW", "PENDING", "UNASSIGNED",
            ])
            .then((res) => res.count || 0),

          // Priority Counts (Active Only)
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("departments", [departmentCode])
            .ilike("priority", "urgent")
            .not("workflow_status", "ilike", "completed")
            .then((res) => res.count || 0),

          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("departments", [departmentCode])
            .ilike("priority", "high")
            .not("workflow_status", "ilike", "completed")
            .then((res) => res.count || 0),

          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("departments", [departmentCode])
            .ilike("priority", "medium")
            .not("workflow_status", "ilike", "completed")
            .then((res) => res.count || 0),

          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("departments", [departmentCode])
            .ilike("priority", "low")
            .not("workflow_status", "ilike", "completed")
            .then((res) => res.count || 0),
        ]);

      // 2. Recent Unassigned (Limit 5)
      const { data: recentUnassigned } = await supabase
        .from("complaints")
        .select("id, description, submitted_at, location_text, priority")
        .contains("departments", [departmentCode])
        .in("workflow_status", [
          "new", "pending", "unassigned",
          "New", "Pending", "Unassigned",
          "NEW", "PENDING", "UNASSIGNED",
        ])
        .order("submitted_at", { ascending: false })
        .limit(5);

      // 3. Trend Data (Last 7 Days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trendData } = await supabase
        .from("complaints")
        .select("submitted_at")
        .contains("departments", [departmentCode])
        .gte("submitted_at", sevenDaysAgo.toISOString());

      // Aggregate trend in JS
      const dailyCounts = {};
      if (trendData) {
        trendData.forEach((c) => {
          const date = new Date(c.submitted_at).toISOString().split("T")[0];
          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });
      }

      // 4. Category Distribution
      const { data: categoryData } = await supabase
        .from("complaints")
        .select("category")
        .contains("departments", [departmentCode])
        .not("workflow_status", "in", ["cancelled", "rejected"]);

      const categoryDistribution = {};
      if (categoryData) {
        categoryData.forEach((c) => {
          const cat = c.category || "Uncategorized";
          categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
        });
      }

      res.json({
        success: true,
        data: {
          total_complaints: totalActive,
          pending_complaints: unassigned,
          in_progress_complaints: totalActive - unassigned,
          resolved_complaints: 0,
          stats: {
            total_active: totalActive,
            unassigned,
            priority: {
              urgent,
              high,
              medium,
              low,
            },
          },
          charts: {
            trend: dailyCounts,
            category_distribution: categoryDistribution,
          },
          recent_activity: recentUnassigned || [],
          lists: {
            recent_unassigned: recentUnassigned || [],
          }
        }
      });
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
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        return res.status(400).json({ success: false, error: "department not specified" });
      }

      const {
        status,
        priority,
        page = 1,
        limit = 10,
        date_start,
        date_end,
        assignment_filter // all, unassigned, assigned
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
        data = data.filter(d => !!d.assigned_to);
      }

      // Calculate stats for the cards
      const [unassignedCount, urgentCount, highCount] = await Promise.all([
        supabase.from("complaints").select("id", { count: "exact", head: true }).contains("departments", [departmentCode]).in("workflow_status", ["new", "pending", "unassigned"]).then(r => r.count || 0),
        supabase.from("complaints").select("id", { count: "exact", head: true }).contains("departments", [departmentCode]).ilike("priority", "urgent").not("workflow_status", "ilike", "completed").then(r => r.count || 0),
        supabase.from("complaints").select("id", { count: "exact", head: true }).contains("departments", [departmentCode]).ilike("priority", "high").not("workflow_status", "ilike", "completed").then(r => r.count || 0)
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
      console.error("[LGU_DASHBOARD] Get assignments error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch assignments" });
    }
  }
}

module.exports = new LguDashboardController();
