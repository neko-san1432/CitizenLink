const ComplaintRepository = require("../repositories/ComplaintRepository");
const ComplaintAssignmentRepository = require("../repositories/ComplaintAssignmentRepository");
const ComplaintHistoryRepository = require("../repositories/ComplaintHistoryRepository");
const NotificationService = require("./NotificationService");
const Database = require("../config/database");
const { getTimelineStepKey } = require("../utils/complaintUtils");

/**
 * LGU Officer Service
 * Handles business logic for LGU officer operations
 */
class LguOfficerService {
  constructor() {
    this.complaintRepo = new ComplaintRepository();
    this.assignmentRepo = new ComplaintAssignmentRepository();
    this.historyRepo = new ComplaintHistoryRepository();
    this.notificationService = new NotificationService();
    this.supabase = Database.getClient();
  }

  /**
   * Get assigned tasks for an officer
   */
  async getAssignedTasks(officerId, filters = {}) {
    const { status, priority, limit, department } = filters;

    // DIRECT VISIBILITY MODE: If department is provided, fetch all complaints for the department
    if (department) {
      // Use findAll from repo which supports department filtering
      // Note: findAll returns { complaints, total, ... }
      const result = await this.complaintRepo.findAll({
        department,
        status,
        limit: limit || 50, // Default limit if not specified
        page: 1
      });

      const complaints = result.complaints || [];

      // Map complaints to "Task" structure for frontend compatibility
      return complaints.map(complaint => {
        return {
          id: `direct-${complaint.id}`, // specific ID for direct tasks
          complaint_id: complaint.id,
          assigned_by: null, // System / Direct
          status: complaint.workflow_status === "new" ? "assigned" : (complaint.workflow_status || "assigned"), // Map 'new' to 'assigned' for officer view
          notes: null,
          priority: complaint.priority,
          deadline: null,
          assigned_at: complaint.submitted_at, // Use submission time as assignment time
          created_at: complaint.submitted_at,
          updated_at: complaint.updated_at,
          completed_at: complaint.resolved_at,
          complaint: {
            id: complaint.id,
            title: complaint.descriptive_su?.slice(0, 100) || "complaint Details",
            description: complaint.descriptive_su,
            category: complaint.category,
            subcategory: complaint.subcategory,
            status: complaint.workflow_status, // Use accurate workflow status
            priority: complaint.priority,
            submitted_at: complaint.submitted_at,
            location_text: complaint.location_text,
            latitude: complaint.latitude,
            longitude: complaint.longitude,
            last_activity_at: complaint.last_activity_at
          }
        };
      });
    }

    // LEGACY / ASSIGNMENT MODE: Get specific assignments
    const assignments = await this.assignmentRepo.findByOfficer(officerId, { status, priority, limit });

    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Get complaint details (include coordinates for barangay classification)
    const complaintIds = assignments.map(a => a.complaint_id);
    const complaints = await this.complaintRepo.findByIds(
      complaintIds,
      "id, descriptive_su, category, subcategory, status, priority, submitted_at, location_text, latitude, longitude, last_activity_at"
    );

    // Deduplicate assignments by complaint_id (keep the most recent one)
    const uniqueAssignments = assignments.reduce((acc, assignment) => {
      const existing = acc.find(a => a.complaint_id === assignment.complaint_id);
      if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
        const filtered = acc.filter(a => a.complaint_id !== assignment.complaint_id);
        return [...filtered, assignment];
      }
      return acc;
    }, []);

    // Combine assignments with complaint data
    return uniqueAssignments.map(assignment => {
      const complaint = complaints.find(c => c.id === assignment.complaint_id);
      return {
        id: assignment.id,
        complaint_id: assignment.complaint_id,
        assigned_by: assignment.assigned_by,
        status: assignment.status,
        notes: assignment.notes,
        priority: assignment.priority,
        deadline: assignment.deadline,
        assigned_at: assignment.created_at,
        created_at: assignment.created_at,
        updated_at: assignment.updated_at,
        completed_at: assignment.completed_at,
        complaint: complaint ? {
          id: complaint.id,
          title: complaint.descriptive_su?.slice(0, 100) || "complaint Details",
          description: complaint.descriptive_su,
          category: complaint.category,
          subcategory: complaint.subcategory,
          status: complaint.status,
          priority: complaint.priority,
          submitted_at: complaint.submitted_at,
          location_text: complaint.location_text,
          latitude: complaint.latitude,
          longitude: complaint.longitude,
          last_activity_at: complaint.last_activity_at
        } : {
          id: assignment.complaint_id,
          title: "complaint Details Not Available",
          description: "Details could not be loaded",
          category: "General",
          subcategory: "unknown",
          status: "unknown",
          priority: "medium",
          submitted_at: assignment.created_at,
          location_text: "Location not available",
          last_activity_at: assignment.updated_at
        }
      };
    });
  }

  /**
   * Get tasks with assigned_by user info
   */
  async getMyTasks(officerId) {
    const assignments = await this.assignmentRepo.findByOfficer(officerId);

    if (!assignments || assignments.length === 0) {
      return [];
    }

    const complaintIds = assignments.map(a => a.complaint_id);
    const complaints = await this.complaintRepo.findByIds(
      complaintIds,
      "id, descriptive_su, category, subcategory, status, submitted_at, location_text, last_activity_at"
    );

    // Deduplicate assignments
    const uniqueAssignments = assignments.reduce((acc, assignment) => {
      const existing = acc.find(a => a.complaint_id === assignment.complaint_id);
      if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
        const filtered = acc.filter(a => a.complaint_id !== assignment.complaint_id);
        return [...filtered, assignment];
      }
      return acc;
    }, []);

    // Get assigned_by user info
    const assignmentsWithUsers = await Promise.all(
      uniqueAssignments.map(async (assignment) => {
        let assignedByName = "Unknown";
        if (assignment.assigned_by) {
          try {
            const { data: assignedByUser } = await this.supabase.auth.admin.getUserById(assignment.assigned_by);
            if (assignedByUser?.user) {
              assignedByName = assignedByUser.user.user_metadata?.name || assignedByUser.user.email;
            }
          } catch (err) {
            console.warn("[LGU_OFFICER_SERVICE] Failed to get assigned_by user:", err.message);
          }
        }

        const complaint = complaints.find(c => c.id === assignment.complaint_id);
        return {
          id: assignment.id,
          complaint_id: assignment.complaint_id,
          assigned_by: assignment.assigned_by,
          assigned_by_name: assignedByName,
          status: assignment.status,
          notes: assignment.notes,
          priority: assignment.priority || "medium",
          deadline: assignment.deadline,
          assigned_at: assignment.created_at,
          created_at: assignment.created_at,
          updated_at: assignment.updated_at,
          completed_at: assignment.completed_at,
          complaint: complaint ? {
            id: complaint.id,
            title: complaint.descriptive_su?.slice(0, 100) || "complaint Details",
            description: complaint.descriptive_su,
            category: complaint.category,
            subcategory: complaint.subcategory,
            status: complaint.status,
            submitted_at: complaint.submitted_at,
            location_text: complaint.location_text,
            last_activity_at: complaint.last_activity_at
          } : {
            id: assignment.complaint_id,
            title: "complaint Details Not Available",
            description: "Details could not be loaded",
            category: "General",
            subcategory: "unknown",
            status: "unknown",
            submitted_at: assignment.created_at,
            location_text: "Location not available",
            last_activity_at: assignment.updated_at
          }
        };
      })
    );

    return assignmentsWithUsers;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(assignmentId, officerId, status, notes = null) {
    // Verify assignment belongs to officer
    const assignment = await this.assignmentRepo.findByIdAndOfficer(assignmentId, officerId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Prepare update data
    const updateData = { status };
    if (notes) {
      updateData.notes = notes;
    }
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    // Update assignment
    await this.assignmentRepo.update(assignmentId, updateData);

    // Update complaint confirmation status using database function
    await this.supabase.rpc("update_complaint_confirmation_status", {
      complaint_uuid: assignment.complaint_id
    });

    // Send notification to admin
    if (assignment.assigned_by) {
      await this.notificationService.createNotification(
        assignment.assigned_by,
        "task_update",
        "Task Status Updated",
        `Officer updated task status to "${status}" for complaint ${assignment.complaint_id}`,
        {
          priority: "info",
          link: "/assignments",
          metadata: {
            assignment_id: assignmentId,
            complaint_id: assignment.complaint_id,
            new_status: status
          }
        }
      );
    }

    return { success: true, assignment };
  }

  /**
   * Add progress update to a task
   */
  async addProgressUpdate(assignmentId, officerId, message, isPublic = false) {
    // Verify assignment belongs to officer
    const assignment = await this.assignmentRepo.findByIdAndOfficer(assignmentId, officerId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Add to complaint history
    await this.historyRepo.addEntry(
      assignment.complaint_id,
      "officer_update",
      officerId,
      JSON.stringify({
        message,
        is_public: isPublic,
        assignment_id: assignmentId
      })
    );

    // If public, notify the citizen
    if (isPublic) {
      const complaint = await this.complaintRepo.findById(assignment.complaint_id);
      if (complaint && complaint.submitted_by) {
        await this.notificationService.createNotification(
          complaint.submitted_by,
          "officer_update",
          "Update on Your complaint",
          `Officer added an update: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}"`,
          {
            priority: "info",
            link: `/complaint/${assignment.complaint_id}`,
            metadata: {
              complaint_id: assignment.complaint_id,
              assignment_id: assignmentId
            }
          }
        );
      }
    }

    return { success: true };
  }

  /**
   * Mark complaint as resolved
   */
  async markAsResolved(complaintId, officerId, resolutionNotes) {
    if (!resolutionNotes) {
      throw new Error("Resolution notes are required");
    }

    // [TIMELINE] Update comment JSON for resolution phase
    const complaint = await this.complaintRepo.findById(complaintId);
    const currentComment = complaint.comment || {};
    currentComment["resolved"] = {
      date: new Date().toISOString(),
      comment: resolutionNotes,
      user_id: officerId
    };

    // Update complaint status
    const updatedcomplaint = await this.complaintRepo.update(complaintId, {
      status: "resolved by officer",
      workflow_status: "action_taken", // Matches steps: action_taken
      comment: currentComment,
      resolution_notes: resolutionNotes,
      resolved_by: officerId,
      resolved_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    });

    // Update assignment status - find assignment by complaint_id and officer
    const assignments = await this.assignmentRepo.findByOfficer(officerId);
    const assignment = assignments.find(a => a.complaint_id === complaintId);
    if (assignment) {
      await this.assignmentRepo.update(assignment.id, {
        status: "completed",
        completed_at: new Date().toISOString()
      });
    }

    // Notify citizen for confirmation
    try {
      await this.notificationService.createNotification(
        updatedcomplaint.submitted_by,
        "complaint_resolved",
        "complaint Resolved",
        `Your complaint "${updatedcomplaint.descriptive_su?.slice(0, 100) || "your complaint"}" has been resolved. Please confirm if you're satisfied with the resolution.`,
        {
          priority: "success",
          link: `/citizen/complaints/${complaintId}`,
          metadata: {
            complaint_id: complaintId,
            resolution_notes: resolutionNotes,
            resolved_by: officerId
          }
        }
      );
    } catch (notifError) {
      console.warn("[LGU_OFFICER_SERVICE] Failed to notify citizen:", notifError.message);
    }

    return updatedcomplaint;
  }

  /**
   * Get officer statistics
   */
  async getStatistics(officerId) {
    const assignments = await this.assignmentRepo.findByOfficer(officerId);

    // Deduplicate assignments by complaint_id
    const uniqueAssignments = assignments.reduce((acc, assignment) => {
      const existing = acc.find(a => a.complaint_id === assignment.complaint_id);
      if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
        const filtered = acc.filter(a => a.complaint_id !== assignment.complaint_id);
        return [...filtered, assignment];
      }
      return acc;
    }, []);

    const totalTasks = uniqueAssignments.length;
    const pendingTasks = uniqueAssignments.filter(a => ["assigned", "in_progress"].includes(a.status)).length;
    const completedTasks = uniqueAssignments.filter(a => a.status === "completed").length;
    const inProgressTasks = uniqueAssignments.filter(a => a.status === "in_progress").length;
    const efficiencyRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      total_tasks: totalTasks,
      pending_tasks: pendingTasks,
      in_progress_tasks: inProgressTasks,
      completed_tasks: completedTasks,
      efficiency_rate: `${efficiencyRate}%`
    };
  }

  /**
   * Get officer activities
   */
  async getActivities(officerId, limit = 10) {
    try {
      const activities = await this.assignmentRepo.getActivitiesByOfficer(officerId, limit);

      // Deduplicate activities by complaint_id
      const uniqueActivities = activities.reduce((acc, activity) => {
        const existing = acc.find(a => a.complaint_id === activity.complaint_id);
        if (!existing || new Date(activity.updated_at || activity.created_at) > new Date(existing.updated_at || existing.created_at)) {
          const filtered = acc.filter(a => a.complaint_id !== activity.complaint_id);
          return [...filtered, activity];
        }
        return acc;
      }, []);

      return uniqueActivities.map(activity => ({
        id: activity.id,
        type: this._getActivityType(activity),
        description: this._getActivityDescription(activity, activity.complaints),
        created_at: activity.updated_at || activity.created_at
      }));
    } catch (error) {
      // Fallback: get activities without joins
      const assignments = await this.assignmentRepo.findByOfficer(officerId, { limit });
      const uniqueAssignments = assignments.reduce((acc, activity) => {
        const existing = acc.find(a => a.complaint_id === activity.complaint_id);
        if (!existing || new Date(activity.updated_at || activity.created_at) > new Date(existing.updated_at || existing.created_at)) {
          const filtered = acc.filter(a => a.complaint_id !== activity.complaint_id);
          return [...filtered, activity];
        }
        return acc;
      }, []);

      return uniqueAssignments.map(activity => ({
        id: activity.id,
        type: this._getActivityType(activity),
        description: this._getActivityDescription(activity),
        created_at: activity.updated_at || activity.created_at
      }));
    }
  }

  /**
   * Get department updates (placeholder for future implementation)
   */
  async getUpdates(officerId, _limit = 10) {
    // Placeholder - department updates will be implemented later
    return [];
  }

  /**
   * Update complaint status and add comment
   */
  async updatecomplaintStatus(complaintId, officerId, status, comment) {
    // 1. Prepare data
    const updateData = {
      date: new Date().toISOString(),
      comment
    };

    // 2. [TIMELINE] Map status to timeline step key
    const stepKey = getTimelineStepKey(status) || status;

    // 3. Update via Repo
    const updatedcomplaint = await this.complaintRepo.updateStatusAndComment(
      complaintId,
      stepKey, // Use stepKey as the mapping key
      updateData,
      status // Pass raw status to update workflow_status
    );

    // 3. Create Notification
    // Notify citizen if relevant
    if (updatedcomplaint.submitted_by) {
      try {
        if (comment) {
          await this.notificationService.notifycomplaintUpdate(
            updatedcomplaint.submitted_by,
            complaintId,
            updatedcomplaint.descriptive_su?.slice(0, 100) || "Your complaint",
            comment
          );
        } else {
          await this.notificationService.notifycomplaintStatusChanged(
            updatedcomplaint.submitted_by,
            complaintId,
            updatedcomplaint.descriptive_su?.slice(0, 100) || "Your complaint",
            status,
            "previous" // Placeholder if old status not easily available here
          );
        }
      } catch (err) {
        console.warn("Failed to notify citizen:", err);
      }
    }

    return updatedcomplaint;
  }

  // Helper methods
  _getActivityType(activity) {
    if (activity.completed_at) return "task_completed";
    if (activity.status === "in_progress") return "task_started";
    if (activity.status === "assigned") return "task_assigned";
    if (activity.notes) return "note_added";
    return "task_update";
  }

  _getActivityDescription(activity, complaint = null) {
    const complaintTitle = complaint?.descriptive_su?.slice(0, 100) || `complaint #${activity.complaint_id?.substring(0, 8)}`;
    const complaintCategory = complaint?.category || "General";
    switch (this._getActivityType(activity)) {
      case "task_completed":
        return `Completed task: "${complaintTitle}" (${complaintCategory})`;
      case "task_started":
        return `Started working on: "${complaintTitle}" (${complaintCategory})`;
      case "task_assigned":
        return `New task assigned: "${complaintTitle}" (${complaintCategory})`;
      case "note_added":
        return `Added note to: "${complaintTitle}" (${complaintCategory})`;
      default:
        return `Updated task: "${complaintTitle}" - Status: ${activity.status}`;
    }
  }
}

module.exports = LguOfficerService;

