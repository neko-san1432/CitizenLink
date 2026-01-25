/**
 * LGU Dashboard Controller
 * Handles department-specific dashboard statistics and analytics
 */
const Database = require("../config/database");

const db = new Database();
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
                    error: "Department not specified in user metadata.",
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
                    .json({ success: false, error: "Department not found" });
            }

            // 1. Parallel Count Queries (Case Insensitive)
            // Note: We use raw string matching for performance rather than regex
            const [totalActive, unassigned, urgent, high, medium, low] =
                await Promise.all([
                    // Total Active (Not completed)
                    supabase
                        .from("complaints")
                        .select("id", { count: "exact", head: true })
                        .contains("department_r", [departmentCode])
                        .not("workflow_status", "ilike", "completed")
                        .then((res) => res.count || 0),

                    // Unassigned (New/Pending/Unassigned)
                    supabase
                        .from("complaints")
                        .select("id", { count: "exact", head: true })
                        .contains("department_r", [departmentCode])
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
                        .contains("department_r", [departmentCode])
                        .ilike("priority", "urgent")
                        .not("workflow_status", "ilike", "completed")
                        .then((res) => res.count || 0),

                    supabase
                        .from("complaints")
                        .select("id", { count: "exact", head: true })
                        .contains("department_r", [departmentCode])
                        .ilike("priority", "high")
                        .not("workflow_status", "ilike", "completed")
                        .then((res) => res.count || 0),

                    supabase
                        .from("complaints")
                        .select("id", { count: "exact", head: true })
                        .contains("department_r", [departmentCode])
                        .ilike("priority", "medium")
                        .not("workflow_status", "ilike", "completed")
                        .then((res) => res.count || 0),

                    supabase
                        .from("complaints")
                        .select("id", { count: "exact", head: true })
                        .contains("department_r", [departmentCode])
                        .ilike("priority", "low")
                        .not("workflow_status", "ilike", "completed")
                        .then((res) => res.count || 0),
                ]);

            // 2. Recent Unassigned (Limit 5)
            const { data: recentUnassigned } = await supabase
                .from("complaints")
                .select("id, title, submitted_at, location_text, priority")
                .contains("department_r", [departmentCode])
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
                .contains("department_r", [departmentCode])
                .gte("submitted_at", sevenDaysAgo.toISOString());

            // Aggregate trend in JS
            const dailyCounts = {};
            if (trendData) {
                trendData.forEach((c) => {
                    const date = new Date(c.submitted_at).toISOString().split("T")[0];
                    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
                });
            }

            res.json({
                success: true,
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
                },
                lists: {
                    recent_unassigned: recentUnassigned || [],
                },
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
}

module.exports = new LguDashboardController();
