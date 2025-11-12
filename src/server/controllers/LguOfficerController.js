const Database = require('../config/database');
const NotificationService = require('../services/NotificationService');

const db = new Database();
const supabase = db.getClient();
const notificationService = new NotificationService();
class LguOfficerController {
  /**
   * Get assigned tasks for officer
   */
  async getAssignedTasks(req, res) {
    try {
      const userId = req.user.id;
      const { status, priority, limit } = req.query;
      // Get assignments for this officer (using separate queries to avoid relationship issues)
      let assignmentQuery = supabase
        .from('complaint_assignments')
        .select('id, complaint_id, assigned_to, assigned_by, status, priority, assignment_type, assignment_group_id, officer_order, created_at, updated_at')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });
      // Apply filters
      if (status) {
        assignmentQuery = assignmentQuery.eq('status', status);
      }
      if (priority) {
        assignmentQuery = assignmentQuery.eq('priority', priority);
      }
      if (limit) {
        assignmentQuery = assignmentQuery.limit(parseInt(limit));
      }
      const { data: assignments, error: assignmentError } = await assignmentQuery;
      // console.log removed for security
      if (assignmentError) {
        console.error('[LGU_OFFICER] Error fetching assignments:', assignmentError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch assignments'
        });
      }
      if (!assignments || assignments.length === 0) {
        // console.log removed for security
        return res.json({
          success: true,
          data: []
        });
      }
      // Get complaint details for each assignment
      const complaintIds = assignments.map(a => a.complaint_id);
      // console.log removed for security
      const { data: complaints, error: complaintError } = await supabase
        .from('complaints')
        .select('id, title, descriptive_su, category, subcategory, status, priority, submitted_at, location_text, last_activity_at')
        .in('id', complaintIds);
      // console.log removed for security
      if (complaintError) {
        console.error('[LGU_OFFICER] Error fetching complaints:', complaintError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch complaint details'
        });
      }
      // Deduplicate assignments by complaint_id (keep the most recent one)
      const uniqueAssignments = assignments.reduce((acc, assignment) => {
        const existing = acc.find(a => a.complaint_id === assignment.complaint_id);
        if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
          // Remove existing if it exists and add new one
          const filtered = acc.filter(a => a.complaint_id !== assignment.complaint_id);
          return [...filtered, assignment];
        }
        return acc;
      }, []);
      // console.log removed for security
      // Combine assignments with complaint data
      const combinedData = uniqueAssignments.map(assignment => {
        const complaint = complaints?.find(c => c.id === assignment.complaint_id);
        return {
          id: assignment.id,
          complaint_id: assignment.complaint_id,
          assigned_by: assignment.assigned_by,
          status: assignment.status,
          notes: assignment.notes,
          priority: assignment.priority,
          deadline: assignment.deadline,
          assigned_at: assignment.created_at, // Map created_at to assigned_at for frontend
          created_at: assignment.created_at,
          updated_at: assignment.updated_at,
          completed_at: assignment.completed_at,
          complaint: complaint ? {
            id: complaint.id,
            title: complaint.title,
            description: complaint.descriptive_su, // Map descriptive_su to description for frontend
            category: complaint.category,
            subcategory: complaint.subcategory,
            status: complaint.status,
            priority: complaint.priority,
            submitted_at: complaint.submitted_at,
            location_text: complaint.location_text,
            last_activity_at: complaint.last_activity_at
          } : {
            id: assignment.complaint_id,
            title: 'Complaint Details Not Available',
            description: 'Details could not be loaded',
            category: 'General',
            subcategory: 'unknown',
            status: 'unknown',
            priority: 'medium',
            submitted_at: assignment.created_at,
            location_text: 'Location not available',
            last_activity_at: assignment.updated_at
          }
        };
      });
      return res.json({
        success: true,
        data: combinedData
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get assigned tasks error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assigned tasks'
      });
    }
  }
  /**
   * Mark complaint as resolved
   */
  async markAsResolved(req, res) {
    try {
      const { complaintId } = req.params;
      const { resolution_notes } = req.body; // evidence field removed
      const userId = req.user.id;
      if (!resolution_notes) {
        return res.status(400).json({
          success: false,
          error: 'Resolution notes are required'
        });
      }
      // Update complaint status
      const { data: updatedComplaint, error: updateError } = await supabase
        .from('complaints')
        .update({
          status: 'resolved by officer',
          workflow_status: 'pending_approval',
          resolution_notes,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();
      if (updateError) {
        console.error('[LGU_OFFICER] Error updating complaint:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update complaint status'
        });
      }
      // Update assignment status
      const { error: assignmentError } = await supabase
        .from('complaint_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('complaint_id', complaintId)
        .eq('assigned_to', userId);
      if (assignmentError) {
        console.error('[LGU_OFFICER] Error updating assignment:', assignmentError);
        // Don't fail the request, just log the error
      }

      // Notify citizen for confirmation
      try {
        await notificationService.createNotification(
          updatedComplaint.submitted_by,
          'complaint_resolved',
          'Complaint Resolved',
          `Your complaint "${updatedComplaint.title}" has been resolved. Please confirm if you're satisfied with the resolution.`,
          {
            priority: 'success',
            link: `/citizen/complaints/${complaintId}`,
            metadata: {
              complaint_id: complaintId,
              resolution_notes,
              resolved_by: userId
            }
          }
        );
      } catch (notifError) {
        console.warn('[LGU_OFFICER] Failed to notify citizen:', notifError.message);
      }
      res.json({
        success: true,
        message: 'Complaint marked as resolved successfully',
        complaint: updatedComplaint
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Mark as resolved error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark complaint as resolved'
      });
    }
  }
  /**
   * Get all tasks assigned to the current officer
   */
  async getMyTasks(req, res) {
    try {
      const userId = req.user.id;
      // Get all assignments for this officer (using separate queries to avoid relationship issues)
      const { data: assignments, error: assignmentError } = await supabase
        .from('complaint_assignments')
        .select('id, complaint_id, assigned_by, status, notes, priority, deadline, created_at, updated_at, completed_at')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });
      if (assignmentError) {
        console.error('[LGU_OFFICER] Error fetching assignments:', assignmentError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch assignments'
        });
      }
      if (!assignments || assignments.length === 0) {
        // console.log removed for security
        return res.json({
          success: true,
          data: []
        });
      }
      // console.log removed for security
      // Get complaint details for each assignment
      const complaintIds = assignments.map(a => a.complaint_id);
      // console.log removed for security
      const { data: complaints, error: complaintError } = await supabase
        .from('complaints')
        .select('id, title, descriptive_su, category, subcategory, status, submitted_at, location_text, last_activity_at')
        .in('id', complaintIds);
      // console.log removed for security
      if (complaintError) {
        console.error('[LGU_OFFICER] Error fetching complaints:', complaintError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch complaint details'
        });
      }
      // Deduplicate assignments by complaint_id (keep the most recent one)
      const uniqueAssignments = assignments.reduce((acc, assignment) => {
        const existing = acc.find(a => a.complaint_id === assignment.complaint_id);
        if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
          // Remove existing if it exists and add new one
          const filtered = acc.filter(a => a.complaint_id !== assignment.complaint_id);
          return [...filtered, assignment];
        }
        return acc;
      }, []);
      // console.log removed for security
      // Get assigned_by user info for each assignment
      const assignmentsWithUsers = await Promise.all(
        uniqueAssignments.map(async (assignment) => {
          let assignedByName = 'Unknown';
          if (assignment.assigned_by) {
            const { data: assignedByUser } = await supabase.auth.admin.getUserById(assignment.assigned_by);
            if (assignedByUser?.user) {
              assignedByName = assignedByUser.user.user_metadata?.name || assignedByUser.user.email;
            }
          }
          // Find the corresponding complaint
          const complaint = complaints?.find(c => c.id === assignment.complaint_id);
          return {
            id: assignment.id,
            complaint_id: assignment.complaint_id,
            assigned_by: assignment.assigned_by,
            assigned_by_name: assignedByName,
            status: assignment.status, // Use 'status' instead of 'assignment_status'
            notes: assignment.notes,
            priority: assignment.priority || 'medium',
            deadline: assignment.deadline,
            assigned_at: assignment.created_at,
            created_at: assignment.created_at,
            updated_at: assignment.updated_at,
            completed_at: assignment.completed_at,
            complaint: complaint ? {
              id: complaint.id,
              title: complaint.title,
              description: complaint.descriptive_su,
              category: complaint.category,
              subcategory: complaint.subcategory,
              status: complaint.status,
              submitted_at: complaint.submitted_at,
              location_text: complaint.location_text,
              last_activity_at: complaint.last_activity_at
            } : {
              id: assignment.complaint_id,
              title: 'Complaint Details Not Available',
              description: 'Details could not be loaded',
              category: 'General',
              subcategory: 'unknown',
              status: 'unknown',
              submitted_at: assignment.created_at,
              location_text: 'Location not available',
              last_activity_at: assignment.updated_at
            }
          };
        })
      );
      return res.json({
        success: true,
        data: assignmentsWithUsers
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get tasks error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Update task status (accept, start, complete, etc.)
   */
  async updateTaskStatus(req, res) {
    try {
      const { assignmentId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user.id;
      // console.log removed for security
      // Verify this assignment belongs to the officer
      const { data: assignment, error: fetchError } = await supabase
        .from('complaint_assignments')
        .select('id, complaint_id, assigned_by, status')
        .eq('id', assignmentId)
        .eq('assigned_to', userId)
        .single();
      if (fetchError || !assignment) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found'
        });
      }
      // Prepare update data
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };
      if (notes) {
        updateData.notes = notes;
      }
      // If completing, set completed_at
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      // Update the assignment
      const { error: updateError } = await supabase
        .from('complaint_assignments')
        .update(updateData)
        .eq('id', assignmentId);
      if (updateError) {
        console.error('[LGU_OFFICER] Error updating assignment:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update assignment'
        });
      }
      // Update complaint confirmation status using the database function (instead of manual workflow_status update)
      await supabase.rpc('update_complaint_confirmation_status', {
        complaint_uuid: assignment.complaint_id
      });
      // Send notification to admin about status change
      if (assignment.assigned_by) {
        await notificationService.createNotification(
          assignment.assigned_by,
          'task_update',
          'Task Status Updated',
          `Officer updated task status to "${status}" for complaint ${assignment.complaint_id}`,
          {
            priority: 'info',
            link: '/lgu-admin/assignments',
            metadata: {
              assignment_id: assignmentId,
              complaint_id: assignment.complaint_id,
              new_status: status
            }
          }
        );
      }
      // console.log removed for security
      return res.json({
        success: true,
        message: 'Task status updated successfully'
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Update task status error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Add progress update/note to a task
   */
  async addProgressUpdate(req, res) {
    try {
      const { assignmentId } = req.params;
      const { message, isPublic } = req.body;
      const userId = req.user.id;
      // console.log removed for security
      // Verify assignment belongs to officer
      const { data: assignment, error: fetchError } = await supabase
        .from('complaint_assignments')
        .select('id, complaint_id')
        .eq('id', assignmentId)
        .eq('assigned_to', userId)
        .single();
      if (fetchError || !assignment) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found'
        });
      }
      // Add to complaint history
      const { error: historyError } = await supabase
        .from('complaint_history')
        .insert({
          complaint_id: assignment.complaint_id,
          action: 'officer_update',
          performed_by: userId,
          details: {
            message,
            is_public: isPublic || false,
            assignment_id: assignmentId
          }
        });
      if (historyError) {
        console.error('[LGU_OFFICER] Error adding history:', historyError);
      }
      // If public, notify the citizen
      if (isPublic) {
        // Get complaint details to find the submitted_by user
        const { data: complaint, error: complaintError } = await supabase
          .from('complaints')
          .select('submitted_by')
          .eq('id', assignment.complaint_id)
          .single();
        if (!complaintError && complaint?.submitted_by) {
          await notificationService.createNotification(
            complaint.submitted_by,
            'officer_update',
            'Update on Your Complaint',
            `Officer added an update: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
            {
              priority: 'info',
              link: `/complaint/${assignment.complaint_id}`,
              metadata: {
                complaint_id: assignment.complaint_id,
                assignment_id: assignmentId
              }
            }
          );
        }
      }
      // console.log removed for security
      return res.json({
        success: true,
        message: 'Progress update added successfully'
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Add progress update error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Get officer statistics
   */
  async getStatistics(req, res) {
    try {
      const userId = req.user.id;
      // Get all assignments for this officer
      const { data: assignments, error: assignmentError } = await supabase
        .from('complaint_assignments')
        .select('*')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });
      if (assignmentError) throw assignmentError;
      // Deduplicate assignments by complaint_id (keep the most recent one)
      const uniqueAssignments = assignments.reduce((acc, assignment) => {
        const existing = acc.find(a => a.complaint_id === assignment.complaint_id);
        if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
          const filtered = acc.filter(a => a.complaint_id !== assignment.complaint_id);
          return [...filtered, assignment];
        }
        return acc;
      }, []);
      // console.log removed for security
      // Calculate statistics from deduplicated assignments
      const totalTasks = uniqueAssignments.length;
      const pendingTasks = uniqueAssignments.filter(a => ['assigned', 'in_progress'].includes(a.status)).length;
      const completedTasks = uniqueAssignments.filter(a => a.status === 'completed').length;
      const inProgressTasks = uniqueAssignments.filter(a => a.status === 'in_progress').length;
      // Calculate efficiency rate
      const efficiencyRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return res.json({
        success: true,
        data: {
          total_tasks: totalTasks,
          pending_tasks: pendingTasks,
          in_progress_tasks: inProgressTasks,
          completed_tasks: completedTasks,
          efficiency_rate: `${efficiencyRate}%`
        }
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get statistics error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get statistics'
      });
    }
  }
  /**
   * Get officer activities
   */
  async getActivities(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;
      // Get recent activities from assignments with complaint details
      const { data: activities, error } = await supabase
        .from('complaint_assignments')
        .select(`
          id,
          status,
          notes,
          created_at,
          updated_at,
          completed_at,
          complaint_id,
          complaints!inner(
            id,
            title,
            category
          )
        `)
        .eq('assigned_to', userId)
        .order('updated_at', { ascending: false })
        .limit(parseInt(limit));
      if (error) {
        console.warn('[LGU_OFFICER] Activities query failed, using fallback:', error.message);
        // Fallback: get activities without joins
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('complaint_assignments')
          .select('id, status, notes, created_at, updated_at, completed_at, complaint_id')
          .eq('assigned_to', userId)
          .order('updated_at', { ascending: false })
          .limit(parseInt(limit));
        if (fallbackError) throw fallbackError;
        // Deduplicate fallback data by complaint_id (keep the most recent one)
        const uniqueFallbackData = fallbackData.reduce((acc, activity) => {
          const existing = acc.find(a => a.complaint_id === activity.complaint_id);
          if (!existing || new Date(activity.updated_at || activity.created_at) > new Date(existing.updated_at || existing.created_at)) {
            const filtered = acc.filter(a => a.complaint_id !== activity.complaint_id);
            return [...filtered, activity];
          }
          return acc;
        }, []);
        // console.log removed for security
        // Transform fallback data
        const transformedActivities = uniqueFallbackData.map(activity => ({
          id: activity.id,
          type: this.getActivityType(activity),
          description: this.getActivityDescription(activity),
          created_at: activity.updated_at || activity.created_at
        }));
        return res.json({
          success: true,
          data: transformedActivities
        });
      }
      // Deduplicate activities by complaint_id (keep the most recent one)
      const uniqueActivities = activities.reduce((acc, activity) => {
        const existing = acc.find(a => a.complaint_id === activity.complaint_id);
        if (!existing || new Date(activity.updated_at || activity.created_at) > new Date(existing.updated_at || existing.created_at)) {
          const filtered = acc.filter(a => a.complaint_id !== activity.complaint_id);
          return [...filtered, activity];
        }
        return acc;
      }, []);
      // console.log removed for security
      // Transform to activity format with complaint details
      const transformedActivities = uniqueActivities.map(activity => ({
        id: activity.id,
        type: this.getActivityType(activity),
        description: this.getActivityDescription(activity, activity.complaints),
        created_at: activity.updated_at || activity.created_at
      }));
      return res.json({
        success: true,
        data: transformedActivities
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get activities error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get activities'
      });
    }
  }
  // Helper function to determine activity type
  getActivityType(activity) {
    if (activity.completed_at) return 'task_completed';
    if (activity.status === 'in_progress') return 'task_started';
    if (activity.status === 'assigned') return 'task_assigned';
    if (activity.notes) return 'note_added';
    return 'task_update';
  }
  // Helper function to generate activity description
  getActivityDescription(activity, complaint = null) {
    const complaintTitle = complaint?.title || `Complaint #${activity.complaint_id?.substring(0, 8)}`;
    const complaintCategory = complaint?.category || 'General';
    switch (this.getActivityType(activity)) {
      case 'task_completed':
        return `Completed task: "${complaintTitle}" (${complaintCategory})`;
      case 'task_started':
        return `Started working on: "${complaintTitle}" (${complaintCategory})`;
      case 'task_assigned':
        return `New task assigned: "${complaintTitle}" (${complaintCategory})`;
      case 'note_added':
        return `Added note to: "${complaintTitle}" (${complaintCategory})`;
      default:
        return `Updated task: "${complaintTitle}" - Status: ${activity.status}`;
    }
  }
  /**
   * Get department updates
   */
  async getUpdates(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;
      // Get user's department from metadata
      const userRole = req.user.role;
      const departmentCode = userRole.split('-')[1]; // Extract department from lgu-{dept}
      // For now, return empty array - department updates will be implemented later
      // This removes the mock data and provides a clean foundation for future implementation
      const updates = [];
      return res.json({
        success: true,
        data: updates.slice(0, parseInt(limit))
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get updates error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get updates'
      });
    }
  }
}

module.exports = LguOfficerController;
