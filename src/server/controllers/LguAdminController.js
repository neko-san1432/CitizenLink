/**
 * LGU Admin Controller
 * Handles department-specific admin operations
 */
const Database = require("../config/database");

const db = new Database();
const supabase = db.getClient();
const NotificationService = require("../services/NotificationService");
const crypto = require("crypto");

// Create notification service instance
const notificationService = new NotificationService();
// Notification constants
const NOTIFICATION_TYPES = {
  ASSIGNMENT_COMPLETED: "assignment_completed",
};
const NOTIFICATION_PRIORITY = {
  INFO: "info",
  URGENT: "urgent",
};
class LguAdminController {
  /**
   * Get dashboard statistics
   * Returns aggregated metrics for the dashboard
   */
  async getDashboardStats(req, res) {
    try {
      const _userRole = req.user.role;
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
      const [totalActive, unassigned, urgent, high, medium, low] =
        await Promise.all([
          // Total Active
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .neq("workflow_status", "completed")
            .neq("workflow_status", "Completed")
            .neq("workflow_status", "COMPLETED")
            .then((res) => res.count || 0),

          // Unassigned
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("workflow_status", [
              "new",
              "pending",
              "unassigned",
              "New",
              "Pending",
              "Unassigned",
              "NEW",
              "PENDING",
              "UNASSIGNED",
            ])
            .then((res) => res.count || 0),

          // Priority Counts (Active Only)
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("priority", ["urgent", "Urgent", "URGENT"])
            .neq("workflow_status", "completed")
            .then((res) => res.count || 0),

          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("priority", ["high", "High", "HIGH"])
            .neq("workflow_status", "completed")
            .then((res) => res.count || 0),

          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("priority", ["medium", "Medium", "MEDIUM"])
            .neq("workflow_status", "completed")
            .then((res) => res.count || 0),

          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("priority", ["low", "Low", "LOW"])
            .neq("workflow_status", "completed")
            .then((res) => res.count || 0),
        ]);

      // 2. Recent Unassigned (Limit 5)
      const { data: recentUnassigned } = await supabase
        .from("complaints")
        .select("id, descriptive_su, submitted_at, location_text, priority")
        .contains("department_r", [departmentCode])
        .in("workflow_status", [
          "new",
          "pending",
          "unassigned",
          "New",
          "Pending",
          "Unassigned",
          "NEW",
          "PENDING",
          "UNASSIGNED",
        ])
        .order("submitted_at", { ascending: false })
        .limit(5);

      // 3. Trend Data (Last 7 Days)
      // Approximate by fetching submission dates
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
      console.error("[LGU_ADMIN] Get dashboard stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch dashboard stats",
        details: error.message,
      });
    }
  }

  /**
   * Get department queue
   * Returns complaints assigned to the admin's department
   */
  async getDepartmentQueue(req, res) {
    try {
      const _userId = req.user.id;
      const userRole = req.user.role;
      const { status, priority, limit } = req.query;

      // Extract department from user metadata (check multiple possible field names)
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        console.error("[LGU_ADMIN] No department found in user metadata:", {
          userRole,
          department: req.user.department,
          metadata: req.user.metadata,
          rawMetadata: req.user.raw_user_meta_data,
        });
        return res.status(400).json({
          success: false,
          error:
            "Department not specified in user metadata. Please contact administrator to set your department.",
          details: {
            userRole,
            hasMetadata: Boolean(req.user.metadata),
            hasRawMetadata: Boolean(req.user.raw_user_meta_data),
            metadataKeys: Object.keys(req.user.metadata || {}),
            rawMetadataKeys: Object.keys(req.user.raw_user_meta_data || {}),
          },
        });
      }
      // Get the department ID
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("id, name, code")
        .eq("code", departmentCode)
        .single();
      if (deptError || !department) {
        console.error("[LGU_ADMIN] Department not found:", {
          departmentCode,
          error: deptError,
        });
        return res.status(404).json({
          success: false,
          error: "Department not found",
        });
      }
      // Build query for complaints assigned to this department
      let query = supabase
        .from("complaints")
        .select(
          `
          id, descriptive_su, submitted_at, submitted_by, 
          workflow_status, priority, location_text,
          preferred_departments, department_r,
          last_activity_at, updated_at
        `
        )
        .contains("department_r", [departmentCode])
        .order("submitted_at", { ascending: false });
      // Apply filters
      if (status) {
        query = query.eq("workflow_status", status);
      }
      if (priority) {
        query = query.eq("priority", priority);
      }
      if (limit) {
        query = query.limit(parseInt(limit));
      }
      const { data: complaints, error } = await query;
      if (error) {
        console.error("[LGU_ADMIN] Error fetching department queue:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch department queue",
        });
      }
      // Get assignment details for each complaint
      const complaintsWithAssignments = await Promise.all(
        complaints.map(async (complaint) => {
          // Get all assignments for this complaint
          const { data: assignments } = await supabase
            .from("complaint_assignments")
            .select(
              "assigned_to, status, assigned_at, assigned_by, department_id"
            )
            .eq("complaint_id", complaint.id);

          // Check if complaint is assigned to this admin's department
          const isAssignedToDepartment =
            assignments?.some(
              (assignment) => assignment.department_id === department.id
            ) || false;

          return {
            ...complaint,
            assignments: assignments || [],
            is_assigned_to_department: isAssignedToDepartment,
          };
        })
      );
      res.json({
        success: true,
        data: complaintsWithAssignments,
        count: complaintsWithAssignments.length,
        department: {
          id: department.id,
          name: department.name,
          code: department.code,
        },
      });
    } catch (error) {
      console.error("[LGU_ADMIN] Get department queue error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch department queue",
      });
    }
  }
  /**
   * Assign complaint to officer
   */
  async assignToOfficer(req, res) {
    try {
      // console.log removed for security
      const { complaintId } = req.params;
      const { officerIds, officerId, priority, deadline, notes } = req.body;
      const userId = req.user?.id;
      const _userRole = req.user?.role;
      // Validate required parameters
      if (!complaintId) {
        console.error("[LGU_ADMIN] Missing complaintId in params");
        console.error("[LGU_ADMIN] Available params:", req.params);
        return res.status(400).json({
          success: false,
          error: "Complaint ID is required",
        });
      }
      if (!userId) {
        console.error("[LGU_ADMIN] Missing user ID");
        return res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
      }
      // Support both single officer (officerId) and multiple officers (officerIds)
      const officersToAssign =
        officerIds && Array.isArray(officerIds)
          ? officerIds
          : officerId
            ? [officerId]
            : [];
      if (officersToAssign.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No officers specified for assignment",
        });
      }
      // Extract department from user metadata (check multiple possible field names)
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;
      // console.log removed for security
      if (!departmentCode) {
        return res.status(400).json({
          success: false,
          error:
            "Department not specified in user metadata. Please contact administrator to set your department.",
        });
      }
      // Get department info
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("id, name, code")
        .eq("code", departmentCode)
        .single();
      if (deptError || !department) {
        return res.status(404).json({
          success: false,
          error: "Department not found",
        });
      }
      // Verify complaint exists and is assigned to this department
      const { data: complaint, error: complaintError } = await supabase
        .from("complaints")
        .select("*")
        .eq("id", complaintId)
        .single();
      if (complaintError || !complaint) {
        return res.status(404).json({
          success: false,
          error: "Complaint not found",
        });
      }
      // Check if complaint is assigned to this department
      if (
        !complaint.department_r ||
        !complaint.department_r.includes(departmentCode)
      ) {
        return res.status(403).json({
          success: false,
          error: "Complaint is not assigned to your department",
        });
      }
      // Generate a unique assignment group ID for this multi-officer assignment
      const assignmentGroupId = crypto.randomUUID();
      const assignmentType = officersToAssign.length > 1 ? "multi" : "single";
      // Create assignment records for each officer
      const assignments = [];
      const rejectedOfficers = [];
      // Fetch all users once to avoid multiple API calls
      let allUsers = [];
      try {
        const { data: authUsers, error: authError } =
          await supabase.auth.admin.listUsers();
        if (authError) {
          console.error(
            "[LGU_ADMIN] Error fetching auth users for officer verification:",
            authError
          );
          return res.status(500).json({
            success: false,
            error: "Failed to fetch officer data",
          });
        }
        allUsers = authUsers.users || [];
        // console.log removed for security
      } catch (authErr) {
        console.error(
          "[LGU_ADMIN] Auth API error for officer verification:",
          authErr
        );
        return res.status(500).json({
          success: false,
          error: "Failed to fetch officer data",
        });
      }
      for (let i = 0; i < officersToAssign.length; i++) {
        const officerId = officersToAssign[i];
        // Find officer in the already fetched users
        const officerData = allUsers.find((u) => u.id === officerId);
        if (!officerData) {
          console.error("[LGU_ADMIN] Officer not found:", { officerId });
          rejectedOfficers.push({
            id: officerId,
            reason: "Officer not found in database",
          });
          continue; // Skip this officer but continue with others
        }
        const officer = officerData;
        // Debug: Log officer metadata structure
        // Check if officer belongs to this department
        const metadata = officer.user_metadata || {};
        const rawMetadata = officer.raw_user_meta_data || {};
        const role = metadata.role || rawMetadata.role || "";
        // Use the same logic as getDepartmentOfficers
        const isLguOfficer =
          role === "lgu" || role === "lgu-officer" || role === "lgu-admin";
        const hasCorrectDepartment =
          metadata.dpt === departmentCode ||
          rawMetadata.dpt === departmentCode ||
          metadata.department === departmentCode ||
          rawMetadata.department === departmentCode;
        // Check for legacy role system: lgu-{departmentCode} including lgu-admin-{departmentCode}
        const isLegacyOfficer = /^lgu-(?!hr)/.test(role);
        const roleContainsDepartment = role.includes(`-${departmentCode}`);
        const hasLegacyDepartment =
          metadata.department === departmentCode ||
          rawMetadata.department === departmentCode;
        const _belongsToDepartment =
          (isLguOfficer && hasCorrectDepartment) ||
          (isLegacyOfficer && (roleContainsDepartment || hasLegacyDepartment));
        // console.log removed for security
        // TEMPORARY: Allow any LGU user for testing (excluding HR)
        // TODO: Fix department matching logic
        const isAnyLguUser =
          role === "lgu" ||
          role === "lgu-officer" ||
          role === "lgu-admin" ||
          /^lgu-(?!hr)/.test(role);

        if (!isAnyLguUser) {
          console.error("[LGU_ADMIN] Officer is not an LGU user:", {
            officerId,
            officerEmail: "[REDACTED]",
            role,
            departmentCode,
            metadata: "[REDACTED]",
            rawMetadata: "[REDACTED]",
          });
          rejectedOfficers.push({
            id: officerId,
            email: "[REDACTED]",
            reason: "Officer is not an LGU user",
            role,
            departmentCode,
          });
          continue; // Skip this officer but continue with others
        }
        // console.log removed for security
        assignments.push({
          complaint_id: complaintId,
          assigned_to: officerId,
          assigned_by: userId,
          status: "assigned",
          priority: priority || "medium",
          deadline: deadline || null,
          notes: notes || null,
          assignment_type: assignmentType,
          assignment_group_id: assignmentGroupId,
          officer_order: i + 1,
          updated_at: new Date().toISOString(),
        });
      }
      if (assignments.length === 0) {
        console.error(
          "[LGU_ADMIN] No valid officers found for assignment. Rejected officers:",
          rejectedOfficers
        );
        return res.status(400).json({
          success: false,
          error: "No valid officers found for assignment",
          details: {
            totalOfficers: officersToAssign.length,
            rejectedOfficers,
            adminDepartment: departmentCode,
          },
        });
      }
      // Log if some officers were rejected
      if (rejectedOfficers.length > 0) {
        console.warn(
          "[LGU_ADMIN] Some officers were rejected:",
          rejectedOfficers
        );
        // console.log removed for security
      }
      // Update complaint status
      const { data: updatedComplaint, error: updateError } = await supabase
        .from("complaints")
        .update({
          status: "assigned to officer",
          workflow_status: "in_progress",
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", complaintId)
        .select()
        .single();
      if (updateError) {
        console.error("[LGU_ADMIN] Error updating complaint:", updateError);
        return res.status(500).json({
          success: false,
          error: "Failed to update complaint status",
        });
      }
      // Create assignment records for all officers
      const { data: createdAssignments, error: assignError } = await supabase
        .from("complaint_assignments")
        .insert(assignments)
        .select();
      if (assignError) {
        console.error("[LGU_ADMIN] Error creating assignments:", assignError);
        return res.status(500).json({
          success: false,
          error: "Failed to create assignments",
        });
      }
      // Notify all assigned officers
      const notificationPromises = [];
      for (const assignment of createdAssignments) {
        notificationPromises.push(
          notificationService
            .notifyTaskAssigned(
              assignment.assigned_to,
              complaintId,
<<<<<<< HEAD
              updatedComplaint.descriptive_su || "Complaint",
=======
              updatedComplaint.descriptive_su?.slice(0, 100) || 'Complaint',
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
              priority === "urgent" ? "urgent" : "info",
              deadline
            )
            .catch((notifError) => {
              console.warn(
                "[LGU_ADMIN] Failed to notify officer:",
                notifError.message
              );
            })
        );
      }
      // Notify citizen that their complaint was assigned
      if (complaint.submitted_by) {
        notificationPromises.push(
          notificationService
            .notifyComplaintAssignedToOfficer(
              complaint.submitted_by,
              complaintId,
<<<<<<< HEAD
              complaint.descriptive_su || "Complaint",
=======
              complaint.descriptive_su?.slice(0, 100) || 'Your complaint',
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
              {
                officer_count: createdAssignments.length,
                department: departmentCode,
              }
            )
            .catch((notifError) => {
              console.warn(
                "[LGU_ADMIN] Failed to notify citizen:",
                notifError.message
              );
            })
        );
      }
      // Send confirmation notification to the admin who made the assignment
      notificationPromises.push(
        notificationService
          .createNotification(
            userId,
            NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
            "Assignment Completed",
<<<<<<< HEAD
            `You successfully assigned "${updatedComplaint.descriptive_su || "Complaint"}" to ${createdAssignments.length} officer(s).`,
=======
            `You successfully assigned "${updatedComplaint.descriptive_su?.slice(0, 100) || 'a complaint'}" to ${createdAssignments.length} officer(s).`,
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
            {
              priority: NOTIFICATION_PRIORITY.INFO,
              link: `/lgu-admin/assignments`,
              metadata: {
                complaint_id: complaintId,
                assigned_officers: createdAssignments.map((a) => a.assigned_to),
                assignment_group_id: assignmentGroupId,
                total_officers: createdAssignments.length,
              },
            }
          )
          .catch((notifError) => {
            console.warn(
              "[LGU_ADMIN] Failed to send admin confirmation:",
              notifError.message
            );
          })
      );
      // Wait for all notifications to be sent (but don't fail if some fail)
      await Promise.allSettled(notificationPromises);

      res.json({
        success: true,
        message: `Complaint assigned to ${createdAssignments.length} officer(s) successfully`,
        assignments: createdAssignments,
        assignment_group_id: assignmentGroupId,
        assignment_type: assignmentType,
        total_officers: createdAssignments.length,
      });
    } catch (error) {
      console.error("[LGU_ADMIN] Assign to officer error:", error);
      console.error("[LGU_ADMIN] Error stack:", error.stack);
      console.error("[LGU_ADMIN] Request details:", {
        complaintId: req.params?.complaintId,
        officerIds: req.body?.officerIds,
        userId: req.user?.id,
        userRole: req.user?.role,
      });
      res.status(500).json({
        success: false,
        error: "Failed to assign complaint to officer",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
  /**
   * Get department assignments
   * Returns complaints assigned to the admin's department that need officer assignment
   * OPTIMIZED: Uses server-side pagination on the complaints table
   */
  async getDepartmentAssignments(req, res) {
    try {
      const _userRole = req.user.role;
      const {
        status,
        priority,
        page = 1,
        limit = 10,
        assignment_filter,
        sub_type,
        date_start,
        date_end,
      } = req.query;

      // Calculate pagination range
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const from = (pageNum - 1) * limitNum;
      const to = from + limitNum - 1;

      // Extract department from user metadata
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        // Fallback for testing environment if needed, otherwise error
        console.error("[LGU_ADMIN] No department found in user metadata");
        return res.status(400).json({
          success: false,
          error: "Department not specified in user metadata.",
        });
      }

      // Get department ID
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("id, name")
        .eq("code", departmentCode)
        .single();

      if (deptError || !department) {
        return res.status(404).json({
          success: false,
          error: "Department not found",
        });
      }

      // ---------------------------------------------------------
      // Step 1: Build the Optimized Complaints Query
      // ---------------------------------------------------------

      // Start with base query on complaints table
      let baseQuery = supabase
        .from("complaints")
        .select(
          "id, descriptive_su, location_text, submitted_at, submitted_by, department_r, workflow_status, priority, category, subcategory",
          { count: "exact" } // Request exact count for pagination
        )
        .contains("department_r", [departmentCode]);

      // Apply Filters

      // 1. Assignment Filter (Unassigned vs Assigned)
      // We map this to workflow_status to allow DB-level filtering
      if (assignment_filter === "unassigned") {
        // Unassigned usually means 'new' or 'pending'
        baseQuery = baseQuery.in("workflow_status", [
          "new",
          "pending",
          "New",
          "Pending",
          "NEW",
          "PENDING",
          "unassigned",
          "Unassigned",
          "UNASSIGNED",
        ]);
      } else if (assignment_filter === "assigned") {
        // Assigned means someone is working on it
        baseQuery = baseQuery.in("workflow_status", [
          "assigned",
          "in_progress",
          "assigned to officer",
          "Assigned",
          "In Progress",
          "In_Progress",
          "ASSIGNED",
          "IN_PROGRESS",
        ]);
      }

      // 2. Status Filter (Specific status)
      if (status && status !== "all") {
        if (status === "completed") {
          baseQuery = baseQuery.eq("workflow_status", "completed");
        } else {
          baseQuery = baseQuery.eq("workflow_status", status);
        }
      } else {
        // Default: If no specific status is requested, exclude completed/cancelled
        // UNLESS assignment_filter is set (since we handled it above)
        if (!assignment_filter || assignment_filter === "all") {
          baseQuery = baseQuery
            .neq("workflow_status", "completed")
            .neq("workflow_status", "cancelled");
        }
      }

      // 3. Priority Filter
      if (priority && priority !== "all") {
        baseQuery = baseQuery.eq("priority", priority);
      }

      // 4. Subcategory Filter
      if (sub_type && sub_type !== "all") {
        // Try checking both fields or prioritise one
        baseQuery = baseQuery.or(
          `category.eq.${sub_type},subcategory.eq.${sub_type}`
        );
      }

      // 5. Date Range Filter
      if (date_start) {
        // Assuming submitted_at covers the creation time
        baseQuery = baseQuery.gte("submitted_at", `${date_start}T00:00:00`);
      }
      if (date_end) {
        baseQuery = baseQuery.lte("submitted_at", `${date_end}T23:59:59`);
      }

      // Apply Pagination and Sort
      // Sorting by submitted_at DESC ensures consistent pagination
      baseQuery = baseQuery
        .order("submitted_at", { ascending: false })
        .range(from, to);

      // Execute Primary Query
      const {
        data: complaints,
        error: complaintsError,
        count,
      } = await baseQuery;

      if (complaintsError) {
        console.error(
          "[LGU_ADMIN] Error fetching complaints:",
          complaintsError
        );
        return res.status(500).json({
          success: false,
          error: "Failed to fetch complaints",
        });
      }

      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / limitNum);
      const complaintIds = complaints.map((c) => c.id);

      // ---------------------------------------------------------
      // Step 2a: Fetch Assignments for these SPECIFIC complaints
      // ---------------------------------------------------------

      const assignmentsMap = {};

      if (complaintIds.length > 0) {
        // Fetch assignments only for the displayed complaints
        const { data: assignments, error: assignError } = await supabase
          .from("complaint_assignments")
          .select(
            "id, complaint_id, assigned_to, assigned_by, status, priority, deadline, notes, created_at, updated_at, department_id, assigned_to_user:assigned_to(first_name, last_name)"
          )
          .in("complaint_id", complaintIds)
          .order("created_at", { ascending: false });

        if (!assignError && assignments) {
          assignments.forEach((a) => {
            if (!assignmentsMap[a.complaint_id]) {
              assignmentsMap[a.complaint_id] = [];
            }
            assignmentsMap[a.complaint_id].push(a);
          });
        }
      }

      // ---------------------------------------------------------
      // Step 2b: Fetch User Profiles (Manual Join)
      // ---------------------------------------------------------
      const userIds = [
        ...new Set(complaints.map((c) => c.submitted_by).filter(Boolean)),
      ];
      const usersMap = {};

      if (userIds.length > 0) {
        try {
          // Attempt to fetch users using auth admin API
          const { data: authUsers, error: usersError } =
            await supabase.auth.admin.listUsers();

          if (!usersError && authUsers && authUsers.users) {
            authUsers.users.forEach((u) => {
              if (userIds.includes(u.id)) {
                const metadata = u.user_metadata || {};
                const firstName =
                  metadata.first_name || metadata.name || "Citizen";
                const lastName = metadata.last_name || "";
                usersMap[u.id] = {
                  name: lastName ? `${firstName} ${lastName}` : firstName,
                  email: u.email,
                };
              }
            });
          }
        } catch (err) {
          console.warn(
            "[LGU_ADMIN] Failed to fetch user details:",
            err.message
          );
        }
      }

      // ---------------------------------------------------------
      // Step 3: Construct Response
      // ---------------------------------------------------------

      const finalData = complaints.map((complaint) => {
        const allAssignments = assignmentsMap[complaint.id] || [];
        const assignment = allAssignments.find(
          (a) => a.department_id === department.id
        );
        const hasOtherAssignments = allAssignments.some(
          (a) => a.department_id !== department.id
        );

        const userProfile = usersMap[complaint.submitted_by];

        // Basic fields from complaint
        const result = {
          id: assignment ? assignment.id : null,
          has_other_assignments: hasOtherAssignments,
          complaint_id: complaint.id, // Internal UUID

          // Use sliced UUID as Display ID since no readable ID exists
          display_id: complaint.id.slice(0, 8),

<<<<<<< HEAD
          // title: complaint.title, // Removed title usage
=======
          title: complaint.descriptive_su?.slice(0, 100) || 'No description',
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
          description: complaint.descriptive_su, // Mapped from descriptive_su
          location_text: complaint.location_text,
          citizen_name: userProfile
            ? userProfile.name
            : complaint.submitted_by
              ? "Citizen"
              : "Anonymous",

          assigned_to: assignment?.assigned_to || null,
          assigned_by: assignment?.assigned_by || null,
          // officer_name logic could be added here if needed using assignment.assigned_to_user

          status: assignment
            ? assignment.status
            : complaint.workflow_status === "new"
              ? "unassigned"
              : complaint.workflow_status,
          priority: assignment?.priority || complaint.priority || "medium",

          deadline: assignment?.deadline || null,
          notes: assignment?.notes || null,

          created_at: assignment?.created_at || complaint.submitted_at,
          updated_at:
            assignment?.updated_at ||
            complaint.updated_at ||
            complaint.submitted_at,

          submitted_at: complaint.submitted_at,

          // Raw complaint object for fallback
          complaints: complaint,
          complaint_type: complaint.category,
          subcategory: complaint.subcategory,
        };

        return result;
      });

      // Calculate Stats (efficiently)
      const [unassignedCount, urgentCount, highCount, uniqueTypesData] =
        await Promise.all([
          // Count Unassigned (approximated by workflow_status for speed)
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("workflow_status", [
              "new",
              "pending",
              "New",
              "Pending",
              "NEW",
              "PENDING",
              "unassigned",
              "Unassigned",
              "UNASSIGNED",
            ])
            .then((res) => res.count || 0),

          // Count Urgent
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("priority", ["urgent", "Urgent", "URGENT"])
            .neq("workflow_status", "completed")
            .neq("workflow_status", "Completed")
            .neq("workflow_status", "COMPLETED")
            .then((res) => res.count || 0),

          // Count High
          supabase
            .from("complaints")
            .select("id", { count: "exact", head: true })
            .contains("department_r", [departmentCode])
            .in("priority", ["high", "High", "HIGH"])
            .neq("workflow_status", "completed")
            .neq("workflow_status", "Completed")
            .neq("workflow_status", "COMPLETED")
            .then((res) => res.count || 0),

          // Fetch Dictionary of Types (Scan all)
          supabase
            .from("complaints")
            .select("category, subcategory")
            .contains("department_r", [departmentCode])
            .then((res) => res.data || []),
        ]);

      // Process unique types
      const typeSet = new Set();
      if (uniqueTypesData) {
        uniqueTypesData.forEach((item) => {
          if (item.category) typeSet.add(item.category);
          if (item.subcategory) typeSet.add(item.subcategory);
        });
      }
      const uniqueSubcategories = Array.from(typeSet).sort();

      res.json({
        success: true,
        data: finalData,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalItems,
          pages: totalPages,
        },
        unique_subcategories: uniqueSubcategories,
        stats: {
          unassigned: unassignedCount,
          urgent: urgentCount,
          high: highCount,
        },
      });
    } catch (error) {
      console.error(
        "[LGU_ADMIN] Get department assignments error with pagination:",
        error
      );
      res.status(500).json({
        success: false,
        error: "Failed to fetch assignments",
        details: error.message,
      });
    }
  }
  /**
   * Get department officers
   * Returns list of LGU officers in the admin's department
   */
  async getDepartmentOfficers(req, res) {
    try {
      const userRole = req.user.role;

      // Extract department from user metadata (check multiple possible field names)
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        console.error("[LGU_ADMIN] No department found in user metadata:", {
          userRole,
          metadata: req.user.metadata,
          rawMetadata: req.user.raw_user_meta_data,
        });
        return res.status(400).json({
          success: false,
          error:
            "Department not specified in user metadata. Please contact administrator to set your department.",
          details: {
            userRole,
            hasMetadata: Boolean(req.user.metadata),
            hasRawMetadata: Boolean(req.user.raw_user_meta_data),
            metadataKeys: Object.keys(req.user.metadata || {}),
            rawMetadataKeys: Object.keys(req.user.raw_user_meta_data || {}),
          },
        });
      }
      // Get the department ID
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("id")
        .eq("code", departmentCode)
        .single();
      if (deptError || !department) {
        console.error("[LGU_ADMIN] Department not found:", {
          departmentCode,
          error: deptError,
        });
        return res.status(404).json({
          success: false,
          error: "Department not found",
        });
      }
      // Get all users and filter for LGU officers in this department
      // Use admin auth API to get users instead of direct table query
      let users = [];
      try {
        const { data: authUsers, error: authError } =
          await supabase.auth.admin.listUsers();
        if (authError) {
          console.error("[LGU_ADMIN] Error fetching auth users:", authError);
          return res.status(500).json({
            success: false,
            error: "Failed to fetch users",
            details: authError.message,
          });
        }
        users = authUsers.users || [];
        // console.log removed for security
      } catch (authErr) {
        console.error("[LGU_ADMIN] Auth API error:", authErr);
        return res.status(500).json({
          success: false,
          error: "Failed to fetch users via auth API",
          details: authErr.message,
        });
      }
      // console.log removed for security
      // console.log removed for security
      const officers = users
        .filter((user) => {
          const metadata = user.user_metadata || {};
          const rawMetadata = user.raw_user_meta_data || {};
          const role = metadata.role || rawMetadata.role || "";
          // Debug logging for each user
          // console.log removed for security
          // Check for simplified role system: lgu with department in metadata, or lgu-admin
          const isLguOfficer =
            role === "lgu" || role === "lgu-officer" || role === "lgu-admin";
          const hasCorrectDepartment =
            metadata.dpt === departmentCode ||
            rawMetadata.dpt === departmentCode ||
            metadata.department === departmentCode ||
            rawMetadata.department === departmentCode;
          // Check for legacy role system: lgu-{departmentCode} including lgu-admin-{departmentCode}
          const isLegacyOfficer = /^lgu-(?!hr)/.test(role);
          const roleContainsDepartment = role.includes(`-${departmentCode}`);
          const hasLegacyDepartment =
            metadata.department === departmentCode ||
            rawMetadata.department === departmentCode;
          const isMatch =
            (isLguOfficer && hasCorrectDepartment) ||
            (isLegacyOfficer &&
              (roleContainsDepartment || hasLegacyDepartment));
          // TEMPORARY: Allow any LGU user for testing (excluding HR)
          const isAnyLguUser =
            role === "lgu" ||
            role === "lgu-officer" ||
            role === "lgu-admin" ||
            /^lgu-(?!hr)/.test(role);
          const finalMatch = isMatch || isAnyLguUser;
          if (finalMatch) {
            // console.log removed for security
          }
          return finalMatch;
        })
        .map((user) => ({
          id: user.id,
          name:
            user.user_metadata?.name ||
            user.raw_user_meta_data?.name ||
            user.email,
          email: user.email,
          employee_id:
            user.user_metadata?.employee_id ||
            user.raw_user_meta_data?.employee_id,
          mobile: user.user_metadata?.mobile || user.raw_user_meta_data?.mobile,
        }));
      // console.log removed for security
      return res.json({
        success: true,
        data: officers,
      });
    } catch (error) {
      console.error("[LGU_ADMIN] Get officers error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to get department officers",
      });
    }
  }
  /**
   * Assign complaint to officer
   */
  async assignComplaint(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { complaintId, officerId, priority, deadline, notes } = req.body;
      if (!complaintId || !officerId) {
        return res.status(400).json({
          success: false,
          error: "Complaint ID and Officer ID are required",
        });
      }
      // Extract department from user metadata (check multiple possible field names)
      const departmentCode =
        req.user.department ||
        req.user.metadata?.department ||
        req.user.raw_user_meta_data?.department ||
        req.user.raw_user_meta_data?.dpt;
      if (!departmentCode) {
        console.error("[LGU_ADMIN] No department found in user metadata:", {
          userRole,
          metadata: req.user.metadata,
          rawMetadata: req.user.raw_user_meta_data,
        });
        return res.status(400).json({
          success: false,
          error:
            "Department not specified in user metadata. Please contact administrator to set your department.",
          details: {
            userRole,
            hasMetadata: Boolean(req.user.metadata),
            hasRawMetadata: Boolean(req.user.raw_user_meta_data),
            metadataKeys: Object.keys(req.user.metadata || {}),
            rawMetadataKeys: Object.keys(req.user.raw_user_meta_data || {}),
          },
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
          error: "Department not found",
        });
      }
      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from("complaint_assignments")
        .select("id")
        .eq("complaint_id", complaintId)
        .maybeSingle(); // Don't error if not found

      let assignment;

      if (existingAssignment) {
        // Update existing assignment
        const { data: updatedAssignment, error: updateError } = await supabase
          .from("complaint_assignments")
          .update({
            assigned_to: officerId,
            assigned_by: userId,
            department_id: department.id, // Ensure department_id is set on update too
            priority: priority || "medium",
            deadline: deadline || null,
            notes: notes || null,
            status: "assigned", // Changed from 'active' to 'assigned' to match table schema
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAssignment.id)
          .select()
          .single();
        if (updateError) {
          console.error("[LGU_ADMIN] Error updating assignment:", updateError);
          return res.status(500).json({
            success: false,
            error: "Failed to update assignment",
          });
        }
        assignment = updatedAssignment;
      } else {
        // Create new assignment
        const { data: newAssignment, error: insertError } = await supabase
          .from("complaint_assignments")
          .insert({
            complaint_id: complaintId,
            assigned_to: officerId,
            assigned_by: userId,
            department_id: department.id, // Set department ID (bigint) for proper data tracking - matches departments.id type
            priority: priority || "medium",
            deadline: deadline || null,
            notes: notes || null,
            status: "assigned", // Changed from 'active' to 'assigned' to match table schema
          })
          .select()
          .single();
        if (insertError) {
          console.error("[LGU_ADMIN] Error creating assignment:", insertError);
          return res.status(500).json({
            success: false,
            error: "Failed to create assignment",
          });
        }
        assignment = newAssignment;
      }
      // Get complaint details
      const { data: complaint } = await supabase
        .from("complaints")
<<<<<<< HEAD
        .select("descriptive_su, id, submitted_by") // Removed 'title' from select
=======
        .select("descriptive_su, id, submitted_by")
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
        .eq("id", complaintId)
        .single();
      // Send notification to the officer
      // Map complaint priority to notification priority
      const notificationPriority =
        priority === "urgent"
          ? "urgent"
          : priority === "high"
            ? "warning"
            : "info";
      await notificationService.notifyTaskAssigned(
        officerId,
        complaintId,
<<<<<<< HEAD
        complaint?.descriptive_su || "a complaint", // Changed from complaint?.title
=======
        complaint?.descriptive_su?.slice(0, 100) || "a complaint",
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
        notificationPriority,
        deadline
      );
      // Notify citizen that their complaint was assigned
      if (complaint?.submitted_by) {
        await notificationService
          .notifyComplaintAssignedToOfficer(
            complaint.submitted_by,
            complaintId,
<<<<<<< HEAD
            complaint.descriptive_su || "Complaint", // Changed from complaint.title
=======
            complaint.descriptive_su?.slice(0, 100) || 'Your complaint',
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
            { officer_count: 1, department: departmentCode }
          )
          .catch((notifError) => {
            console.warn(
              "[LGU_ADMIN] Failed to notify citizen:",
              notifError.message
            );
          });
      }
      // Send confirmation notification to the admin who made the assignment
      await notificationService.createNotification(
        userId,
        NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
        "Assignment Completed",
<<<<<<< HEAD
        `You successfully assigned "${complaint?.descriptive_su || "a complaint"
=======
        `You successfully assigned "${
          complaint?.descriptive_su?.slice(0, 100) || "a complaint"
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
        }" to an officer.`,
        {
          priority: NOTIFICATION_PRIORITY.INFO,
          link: `/lgu-admin/assignments`,
          metadata: {
            complaint_id: complaintId,
            assigned_officer_id: officerId,
            assignment_id: assignment.id,
          },
        }
      );
      return res.json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      console.error("[LGU_ADMIN] Assign complaint error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to assign complaint",
      });
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
        return res.status(400).json({
          success: false,
          error: "Officer ID, complaint ID, and reminder type are required",
        });
      }
      // Use CoordinatorService to send the reminder
      const CoordinatorService = require("../services/CoordinatorService");

      const coordinatorService = new CoordinatorService();
      const result = await coordinatorService.sendOfficerReminder(
        adminId,
        officerId,
        complaintId,
        reminderType,
        customMessage
      );
      res.json(result);
    } catch (error) {
      console.error("[LGU_ADMIN] Send officer reminder error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to send reminder",
      });
    }
  }
  /**
   * Get pending assignments summary
   */
  async getPendingAssignmentsSummary(req, res) {
    try {
      // Use CoordinatorService to get summary
      const CoordinatorService = require("../services/CoordinatorService");

      const coordinatorService = new CoordinatorService();
      const result = await coordinatorService.getPendingAssignmentsSummary();
      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error(
        "[LGU_ADMIN] Get pending assignments summary error:",
        error
      );
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get pending assignments summary",
      });
    }
  }
  /**
   * Get officers needing attention
   */
  async getOfficersNeedingAttention(req, res) {
    try {
      const { data: assignments, error } = await supabase
        .from("complaint_assignments")
        .select(
          `
          *,
          complaints!inner(id, descriptive_su, workflow_status, submitted_at, priority),
          departments(id, code, name)
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Group by officer and identify overdue items
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
        // Check if overdue (7+ days)
        const daysSinceAssignment = Math.floor(
          (Date.now() - new Date(assignment.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        if (daysSinceAssignment > 7) {
          officerGroups[officerId].overdue_count++;
        }
        officerGroups[officerId].complaints.push({
          id: assignment.complaints.id,
<<<<<<< HEAD
          title: assignment.complaints.descriptive_su || "Complaint",
=======
          title: assignment.complaints.descriptive_su?.slice(0, 100) || 'No description',
>>>>>>> 912f5b440e12e8a4109f8b57db78b49717ddf4ac
          priority: assignment.complaints.priority,
          assigned_days_ago: daysSinceAssignment,
          is_overdue: daysSinceAssignment > 7,
        });
      }
      // Filter officers who need attention (have overdue items or many pending items)
      for (const officerId in officerGroups) {
        const officer = officerGroups[officerId];
        if (officer.overdue_count > 0 || officer.assignments_count > 3) {
          // Get officer details using admin auth API
          try {
            const { data: authUsers, error: authError } =
              await supabase.auth.admin.listUsers();
            if (authError) {
              console.error(
                "[LGU_ADMIN] Error fetching auth users for officer details:",
                authError
              );
              continue;
            }
            const officerData = authUsers?.users?.find(
              (u) => u.id === officerId
            );
            if (officerData) {
              officersNeedingAttention.push({
                ...officer,
                name:
                  officerData.user_metadata?.name ||
                  officerData.raw_user_meta_data?.name ||
                  officerData.email ||
                  "Unknown Officer",
                email: officerData.email,
              });
            }
          } catch (authErr) {
            console.error(
              "[LGU_ADMIN] Auth API error for officer details:",
              authErr
            );
            // Continue without officer details
            officersNeedingAttention.push({
              ...officer,
              name: "Unknown Officer",
              email: "N/A",
            });
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
      console.error("[LGU_ADMIN] Get officers needing attention error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get officers needing attention",
      });
    }
  }
}

module.exports = LguAdminController;
