/**
 * LGU Team Controller
 * Handles officer management, reminders, and team performance tracking
 */
const Database = require("../config/database");
const CoordinatorService = require("../services/CoordinatorService");

const db = new Database();
const supabase = db.getClient();
const coordinatorService = new CoordinatorService();

class LguTeamController {
    /**
     * Get department officers
     * Returns list of LGU officers in the admin's department
     */
    async getDepartmentOfficers(req, res) {
        try {
            const userRole = req.user.role;

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

            // Get the department ID
            const { data: department, error: deptError } = await supabase
                .from("departments")
                .select("id")
                .eq("code", departmentCode)
                .single();

            if (deptError || !department) {
                return res.status(404).json({
                    success: false,
                    error: "Department not found"
                });
            }

            // Get all users and filter for LGU officers in this department
            let users = [];
            try {
                const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
                if (authError) {
                    console.error("[LGU_TEAM] Error fetching auth users:", authError);
                    return res.status(500).json({ success: false, error: "Failed to fetch users" });
                }
                users = authUsers.users || [];
            } catch (authErr) {
                console.error("[LGU_TEAM] Auth API error:", authErr);
                return res.status(500).json({ success: false, error: "Failed to fetch users via auth API" });
            }

            const officers = users
                .filter((user) => {
                    const metadata = user.user_metadata || {};
                    const rawMetadata = user.raw_user_meta_data || {};
                    const role = metadata.role || rawMetadata.role || "";

                    const isLguOfficer = role === "lgu" || role === "lgu-officer" || role === "lgu-admin";
                    const hasCorrectDepartment =
                        metadata.dpt === departmentCode ||
                        rawMetadata.dpt === departmentCode ||
                        metadata.department === departmentCode ||
                        rawMetadata.department === departmentCode;

                    const isLegacyOfficer = /^lgu-(?!hr)/.test(role);
                    const roleContainsDepartment = role.includes(`-${departmentCode}`);
                    const hasLegacyDepartment = metadata.department === departmentCode || rawMetadata.department === departmentCode;

                    const isMatch = (isLguOfficer && hasCorrectDepartment) || (isLegacyOfficer && (roleContainsDepartment || hasLegacyDepartment));

                    // TEMPORARY: Allow any LGU user for testing
                    const isAnyLguUser = role === "lgu" || role === "lgu-officer" || role === "lgu-admin" || /^lgu-(?!hr)/.test(role);

                    return isMatch || isAnyLguUser;
                })
                .map((user) => ({
                    id: user.id,
                    name: user.user_metadata?.name || user.raw_user_meta_data?.name || user.email,
                    email: user.email,
                    employee_id: user.user_metadata?.employee_id || user.raw_user_meta_data?.employee_id,
                    mobile: user.user_metadata?.mobile || user.raw_user_meta_data?.mobile,
                }));

            return res.json({ success: true, data: officers });

        } catch (error) {
            console.error("[LGU_TEAM] Get officers error:", error);
            return res.status(500).json({ success: false, error: "Failed to get department officers" });
        }
    }

    /**
     * Send reminder to officer
     */
    async sendOfficerReminder(req, res) {
        try {
            const adminId = req.user.id;
            const { officerId, complaintId, reminderType, customMessage } = req.body;

            if (!officerId || !complaintId || !reminderType) {
                return res.status(400).json({ success: false, error: "Officer ID, complaint ID, and reminder type are required" });
            }

            const result = await coordinatorService.sendOfficerReminder(
                adminId,
                officerId,
                complaintId,
                reminderType,
                customMessage
            );
            res.json(result);
        } catch (error) {
            console.error("[LGU_TEAM] Send reminder error:", error);
            res.status(500).json({ success: false, error: "Failed to send reminder" });
        }
    }

    /**
     * Get pending assignments summary
     */
    async getPendingAssignmentsSummary(req, res) {
        try {
            const result = await coordinatorService.getPendingAssignmentsSummary();
            res.json({ success: true, data: result.data });
        } catch (error) {
            console.error("[LGU_TEAM] Get pending summary error:", error);
            res.status(500).json({ success: false, error: "Failed to get pending assignments summary" });
        }
    }

    /**
     * Get officers needing attention
     */
    async getOfficersNeedingAttention(req, res) {
        try {
            const { data: assignments, error } = await supabase
                .from("complaint_assignments")
                .select(`*, complaints!inner(id, descriptive_su, workflow_status, submitted_at, priority), departments(id, code, name)`)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const officerGroups = {};
            const officersNeedingAttention = [];

            for (const assignment of assignments) {
                const officerId = assignment.assigned_to;
                if (!officerId) continue;

                if (!officerGroups[officerId]) {
                    officerGroups[officerId] = {
                        officer_id: officerId,
                        assignments_count: 0,
                        overdue_count: 0,
                        complaints: [],
                    };
                }

                officerGroups[officerId].assignments_count++;
                const daysSinceAssignment = Math.floor((Date.now() - new Date(assignment.created_at).getTime()) / (1000 * 60 * 60 * 24));

                if (daysSinceAssignment > 7) {
                    officerGroups[officerId].overdue_count++;
                }

                officerGroups[officerId].complaints.push({
                    id: assignment.complaints.id,
                    title: assignment.complaints.descriptive_su?.slice(0, 100) || 'No description',
                    priority: assignment.complaints.priority,
                    assigned_days_ago: daysSinceAssignment,
                    is_overdue: daysSinceAssignment > 7,
                });
            }

            for (const officerId in officerGroups) {
                const officer = officerGroups[officerId];
                if (officer.overdue_count > 0 || officer.assignments_count > 3) {
                    try {
                        const { data: authUsers } = await supabase.auth.admin.listUsers();
                        if (authUsers?.users) {
                            const officerData = authUsers.users.find(u => u.id === officerId);
                            officersNeedingAttention.push({
                                ...officer,
                                name: officerData?.user_metadata?.name || officerData?.raw_user_meta_data?.name || officerData?.email || "Unknown Officer",
                                email: officerData?.email
                            });
                        }
                    } catch (e) {
                        console.error("[LGU_TEAM] Error fetching officer details", e);
                        officersNeedingAttention.push({ ...officer, name: "Unknown Officer" });
                    }
                }
            }

            res.json({
                success: true,
                data: {
                    total_officers_needing_attention: officersNeedingAttention.length,
                    officers: officersNeedingAttention,
                },
            });
        } catch (error) {
            console.error("[LGU_TEAM] Get officers needing attention error:", error);
            res.status(500).json({ success: false, error: "Failed to get officers needing attention" });
        }
    }
}

module.exports = new LguTeamController();
