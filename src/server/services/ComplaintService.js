const ComplaintRepository = require("../repositories/ComplaintRepository");
const ComplaintAssignmentRepository = require("../repositories/ComplaintAssignmentRepository");
const DepartmentRepository = require("../repositories/DepartmentRepository");
const Complaint = require("../models/Complaint");
const NotificationService = require("./NotificationService");
const {
  normalizeComplaintData,
  prepareComplaintForInsert,
  validateComplaintConsistency,
  _getAssignmentProgress,
} = require("../utils/complaintUtils");

class ComplaintService {
  constructor(
    complaintRepo,
    assignmentRepo,
    departmentRepo,
    notificationService
  ) {
    this.complaintRepo = complaintRepo || new ComplaintRepository();
    this.assignmentRepo = assignmentRepo || new ComplaintAssignmentRepository();
    this.departmentRepo = departmentRepo || new DepartmentRepository();
    this.notificationService = notificationService || new NotificationService();
  }
  async createComplaint(userId, complaintData, files = [], token = null) {
    // Debug: Log received complaint data
    // Debug: Log received complaint data
    // Parse preferred_departments - handle both array and individual values
    let preferredDepartments = complaintData.preferred_departments || [];
    // If preferred_departments is a string, check if it's JSON or just a single value
    if (typeof preferredDepartments === "string") {
      // Try to parse as JSON first
      try {
        preferredDepartments = JSON.parse(preferredDepartments);
      } catch (e) {
        // If JSON parsing fails, treat it as a single department code
        // If JSON parsing fails, treat it as a single department code
        preferredDepartments = [preferredDepartments].filter(Boolean);
      }
    }
    // If preferred_departments is not an array, convert it to array
    if (!Array.isArray(preferredDepartments)) {
      preferredDepartments = [preferredDepartments].filter(Boolean);
    }

    // Map client field names to server field names
    const mappedData = {
      ...complaintData,
      submitted_by: userId,
      // All submissions are complaints - no need for user to choose type
      type: "complaint",
      // Map 'description' from client to 'descriptive_su' expected by server model
      descriptive_su: complaintData.description || complaintData.descriptive_su,
      // Store user's preferred departments
      preferred_departments: preferredDepartments,
      // Initially empty - will be populated by coordinator assignment
      department_r: [],
      // Note: category and subcategory fields are passed through as-is (UUIDs from categories/subcategories tables)
    };

    // Prepare data for insertion using utility functions
    const preparedData = prepareComplaintForInsert(mappedData);

    // Debug: Log what fields are being sent to database
    // Debug: Log what fields are being sent to database

    // Validate data consistency
    const consistencyCheck = validateComplaintConsistency(preparedData);
    if (!consistencyCheck.isValid) {
      console.warn(
        "[COMPLAINT] Data consistency issues:",
        consistencyCheck.errors
      );
    }
    const complaint = new Complaint(preparedData);
    const validation = Complaint.validate(complaint);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }
    const sanitizedData = complaint.sanitizeForInsert();
    const createdComplaint = await this.complaintRepo.create(
      sanitizedData,
      token
    );

    try {
      await this._processWorkflow(createdComplaint, preferredDepartments);
      await this._processFileUploads(createdComplaint.id, files, userId);
      // Send notification to citizen
      try {
        await this.notificationService.notifyComplaintSubmitted(
          userId,
          createdComplaint.id,
          createdComplaint.title
        );
      } catch (notifError) {
        console.warn(
          "[COMPLAINT] Failed to send submission notification:",
          notifError.message
        );
      }
      // Send notification to complaint coordinator
      try {
        // Use the new method that finds all coordinators and notifies them
        const coordResult =
          await this.notificationService.notifyAllCoordinators(
            createdComplaint.id,
            createdComplaint.title
          );
        if (coordResult.success) {
        } else {
          console.warn(
            "[COMPLAINT] Failed to send coordinator notifications:",
            coordResult.error
          );
        }
      } catch (coordNotifError) {
        console.warn(
          "[COMPLAINT] Failed to send coordinator notification:",
          coordNotifError.message
        );
      }
      const finalComplaint = await this.complaintRepo.findById(
        createdComplaint.id,
        token
      );
      return finalComplaint;
    } catch (error) {
      console.warn("Post-creation processing failed:", error.message);
      return createdComplaint;
    }
  }
  async _processWorkflow(complaint, departmentArray) {
    // Set primary and secondary departments from user selection
    if (departmentArray.length > 0) {
      try {
        await this.complaintRepo.update(complaint.id, {
          // primary_department: departmentArray[0], // Removed - derived from department_r
          // secondary_departments: departmentArray.slice(1), // Removed - derived from department_r
          // Ensure workflow status is 'new' for coordinator review
          workflow_status: "new",
          updated_at: new Date().toISOString(),
        });

        // Create complaint_assignments for primary and secondary departments
        for (const deptCode of departmentArray) {
          try {
            const dept = await this.departmentRepo.findByCode(deptCode);
            if (dept && dept.id) {
              await this.assignmentRepo.assign(
                complaint.id,
                dept.id,
                complaint.submitted_by,
                { status: "pending" }
              );
              // TODO: Fix notifyDepartmentAdminsByCode RPC function
              // Notify department admins about new assignment
              // try {
              //   await this.notificationService.notifyDepartmentAdminsByCode(
              //     deptCode,
              //     complaint.id,
              //     complaint.title
              //   );
              // } catch (notifErr) {
              //   console.warn('[WORKFLOW] Notify admins failed:', notifErr.message);
              // }
            }
          } catch (assignErr) {
            console.warn(
              "[WORKFLOW] Assignment creation failed for dept:",
              deptCode,
              assignErr.message
            );
          }
        }
      } catch (error) {
        console.warn("[WORKFLOW] Department assignment failed:", error.message);
      }
    }
    // Auto-assignment based on complaint content (type field removed)
    // TODO: Implement auto_assign_departments RPC function
    // try {
    //   const autoAssignResult = await this.complaintRepo.autoAssignDepartments(complaint.id);
    //   if (autoAssignResult && autoAssignResult.length > 0) {

    //   }
    // } catch (error) {
    //   console.warn('[WORKFLOW] Auto-assignment failed:', error.message);
    // }
    if (departmentArray.length > 0) {
      const targetDept = departmentArray[0];
      try {
        const coordinator = await this.complaintRepo.findActiveCoordinator(
          targetDept
        );
        if (coordinator) {
          await this.complaintRepo.assignCoordinator(
            complaint.id,
            coordinator.user_id
          );
          // TODO: Fix log_complaint_action RPC function parameter types
          // await this.complaintRepo.logAction(complaint.id, 'coordinator_assigned', {
          //   to_dept: targetDept,
          //   reason: 'Auto-assigned available coordinator'
          // });
        }
      } catch (error) {
        console.warn(
          "[WORKFLOW] Coordinator assignment failed:",
          error.message
        );
      }
    }
    // TODO: Fix log_complaint_action RPC function parameter types
    // try {
    //   await this.complaintRepo.logAction(complaint.id, 'created', {
    //     reason: 'Complaint submitted by citizen',
    //     details: {
    //       title: complaint.title,
    //       departments: departmentArray,
    //       has_evidence: false
    //     }
    //   });
    // } catch (error) {
    //   console.warn('[AUDIT] Audit logging failed:', error.message);
    // }
  }
  async _processFileUploads(complaintId, files, userId = null) {
    if (!files || files.length === 0) {
      return [];
    }
    // Use the same Database instance to ensure consistent client
    const { supabase } = this.complaintRepo;
    const evidenceFiles = [];
    for (const file of files) {
      try {
        // Store in evidence subfolder for initial evidence
        const fileName = `${complaintId}/evidence/${Date.now()}-${
          file.originalname
        }`;
        // Upload file to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("complaint-evidence")
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) {
          console.error("[FILE] Upload error:", uploadError);
          continue;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("complaint-evidence").getPublicUrl(fileName);
        evidenceFiles.push({
          fileName: file.originalname,
          filePath: uploadData.path,
          fileType: file.mimetype,
          fileSize: file.size,
          publicUrl,
        });
        // Store evidence metadata in database with evidence_type='initial'
        try {
          const { error: dbError } = await supabase
            .from("complaint_evidence")
            .insert({
              complaint_id: complaintId,
              file_name: file.originalname,
              file_path: uploadData.path,
              file_size: file.size,
              file_type: file.mimetype,
              mime_type: file.mimetype,
              uploaded_by: userId,
              evidence_type: "initial",
              is_public: false,
            });
          if (dbError) {
            console.error("[FILE] Evidence metadata storage error:", dbError);
          }
        } catch (dbErr) {
          console.error("[FILE] Evidence metadata storage failed:", dbErr);
        }
      } catch (error) {
        console.error("[FILE] Processing error:", error);
      }
    }
    if (evidenceFiles.length > 0) {
      await this.complaintRepo.updateEvidence(
        complaintId,
        evidenceFiles,
        userId
      );
    }
    return evidenceFiles;
  }
  async addEvidence(complaintId, files, userId = null) {
    return this._processFileUploads(complaintId, files, userId);
  }
  /**
   * Process completion evidence files and upload to storage
   * Stores files in {complaintId}/completion/ subfolder
   */
  async _processCompletionEvidence(complaintId, files, userId = null) {
    if (!files || files.length === 0) {
      return [];
    }
    const { supabase } = this.complaintRepo;
    const evidenceFiles = [];
    for (const file of files) {
      try {
        // Store in completion subfolder
        const fileName = `${complaintId}/completion/${Date.now()}-${
          file.originalname
        }`;
        // Upload file to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("complaint-evidence")
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) {
          console.error(
            "[FILE] Completion evidence upload error:",
            uploadError
          );
          continue;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("complaint-evidence").getPublicUrl(fileName);
        evidenceFiles.push({
          fileName: file.originalname,
          filePath: uploadData.path,
          fileType: file.mimetype,
          fileSize: file.size,
          publicUrl,
        });
        // Store evidence metadata in database with evidence_type='completion'
        try {
          const { error: dbError } = await supabase
            .from("complaint_evidence")
            .insert({
              complaint_id: complaintId,
              file_name: file.originalname,
              file_path: uploadData.path,
              file_size: file.size,
              file_type: file.mimetype,
              mime_type: file.mimetype,
              uploaded_by: userId,
              evidence_type: "completion",
              is_public: false,
            });
          if (dbError) {
            console.error("[FILE] Evidence metadata storage error:", dbError);
          }
        } catch (dbErr) {
          console.error("[FILE] Evidence metadata storage failed:", dbErr);
        }
      } catch (error) {
        console.error("[FILE] Processing completion evidence error:", error);
      }
    }
    return evidenceFiles;
  }
  async getComplaintById(id, userId = null, token = null) {
    try {
      const complaint = await this.complaintRepo.findById(id, token);
      if (!complaint) {
        console.log(
          `[COMPLAINT_SERVICE] Complaint ${id} not found in database`
        );
        throw new Error("Complaint not found");
      }
      if (userId && complaint.submitted_by !== userId) {
        console.log(
          `[COMPLAINT_SERVICE] Access denied: User ${userId} attempted to access complaint ${id} owned by ${complaint.submitted_by}`
        );
        throw new Error("Access denied");
      }
      // Get assignment data for progress tracking (without accessing auth.users)
      const { data: assignments } = await this.complaintRepo.supabase
        .from("complaint_assignments")
        .select(
          "id, complaint_id, assigned_to, assigned_by, status, priority, assignment_type, assignment_group_id, officer_order, created_at, updated_at"
        )
        .eq("complaint_id", id)
        .order("officer_order", { ascending: true });
      // Add assignments to complaint data
      complaint.assignments = assignments || [];
      // Fetch complainant info from auth.users for admin, officers, and coordinators
      // Only fetch if userId is null (meaning user is not a citizen viewing their own complaint)
      if (!userId && complaint.submitted_by) {
        try {
          const { data: submitterData, error: submitterError } =
            await this.complaintRepo.supabase.auth.admin.getUserById(
              complaint.submitted_by
            );
          if (!submitterError && submitterData?.user) {
            const { user } = submitterData;
            const meta = user.user_metadata || {};
            const rawMeta = user.raw_user_meta_data || {};
            const combined = { ...rawMeta, ...meta };
            complaint.submitted_by_profile = {
              id: user.id,
              email: user.email,
              name:
                combined.name ||
                `${combined.first_name || ""} ${
                  combined.last_name || ""
                }`.trim() ||
                user.email,
              firstName: combined.first_name,
              lastName: combined.last_name,
              mobileNumber:
                rawMeta.mobile_number ||
                meta.mobile_number ||
                combined.mobile_number ||
                null,
              mobile:
                rawMeta.mobile_number ||
                meta.mobile_number ||
                combined.mobile_number ||
                null,
              raw_user_meta_data: rawMeta,
            };
          }
        } catch (error) {
          console.error(
            "[COMPLAINT_SERVICE] Error fetching complainant info:",
            error
          );
          // Continue without complainant info if fetch fails
        }
      }
      // Reconcile workflow (eventual consistency)
      try {
        await this.reconcileWorkflowStatus(id);
      } catch (error) {
        // Silently fail if reconciliation is not available
        console.warn(
          "[COMPLAINT_SERVICE] Workflow reconciliation skipped:",
          error.message
        );
      }
      // Return normalized complaint data for frontend compatibility
      return normalizeComplaintData(complaint);
    } catch (error) {
      // Re-throw known errors (Complaint not found, Access denied)
      if (
        error.message === "Complaint not found" ||
        error.message === "Access denied"
      ) {
        throw error;
      }
      // Log and wrap unexpected errors
      console.error(
        `[COMPLAINT_SERVICE] Unexpected error in getComplaintById for ${id}:`,
        error
      );
      throw new Error(`Failed to fetch complaint: ${error.message}`);
    }
  }
  /**
   * Reconcile workflow status based on current assignments and confirmations
   * This ensures eventual consistency between workflow_status and actual state
   * @param {string} complaintId - Complaint ID
   */
  async reconcileWorkflowStatus(complaintId) {
    try {
      // Get current complaint state
      const complaint = await this.complaintRepo.findById(complaintId);
      if (!complaint) {
        return; // Complaint not found, nothing to reconcile
      }

      // Update confirmation status using database function
      // This ensures confirmation_status is consistent with assignments
      await this.complaintRepo.supabase.rpc(
        "update_complaint_confirmation_status",
        {
          complaint_uuid: complaintId,
        }
      );

      // Additional workflow reconciliation logic can be added here if needed
      // For now, the confirmation status update is sufficient
    } catch (error) {
      // Log but don't throw - reconciliation is best-effort
      console.warn(
        "[COMPLAINT_SERVICE] Workflow reconciliation error:",
        error.message
      );
    }
  }
  async getUserComplaints(userId, options = {}) {
    try {
      const result = await this.complaintRepo.findByUserId(userId, options);
      return result;
    } catch (error) {
      console.error("[COMPLAINT_SERVICE] Error in getUserComplaints:", error);
      console.error("[COMPLAINT_SERVICE] Error stack:", error.stack);
      throw error;
    }
  }
  async getUserStatistics(userId) {
    try {
      const { supabase } = this.complaintRepo;
      // Get total complaints count
      const { count: totalComplaints, error: totalError } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("submitted_by", userId);
      if (totalError) throw totalError;
      // Get complaints by workflow_status
      const { data: statusData, error: statusError } = await supabase
        .from("complaints")
        .select("workflow_status")
        .eq("submitted_by", userId);
      if (statusError) throw statusError;
      // Count by workflow_status
      const statusCounts = statusData.reduce((acc, complaint) => {
        acc[complaint.workflow_status] =
          (acc[complaint.workflow_status] || 0) + 1;
        return acc;
      }, {});
      // Get complaints by category (more meaningful than type)
      const { data: categoryData, error: categoryError } = await supabase
        .from("complaints")
        .select("category")
        .eq("submitted_by", userId);
      if (categoryError) throw categoryError;
      // Count by category
      const categoryCounts = categoryData.reduce((acc, complaint) => {
        const category = complaint.category || "Uncategorized";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});
      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: recentComplaints, error: recentError } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("submitted_by", userId)
        .gte("submitted_at", thirtyDaysAgo.toISOString());
      if (recentError) throw recentError;
      return {
        totalComplaints: totalComplaints || 0,
        recentComplaints: recentComplaints || 0,
        statusCounts,
        categoryCounts, // Changed from typeCounts to categoryCounts
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        "[COMPLAINT-SERVICE] Error fetching user statistics:",
        error
      );
      throw error;
    }
  }
  async getAllComplaints(options = {}) {
    return this.complaintRepo.findAll(options);
  }
  async updateComplaintStatus(id, updateData, userId = null) {
    const complaint = await this.getComplaintById(id);
    const {
      status: workflowStatus,
      priority,
      category,
      subcategory,
      notes,
    } = typeof updateData === "string"
      ? { status: updateData, notes: userId } // Handle legacy signature if needed
      : updateData;

    const dataToUpdate = { updated_at: new Date().toISOString() };

    if (workflowStatus) {
      const validStatuses = [
        "new",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ];
      if (!validStatuses.includes(workflowStatus)) {
        throw new Error("Invalid workflow status");
      }
      dataToUpdate.workflow_status = workflowStatus;
    }

    if (priority) dataToUpdate.priority = priority;
    if (category) dataToUpdate.category = category;
    if (subcategory) dataToUpdate.subcategory = subcategory;
    if (notes) dataToUpdate.coordinator_notes = notes;

    const updatedComplaint = await this.complaintRepo.update(id, dataToUpdate);

    try {
      await this.complaintRepo.logAction(id, "status_updated", {
        reason: `Complaint updated by coordinator/admin`,
        details: {
          old_status: complaint.workflow_status,
          new_status: workflowStatus || complaint.workflow_status,
          old_priority: complaint.priority,
          new_priority: priority || complaint.priority,
          notes,
        },
      });
    } catch (error) {
      console.warn("[AUDIT] Status update logging failed:", error.message);
    }

    // Send notification to citizen if status changed
    if (workflowStatus && complaint.workflow_status !== workflowStatus) {
      try {
        await this.notificationService.notifyComplaintStatusChanged(
          complaint.submitted_by,
          id,
          complaint.title,
          workflowStatus,
          complaint.workflow_status
        );
      } catch (notifError) {
        console.warn(
          "[COMPLAINT] Failed to send status change notification:",
          notifError.message
        );
      }
    }
    return updatedComplaint;
  }
  async assignCoordinator(complaintId, coordinatorId, assignedBy) {
    const _complaint = await this.getComplaintById(complaintId);
    const updatedComplaint = await this.complaintRepo.assignCoordinator(
      complaintId,
      coordinatorId
    );
    try {
      await this.complaintRepo.logAction(complaintId, "coordinator_assigned", {
        reason: "Manually assigned by admin",
        details: { assigned_by: assignedBy, coordinator_id: coordinatorId },
      });
    } catch (error) {
      console.warn(
        "[AUDIT] Coordinator assignment logging failed:",
        error.message
      );
    }
    return updatedComplaint;
  }
  async transferComplaint(
    complaintId,
    fromDept,
    toDept,
    reason,
    transferredBy
  ) {
    const _complaint = await this.getComplaintById(complaintId);
    const updatedComplaint = await this.complaintRepo.update(complaintId, {
      // primary_department: toDept, // Removed - derived from department_r
      assigned_coordinator_id: null,
    });
    try {
      const newCoordinator = await this.complaintRepo.findActiveCoordinator(
        toDept
      );
      if (newCoordinator) {
        await this.complaintRepo.assignCoordinator(
          complaintId,
          newCoordinator.user_id
        );
      }
    } catch (error) {
      console.warn(
        "[TRANSFER] New coordinator assignment failed:",
        error.message
      );
    }
    try {
      await this.complaintRepo.logAction(complaintId, "transferred", {
        reason,
        details: {
          from_dept: fromDept,
          to_dept: toDept,
          transferred_by: transferredBy,
        },
      });
    } catch (error) {
      console.warn("[AUDIT] Transfer logging failed:", error.message);
    }
    return updatedComplaint;
  }
  async getComplaintStats(filters = {}) {
    const { department, dateFrom, dateTo } = filters;

    // Helper to build base query
    const buildQuery = () => {
      let query = this.complaintRepo.supabase
        .from("complaints")
        .select("workflow_status, subtype, priority, submitted_at");

      if (department) {
        query = query.contains("department_r", [department]);
      }
      if (dateFrom) {
        query = query.gte("submitted_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("submitted_at", dateTo);
      }
      return query;
    };

    // Fetch all rows using pagination to bypass default limits
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await buildQuery().range(
        page * pageSize,
        (page + 1) * pageSize - 1
      );

      if (error) throw error;

      if (data.length > 0) {
        allData = allData.concat(data);
        page++;
        // If we got less than pageSize, we're done
        if (data.length < pageSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    const stats = {
      total: allData.length,
      by_status: {},
      by_subtype: {},
      by_priority: {},
      by_month: {},
    };

    allData.forEach((complaint) => {
      // Count by status
      stats.by_status[complaint.workflow_status] =
        (stats.by_status[complaint.workflow_status] || 0) + 1;

      // Count by subtype
      if (complaint.subtype) {
        stats.by_subtype[complaint.subtype] =
          (stats.by_subtype[complaint.subtype] || 0) + 1;
      }

      // Count by priority
      if (complaint.priority) {
        stats.by_priority[complaint.priority] =
          (stats.by_priority[complaint.priority] || 0) + 1;
      }

      // Count by month
      if (complaint.submitted_at) {
        const month = new Date(complaint.submitted_at)
          .toISOString()
          .slice(0, 7);
        stats.by_month[month] = (stats.by_month[month] || 0) + 1;
      }
    });

    return stats;
  }
  async getComplaintLocations(filters = {}) {
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
    try {
      // First, get total count of complaints with coordinates for debugging
      // IMPORTANT: Use direct supabase client to bypass any potential RLS issues
      // CRITICAL: Create a fresh service role client to ensure we BYPASS RLS
      // The repository client might be shared or not properly privileged in some contexts
      const { createClient } = require("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      // Use the fresh client for these diagnostic counts as well
      const { count: totalWithCoords } = await supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      const { count: _totalComplaints } = await supabase
        .from("complaints")
        .select("id", { count: "exact", head: true });

      let query = supabase
        .from("complaints")
        .select(
          "id, title, workflow_status, priority, latitude, longitude, location_text, submitted_at, department_r, category, subcategory",
          { count: "exact" }
        )
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("submitted_at", { ascending: false }); // Add ordering for consistency

      // Log filter parameters

      // Filter by workflow_status (supports array for multiple values)
      if (status) {
        if (Array.isArray(status) && status.length > 0) {
          // Multiple statuses - use .in() for OR filtering
          query = query.in("workflow_status", status);
        } else if (!Array.isArray(status)) {
          // Single status
          query = query.eq("workflow_status", status);
        }
      } else {
        // No status filter - check if we should exclude resolved
        if (!includeResolved) {
          // Exclude completed and cancelled complaints
          query = query
            .neq("workflow_status", "completed")
            .neq("workflow_status", "cancelled");
        } else {
          // includeResolved is true - show ALL complaints regardless of status
        }
      }

      // Filter by confirmation_status (supports array for multiple values)
      if (confirmationStatus) {
        if (
          Array.isArray(confirmationStatus) &&
          confirmationStatus.length > 0
        ) {
          // Multiple confirmation statuses - use .in() for OR filtering
          query = query.in("confirmation_status", confirmationStatus);
        } else if (!Array.isArray(confirmationStatus)) {
          // Single confirmation status
          query = query.eq("confirmation_status", confirmationStatus);
        }
      }
      // No 'type' field in schema; do not filter by it
      // Filter by department - checks department_r array (text array field)
      // Only complaints with the selected department code in their department_r array will be returned
      if (department) {
        // console.log("[COMPLAINT-SERVICE] Filtering by department:", department);
        const depts = Array.isArray(department) ? department : [department];
        if (depts.length > 0) {
          // Use overlaps operator (&&) to check if department_r has common elements with depts array
          query = query.overlaps("department_r", depts);
        }
      } else {
        // console.log("[COMPLAINT-SERVICE] No department filter applied");
      }
      // Filter by category (UUIDs from categories table, supports array for multiple values)
      if (category) {
        if (Array.isArray(category) && category.length > 0) {
          // Multiple categories - use .in() for OR filtering
          query = query.in("category", category);
        } else if (!Array.isArray(category)) {
          // Single category
          query = query.eq("category", category);
        }
      }
      // Filter by subcategory (UUID from subcategories table)
      if (subcategory) {
        query = query.eq("subcategory", subcategory);
      }
      // Filter by date range
      if (startDate) {
        query = query.gte("submitted_at", startDate);
      }
      if (endDate) {
        query = query.lte("submitted_at", endDate);
      }
      // IMPORTANT: Supabase PostgREST has a default limit that may be very low (sometimes as low as 7-10 rows)
      // For the heatmap, we want ALL complaints with coordinates
      // First, get the total count to know how many records we need to fetch
      // Clone the query for count to avoid modifying the original query
      // Clone the query for count to avoid modifying the original query
      let countQuery = supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      // Apply same filters to count query
      if (status) {
        if (Array.isArray(status) && status.length > 0) {
          countQuery = countQuery.in("workflow_status", status);
        } else if (!Array.isArray(status)) {
          countQuery = countQuery.eq("workflow_status", status);
        }
      } else if (!includeResolved) {
        countQuery = countQuery
          .neq("workflow_status", "completed")
          .neq("workflow_status", "cancelled");
      }

      if (confirmationStatus) {
        if (
          Array.isArray(confirmationStatus) &&
          confirmationStatus.length > 0
        ) {
          countQuery = countQuery.in("confirmation_status", confirmationStatus);
        } else if (!Array.isArray(confirmationStatus)) {
          countQuery = countQuery.eq("confirmation_status", confirmationStatus);
        }
      }

      if (department) {
        const depts = Array.isArray(department) ? department : [department];
        if (depts.length > 0) {
          countQuery = countQuery.overlaps("department_r", depts);
        }
      }

      if (category) {
        if (Array.isArray(category) && category.length > 0) {
          countQuery = countQuery.in("category", category);
        } else if (!Array.isArray(category)) {
          countQuery = countQuery.eq("category", category);
        }
      }

      if (subcategory) {
        countQuery = countQuery.eq("subcategory", subcategory);
      }

      if (startDate) {
        countQuery = countQuery.gte("submitted_at", startDate);
      }
      if (endDate) {
        countQuery = countQuery.lte("submitted_at", endDate);
      }

      const { count: totalCount, error: countError } = await countQuery;

      if (countError) {
        console.error(
          "[COMPLAINT-SERVICE] Error getting total count:",
          countError
        );
        // Continue anyway - pagination will handle it
      }

      // console.log(
      //   `[COMPLAINT-SERVICE] Total complaints matching filters: ${
      //     totalCount || "unknown"
      //   }`
      // );

      // Use pagination to fetch all records in batches
      const batchSize = 1000; // Fetch in batches of 1000
      let allData = [];
      let hasMore = true;
      let offset = 0;

      // Fetch all complaints using pagination
      while (hasMore) {
        const paginatedQuery = query
          .range(offset, offset + batchSize - 1)
          .limit(batchSize);

        const { data: batchData, error } = await paginatedQuery;

        if (error) {
          console.error("[COMPLAINT-SERVICE] Database error:", error);
          console.error(
            "[COMPLAINT-SERVICE] Error details:",
            JSON.stringify(error, null, 2)
          );
          throw error;
        }

        if (batchData && batchData.length > 0) {
          allData = allData.concat(batchData);
          // console.log(
          //   `[COMPLAINT-SERVICE] Fetched batch: ${batchData.length} complaints (total so far: ${allData.length})`
          // );
          offset += batchSize;
          // If we got fewer results than batchSize, we've reached the end
          hasMore = batchData.length === batchSize;
        } else {
          hasMore = false;
        }

        // Safety check: if we have a total count and we've fetched all records
        if (totalCount !== null && allData.length >= totalCount) {
          // console.log(
          //   `[COMPLAINT-SERVICE] Reached total count (${totalCount}), stopping pagination`
          // );
          hasMore = false;
        }

        // Additional safety: prevent infinite loops
        if (offset > 100000) {
          console.warn(
            "[COMPLAINT-SERVICE] Safety limit reached (100k records), stopping pagination"
          );
          hasMore = false;
        }
      }

      const data = allData;
      // console.log(
      //   `[COMPLAINT-SERVICE] Fetched ${data.length} complaint(s) for heatmap using pagination`
      // );
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      if (data && data.length === 1 && totalWithCoords > 1) {
        console.error(
          "[COMPLAINT-SERVICE] ⚠️ CRITICAL: Query returned only 1 complaint but DB has",
          totalWithCoords
        );
        console.error(
          "[COMPLAINT-SERVICE] This indicates a query/filter issue!"
        );
        console.error("[COMPLAINT-SERVICE] Query filters applied:", {
          statusFilter: status || "none",
          categoryFilter: category || "none",
          departmentFilter: department || "none",
          includeResolved,
        });
      }
      // console.log removed for security
      // Debug: Log first few complaints to see their structure
      if (data && data.length > 0) {
        // console.log removed for security
        // console.log removed for security
        // Check status breakdown of returned data
        const returnedStatusBreakdown = {};
        data.forEach((c) => {
          returnedStatusBreakdown[c.workflow_status] =
            (returnedStatusBreakdown[c.workflow_status] || 0) + 1;
        });
        // console.log removed for security
      } else {
        console.warn("[COMPLAINT-SERVICE] ⚠️ NO DATA RETURNED FROM QUERY!");
      }
      // Debug: Check if query is somehow limited
      if (data && data.length === 1 && totalWithCoords > 1) {
        console.error(
          "[COMPLAINT-SERVICE] ⚠️ CRITICAL: Only 1 complaint returned but",
          totalWithCoords,
          "complaints have coordinates in DB!"
        );
        console.error(
          "[COMPLAINT-SERVICE] This indicates a query/filter issue!"
        );
        console.error(
          "[COMPLAINT-SERVICE] Attempting fallback: Direct query without filters..."
        );
        // Try a direct query as fallback using service role client
        // console.log removed for security
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("complaints")
          .select(
            "id, title, workflow_status, priority, latitude, longitude, location_text, submitted_at, department_r, category, subcategory"
          )
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .limit(100);
        if (
          !fallbackError &&
          fallbackData &&
          fallbackData.length > data.length
        ) {
          console.error(
            "[COMPLAINT-SERVICE] FALLBACK QUERY returned",
            fallbackData.length,
            "complaints!"
          );
          console.error(
            "[COMPLAINT-SERVICE] Using fallback data instead of filtered query result."
          );
          // Use fallback data if it has more results
          return fallbackData
            .map((complaint) => {
              const lat = parseFloat(complaint.latitude);
              const lng = parseFloat(complaint.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;
              return {
                id: complaint.id,
                title: complaint.title,
                status: complaint.workflow_status,
                priority: complaint.priority || "medium",
                lat,
                lng,
                location: complaint.location_text || "",
                submittedAt: complaint.submitted_at,
                department: complaint.department_r?.[0] || "Unknown",
                departments: complaint.department_r || [],
                category: complaint.category,
                subcategory: complaint.subcategory,
              };
            })
            .filter(Boolean);
        }
      }
      // Transform data for heatmap
      // Debug: Log department_r data before transformation
      if (data && data.length > 0) {
        const deptSample = data.slice(0, 3).map((c) => ({
          id: c.id,
          title: c.title,
          department_r: c.department_r,
          dept_r_type: typeof c.department_r,
          dept_r_isArray: Array.isArray(c.department_r),
          dept_r_length: Array.isArray(c.department_r)
            ? c.department_r.length
            : "N/A",
        }));
        console.log(
          "[COMPLAINT-SERVICE] Sample complaints before transformation:",
          deptSample
        );
      }

      const transformedData = data
        .map((complaint) => {
          // Parse coordinates carefully
          const lat = parseFloat(complaint.latitude);
          const lng = parseFloat(complaint.longitude);
          // Skip if coordinates are invalid
          if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
            console.warn(
              "[COMPLAINT-SERVICE] Skipping complaint with invalid coordinates:",
              complaint.id,
              { lat: complaint.latitude, lng: complaint.longitude }
            );
            return null;
          }

          // Ensure department_r is properly handled
          const departmentR = Array.isArray(complaint.department_r)
            ? complaint.department_r
            : complaint.department_r
            ? [complaint.department_r]
            : [];

          return {
            id: complaint.id,
            title: complaint.title,
            status: complaint.workflow_status,
            priority: complaint.priority || "medium",
            lat,
            lng,
            location: complaint.location_text || "",
            submittedAt: complaint.submitted_at,
            department: departmentR.length > 0 ? departmentR[0] : "Unknown",
            departments: departmentR, // Always return as array
            secondaryDepartments:
              departmentR.length > 1 ? departmentR.slice(1) : [],
            type: complaint.category || "General",
            category: complaint.category,
            subcategory: complaint.subcategory,
            // Keep original for debugging
            department_r: departmentR,
          };
        })
        .filter(Boolean); // Remove null entries

      // Debug log removed
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      if (transformedData.length === 0 && totalWithCoords > 0) {
        console.error(
          "[COMPLAINT-SERVICE] ⚠️ ERROR: No valid complaints after transformation, but",
          totalWithCoords,
          "have coordinates in DB!"
        );
      }
      if (transformedData.length === 1 && totalWithCoords > 1) {
        console.warn(
          "[COMPLAINT-SERVICE] ⚠️ WARNING: Only 1 complaint transformed but",
          totalWithCoords,
          "have coordinates in DB!"
        );
        console.warn(
          "[COMPLAINT-SERVICE] This suggests coordinate parsing issues. Check logs above for skipped complaints."
        );
      }
      return transformedData;
    } catch (error) {
      console.error("[COMPLAINT-SERVICE] getComplaintLocations error:", error);
      throw error;
    }
  }
  /**
   * Cancel complaint
   */
  async cancelComplaint(complaintId, userId, reason) {
    try {
      // Get complaint and verify ownership
      const complaint = await this.complaintRepo.getComplaintById(complaintId);
      if (!complaint) {
        throw new Error("Complaint not found");
      }
      if (complaint.submitted_by !== userId) {
        throw new Error("Not authorized to cancel this complaint");
      }
      // Check if complaint can be cancelled
      const cancellableStatuses = ["new", "assigned", "in_progress"];
      if (!cancellableStatuses.includes(complaint.workflow_status)) {
        throw new Error("Complaint cannot be cancelled in its current status");
      }
      // Update complaint status
      const { data: updatedComplaint, error: updateError } =
        await this.complaintRepo.supabase
          .from("complaints")
          .update({
            workflow_status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: userId,
            cancellation_reason: reason,
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", complaintId)
          .select()
          .single();
      if (updateError) {
        console.error(
          "[COMPLAINT-SERVICE] Cancel complaint update error:",
          updateError
        );
        throw new Error(
          `Failed to cancel complaint: ${
            updateError.message || "Database error"
          }`
        );
      }
      if (!updatedComplaint) {
        throw new Error("Complaint not found or could not be updated");
      }
      // Notify relevant parties
      try {
        // Notify coordinator if assigned
        if (complaint.assigned_coordinator_id) {
          await this.notificationService.createNotification(
            complaint.assigned_coordinator_id,
            "complaint_cancelled",
            "Complaint Cancelled",
            `Complaint "${complaint.title}" has been cancelled by the citizen.`,
            {
              priority: "info",
              link: `/coordinator/review-queue`,
              metadata: { complaint_id: complaintId, reason },
            }
          );
        }
        // Notify assigned departments
        const departments = complaint.department_r || [];
        for (const deptCode of departments) {
          try {
            const { data: dept } = await this.complaintRepo.supabase
              .from("departments")
              .select("id")
              .eq("code", deptCode)
              .single();
            if (dept) {
              // Get department admins and notify them
              const { data: assignments } = await this.complaintRepo.supabase
                .from("complaint_assignments")
                .select("assigned_by")
                .eq("complaint_id", complaintId)
                .eq("department_id", dept.id);
              for (const assignment of assignments || []) {
                if (assignment.assigned_by) {
                  await this.notificationService.createNotification(
                    assignment.assigned_by,
                    "complaint_cancelled",
                    "Complaint Cancelled",
                    `Complaint "${complaint.title}" has been cancelled by the citizen.`,
                    {
                      priority: "info",
                      link: `/lgu-admin/department-queue`,
                      metadata: { complaint_id: complaintId, reason },
                    }
                  );
                }
              }
            }
          } catch (deptError) {
            console.warn(
              "[COMPLAINT-SERVICE] Failed to notify department:",
              deptError.message
            );
          }
        }
      } catch (notifError) {
        console.warn(
          "[COMPLAINT-SERVICE] Failed to send cancellation notifications:",
          notifError.message
        );
      }
      return updatedComplaint;
    } catch (error) {
      console.error("[COMPLAINT-SERVICE] Cancel complaint error:", error);
      throw error;
    }
  }
  /**
   * Send reminder for complaint
   */
  async sendReminder(complaintId, userId) {
    try {
      // Get complaint and verify ownership
      const complaint = await this.complaintRepo.getComplaintById(complaintId);
      if (!complaint) {
        throw new Error("Complaint not found");
      }
      if (complaint.submitted_by !== userId) {
        throw new Error("Not authorized to send reminder for this complaint");
      }
      // Check if reminder can be sent (not cancelled, closed, resolved, or pending)
      const reminderBlockedStatuses = ["cancelled", "completed", "pending"];
      if (reminderBlockedStatuses.includes(complaint.workflow_status)) {
        throw new Error("Cannot send reminder for complaint in current status");
      }
      // Check cooldown period (24 hours)
      const { data: lastReminderData, error: reminderQueryError } =
        await this.complaintRepo.supabase
          .from("complaint_reminders")
          .select("reminded_at")
          .eq("complaint_id", complaintId)
          .order("reminded_at", { ascending: false })
          .limit(1);

      // Handle case where no reminders exist (not an error)
      if (reminderQueryError && reminderQueryError.code !== "PGRST116") {
        throw new Error("Failed to check reminder cooldown");
      }

      const lastReminder =
        lastReminderData && lastReminderData.length > 0
          ? lastReminderData[0]
          : null;
      if (lastReminder) {
        const lastReminderTime = new Date(lastReminder.reminded_at);
        const now = new Date();
        const hoursSinceLastReminder =
          (now - lastReminderTime) / (1000 * 60 * 60);

        if (hoursSinceLastReminder < 24) {
          const remainingHours = Math.ceil(24 - hoursSinceLastReminder);
          throw new Error(
            `Please wait ${remainingHours} more hours before sending another reminder`
          );
        }
      }
      // Create reminder record
      const { data: reminder, error: reminderError } =
        await this.complaintRepo.supabase
          .from("complaint_reminders")
          .insert({
            complaint_id: complaintId,
            reminded_by: userId,
            reminder_type: "manual",
            reminded_at: new Date().toISOString(),
          })
          .select()
          .single();
      if (reminderError) {
        throw new Error("Failed to create reminder record");
      }
      // Notify assigned departments/officers
      try {
        const { data: assignments } = await this.complaintRepo.supabase
          .from("complaint_assignments")
          .select("assigned_to, assigned_by, department_id")
          .eq("complaint_id", complaintId);
        for (const assignment of assignments || []) {
          // Notify assigned officer
          if (assignment.assigned_to) {
            await this.notificationService.createNotification(
              assignment.assigned_to,
              "complaint_reminder",
              "Complaint Reminder",
              `Citizen has sent a reminder for complaint: "${complaint.title}"`,
              {
                priority: "warning",
                link: `/lgu-officer/tasks/${complaintId}`,
                metadata: { complaint_id: complaintId },
              }
            );
          }
          // Notify department admin
          if (assignment.assigned_by) {
            await this.notificationService.createNotification(
              assignment.assigned_by,
              "complaint_reminder",
              "Complaint Reminder",
              `Citizen has sent a reminder for complaint: "${complaint.title}"`,
              {
                priority: "warning",
                link: `/lgu-admin/department-queue`,
                metadata: { complaint_id: complaintId },
              }
            );
          }
        }
      } catch (notifError) {
        console.warn(
          "[COMPLAINT-SERVICE] Failed to send reminder notifications:",
          notifError.message
        );
      }
      return reminder;
    } catch (error) {
      console.error("[COMPLAINT-SERVICE] Send reminder error:", error);
      throw error;
    }
  }
  /**
   * Get all false complaints
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} List of false complaints
   */
  async getFalseComplaints(filters = {}) {
    try {
      const Database = require("../config/database");

      const supabase = Database.getClient();
      let query = supabase
        .from("complaints")
        .select("*")
        .eq("is_false_complaint", true)
        .order("false_complaint_marked_at", { ascending: false });
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      const { data, error } = await query;
      if (error) throw error;
      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error("Error getting false complaints:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get false complaint statistics
   * @returns {Promise<Object>} Statistics about false complaints
   */
  async getFalseComplaintStatistics() {
    try {
      const Database = require("../config/database");
      const supabase = Database.getClient();

      // Get total count of false complaints
      const { count: total, error: countError } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("is_false_complaint", true);

      if (countError) throw countError;

      // Get recent false complaints (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recent, error: recentError } = await supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("is_false_complaint", true)
        .gte("false_complaint_marked_at", thirtyDaysAgo.toISOString());

      if (recentError) throw recentError;

      return {
        success: true,
        data: {
          total: total || 0,
          recent: recent || 0,
        },
      };
    } catch (error) {
      console.error(
        "[COMPLAINT_SERVICE] Error getting false complaint stats:",
        error
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }
  /**
   * Get complaint evidence files from Supabase storage
   * @param {string} complaintId - Complaint ID
   * @param {Object} user - User object requesting the evidence
   * @returns {Promise<Array>} Array of evidence files with signed URLs
   */
  async getComplaintEvidence(complaintId, user) {
    try {
      const Database = require("../config/database");

      const supabase = Database.getClient();
      // console.log removed for security
      // First, verify the user has access to this complaint
      // console.log removed for security
      const { data: complaint, error: complaintError } = await supabase
        .from("complaints")
        .select("id, submitted_by, department_r, assigned_coordinator_id")
        .eq("id", complaintId)
        .single();
      // console.log removed for security
      if (complaintError || !complaint) {
        console.error(
          `[COMPLAINT_SERVICE] Complaint not found:`,
          complaintError
        );
        // Return empty array instead of throwing error - complaint might have been deleted
        // console.log removed for security
        return [];
      }
      // Basic access control without external helpers
      const role = (user?.role || "").toLowerCase();
      const isCitizenOwner =
        role === "citizen" && complaint.submitted_by === user?.id;
      const isStaff = [
        "lgu",
        "lgu-officer",
        "lgu-admin",
        "hr",
        "complaint-coordinator",
        "coordinator",
        "super-admin",
      ].some((r) => role.includes(r));
      if (!isCitizenOwner && !isStaff) {
        // Return empty list instead of error to avoid breaking the UI
        return [];
      }
      // Get evidence metadata from database to distinguish between types
      const { data: _evidenceMetadata, error: metadataError } = await supabase
        .from("complaint_evidence")
        .select("*")
        .eq("complaint_id", complaintId)
        .order("uploaded_at", { ascending: false });
      if (metadataError) {
        console.warn(
          "[COMPLAINT_SERVICE] Error fetching evidence metadata:",
          metadataError
        );
      }
      // List files in the complaint-evidence bucket for this complaint
      const bucketName = "complaint-evidence";
      // Get initial evidence files
      const initialFolderPath = `${complaintId}/evidence/`;
      const { data: initialFiles } = await supabase.storage
        .from(bucketName)
        .list(initialFolderPath);
      // Get completion evidence files
      const completionFolderPath = `${complaintId}/completion/`;
      const { data: completionFiles } = await supabase.storage
        .from(bucketName)
        .list(completionFolderPath);
      const allFiles = [];
      // Process initial evidence
      if (initialFiles && initialFiles.length > 0) {
        for (const file of initialFiles) {
          const filePath = `${initialFolderPath}${file.name}`;
          const { data: signedUrl } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, 3600);
          if (signedUrl) {
            allFiles.push({
              name: file.name,
              size: file.metadata?.size || 0,
              url: signedUrl.signedUrl,
              path: filePath,
              type: "initial",
              lastModified: file.updated_at || file.created_at,
            });
          }
        }
      }
      // Process completion evidence
      if (completionFiles && completionFiles.length > 0) {
        for (const file of completionFiles) {
          const filePath = `${completionFolderPath}${file.name}`;
          const { data: signedUrl } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, 3600);
          if (signedUrl) {
            allFiles.push({
              name: file.name,
              size: file.metadata?.size || 0,
              url: signedUrl.signedUrl,
              path: filePath,
              type: "completion",
              lastModified: file.updated_at || file.created_at,
            });
          }
        }
      }
      return allFiles;
    } catch (error) {
      console.error(
        "[COMPLAINT_SERVICE] Error getting complaint evidence:",
        error
      );
      throw error;
    }
  }
  /**
   * Confirm resolution (Citizen side)
   * @param {string} complaintId - Complaint ID
   * @param {string} citizenId - Citizen user ID
   * @param {boolean} confirmed - Whether citizen confirms the resolution
   * @param {string} feedback - Optional feedback from citizen
   * @returns {Promise<Object>} Result of confirmation
   */
  async confirmResolution(complaintId, citizenId, confirmed, _feedback = null) {
    try {
      // Use repository client (service-role) to avoid RLS issues
      const { supabase } = this.complaintRepo;

      // Update the complaint with citizen's confirmation directly
      // TODO: Re-enable table update when schema supports confirmed_by_citizen, citizen_confirmation_date, etc.
      // Currently bypassing table update and relying on RPC because columns might be missing or RLS issues.
      /*
      const updateData = {
        // confirmed_by_citizen: confirmed,
        // citizen_confirmation_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (confirmed) {
        updateData.workflow_status = 'completed';
        updateData.resolved_at = new Date().toISOString();
        updateData.last_activity_at = new Date().toISOString();
      }

      const { data: updatedComplaint, error: updateError } = await supabase
        .from('complaints')
        .update(updateData)
        .eq('id', complaintId)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedComplaint) throw new Error('Complaint not found or access denied');
      if (updatedComplaint.submitted_by !== citizenId) throw new Error('Access denied');
      */

      // Bypass table update for now
      const updatedComplaint = {
        id: complaintId,
        confirmed_by_citizen: confirmed,
      };

      // Call the database function to update confirmation status
      const { data: _statusResult, error: statusError } = await supabase.rpc(
        "update_complaint_confirmation_status",
        {
          complaint_uuid: complaintId,
        }
      );
      if (statusError) {
        console.warn(
          "[COMPLAINT_SERVICE] Error updating confirmation status:",
          statusError
        );
      }
      // Ensure final workflow reconciliation when confirmed
      if (confirmed) {
        try {
          await this.reconcileWorkflowStatus(complaintId);
        } catch (_) {}
      }
      return {
        success: true,
        data: updatedComplaint,
        message: confirmed
          ? "Resolution confirmed successfully"
          : "Resolution feedback recorded",
      };
    } catch (error) {
      console.error("[COMPLAINT_SERVICE] Error confirming resolution:", error);
      throw error;
    }
  }
  async createAssignment(complaintId, officerIds, assignedBy) {
    try {
      // Validate complaint exists
      const _complaint = await this.getComplaintById(complaintId);
      // Create assignment records using the repository method
      const assignments = await this.complaintRepo.createAssignments(
        complaintId,
        officerIds,
        assignedBy
      );
      // Update complaint status
      await this.updateComplaintStatus(complaintId, "assigned to officer");
      return assignments;
    } catch (error) {
      console.error("[COMPLAINT-SERVICE] Error creating assignment:", error);
      throw error;
    }
  }
  /**
   * Get confirmation message for a complaint based on confirmation status and user role
   * @param {string} complaintId - Complaint ID
   * @param {string} userRole - User role (citizen, lgu-admin, lgu-officer, complaint-coordinator, etc.)
   * @returns {Promise<string>} Confirmation message
   */
  async getConfirmationMessage(complaintId, userRole) {
    try {
      const complaint = await this.complaintRepo.findById(complaintId);
      if (!complaint) {
        throw new Error("Complaint not found");
      }

      const confirmationStatus = (
        complaint.confirmation_status || "pending"
      ).toLowerCase();
      const workflowStatus = (complaint.workflow_status || "new").toLowerCase();
      const isCitizen = userRole === "citizen";
      const confirmedByCitizen = complaint.confirmed_by_citizen || false;
      const allRespondersConfirmed =
        complaint.all_responders_confirmed || false;

      // Determine message based on confirmation status and role
      switch (confirmationStatus) {
        case "waiting_for_complainant":
          if (isCitizen) {
            return "Please confirm if the resolution meets your expectations. Your confirmation is required to complete this complaint.";
          }
          return "Waiting for complainant's confirmation. The citizen needs to review and confirm the resolution.";

        case "waiting_for_responders":
          if (isCitizen) {
            return "Waiting for responders' confirmation. Officers are reviewing the resolution.";
          }
          return "Please confirm the resolution. Officers need to confirm that the complaint has been resolved.";

        case "confirmed":
          if (isCitizen) {
            return "Resolution confirmed. This complaint has been successfully resolved and confirmed by all parties.";
          }
          return "Resolution confirmed by all parties. This complaint is now complete.";

        case "disputed":
          if (isCitizen) {
            return "Resolution disputed. The complaint resolution has been disputed and may require further review.";
          }
          return "Resolution disputed by complainant. The complaint may require additional action or review.";

        case "pending":
        default:
          // For pending status, provide context based on workflow status
          if (
            workflowStatus === "completed" ||
            workflowStatus === "pending_approval"
          ) {
            if (isCitizen && !confirmedByCitizen) {
              return "Waiting for your confirmation. Please review the resolution and confirm if it meets your expectations.";
            } else if (!isCitizen && !allRespondersConfirmed) {
              return "Waiting for responders' confirmation. Officers need to confirm the resolution.";
            }
            return "Resolution pending confirmation from all parties.";
          } else if (
            workflowStatus === "in_progress" ||
            workflowStatus === "assigned"
          ) {
            return "Complaint is being processed. Confirmation will be required once the resolution is complete.";
          }
          return "Complaint is pending review and assignment.";
      }
    } catch (error) {
      console.error(
        "[COMPLAINT_SERVICE] Error getting confirmation message:",
        error
      );
      // Return a default message instead of throwing
      return "Unable to load confirmation status.";
    }
  }
  /**
   * Mark a complaint as false
   * @param {string} complaintId - Complaint ID
   * @param {string} userId - User ID marking the complaint
   * @param {string} reason - Reason for marking as false
   * @returns {Promise<Object>} Result
   */
  async markAsFalseComplaint(complaintId, userId, reason) {
    try {
      const complaint = await this.complaintRepo.getComplaintById(complaintId);
      if (!complaint) {
        throw new Error("Complaint not found");
      }

      const { data: updatedComplaint, error: updateError } =
        await this.complaintRepo.supabase
          .from("complaints")
          .update({
            is_false_complaint: true,
            false_complaint_reason: reason,
            workflow_status: "rejected",
            marked_false_by: userId,
            false_complaint_marked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", complaintId)
          .select()
          .single();

      if (updateError) throw updateError;

      // Log action
      try {
        await this.complaintRepo.logAction(complaintId, "marked_false", {
          reason,
          details: { marked_by: userId },
        });
      } catch (logError) {
        console.warn("[AUDIT] Log action failed:", logError.message);
      }

      return {
        success: true,
        data: updatedComplaint,
        message: "Complaint marked as false successfully",
      };
    } catch (error) {
      console.error("[COMPLAINT_SERVICE] Error marking as false:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mark a complaint as duplicate
   * @param {string} complaintId - Complaint ID
   * @param {string} masterComplaintId - Master Complaint ID
   * @param {string} userId - User ID marking the duplicate
   * @returns {Promise<Object>} Result
   */
  async markAsDuplicate(complaintId, masterComplaintId, userId) {
    try {
      const complaint = await this.complaintRepo.getComplaintById(complaintId);
      if (!complaint) {
        throw new Error("Complaint not found");
      }

      const masterComplaint = await this.complaintRepo.getComplaintById(
        masterComplaintId
      );
      if (!masterComplaint) {
        throw new Error("Master complaint not found");
      }

      const { data: updatedComplaint, error: updateError } =
        await this.complaintRepo.supabase
          .from("complaints")
          .update({
            is_duplicate: true,
            master_complaint_id: masterComplaintId,
            workflow_status: "closed", // Or 'rejected'/'duplicate' if available
            duplicate_marked_by: userId,
            duplicate_marked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", complaintId)
          .select()
          .single();

      if (updateError) throw updateError;

      // Log action
      try {
        await this.complaintRepo.logAction(complaintId, "marked_duplicate", {
          reason: `Duplicate of ${masterComplaintId}`,
          details: { marked_by: userId, master_id: masterComplaintId },
        });
      } catch (logError) {
        console.warn("[AUDIT] Log action failed:", logError.message);
      }

      return {
        success: true,
        data: updatedComplaint,
        message: "Complaint marked as duplicate successfully",
      };
    } catch (error) {
      console.error("[COMPLAINT_SERVICE] Error marking as duplicate:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = ComplaintService;
