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

      // Get all assignments for this officer
      let query = supabase
        .from('complaint_assignments')
        .select(`
          id,
          complaint_id,
          assigned_by,
          status,
          notes,
          priority,
          deadline,
          created_at,
          updated_at,
          completed_at,
          complaints:complaint_id (
            id,
            title,
            description,
            type,
            subtype,
            status,
            priority,
            submitted_at,
            location_text,
            primary_department,
            secondary_departments,
            last_activity_at
          )
        `)
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (status) {
        query = query.eq('workflow_status', status);
      }
      if (priority) {
        query = query.eq('priority', priority);
      }
      if (limit) {
        query = query.limit(parseInt(limit));
      }

      const { data: assignments, error: assignmentError } = await query;

      if (assignmentError) {
        console.warn('[LGU_OFFICER] Assignments query failed, using fallback:', assignmentError.message);
        // Fallback: get assignments without joins
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('complaint_assignments')
          .select('*')
          .eq('assigned_to', userId)
          .order('created_at', { ascending: false });
        
        if (fallbackError) {
          console.error('[LGU_OFFICER] Fallback query also failed:', fallbackError);
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch assignments'
          });
        }
        
        // Transform fallback data
        const transformedAssignments = fallbackData.map(assignment => ({
          id: assignment.id,
          complaint_id: assignment.complaint_id,
          status: assignment.status,
          priority: assignment.priority,
          notes: assignment.notes,
          deadline: assignment.deadline,
          created_at: assignment.created_at,
          updated_at: assignment.updated_at,
          complaints: {
            id: assignment.complaint_id,
            title: 'Complaint Details',
            description: 'Details not available',
            type: 'complaint',
            subtype: 'general',
            status: assignment.status,
            priority: assignment.priority,
            submitted_at: assignment.created_at,
            location_text: 'Location not available',
            primary_department: 'Unknown',
            secondary_departments: [],
            last_activity_at: assignment.updated_at
          }
        }));
        
        return res.json({
          success: true,
          data: transformedAssignments
        });
      }

      // Transform data for easier frontend consumption
      const tasks = assignments.map(assignment => ({
        assignment_id: assignment.id,
        complaint_id: assignment.complaint_id,
        status: assignment.status,
        priority: assignment.priority,
        deadline: assignment.deadline,
        notes: assignment.notes,
        assigned_at: assignment.created_at,
        completed_at: assignment.completed_at,
        complaint: assignment.complaints
      }));

      res.json({
        success: true,
        data: tasks,
        count: tasks.length
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
      const { resolution_notes, evidence } = req.body;
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
          resolution_notes: resolution_notes,
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
              resolution_notes: resolution_notes,
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

      // console.log removed for security

      // Get all assignments for this officer
      const { data: assignments, error: assignmentError } = await supabase
        .from('complaint_assignments')
        .select(`
          id,
          complaint_id,
          assigned_by,
          status,
          notes,
          priority,
          deadline,
          created_at,
          updated_at,
          completed_at,
          complaints:complaint_id (
            id,
            title,
            descriptive_su,
            type,
            status,
            submitted_at,
            location,
            primary_department
          )
        `)
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });

      if (assignmentError) {
        console.error('[LGU_OFFICER] Error fetching assignments:', assignmentError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch assignments'
        });
      }

      // Get assigned_by user info for each assignment
      const assignmentsWithUsers = await Promise.all(
        (assignments || []).map(async (assignment) => {
          let assignedByName = 'Unknown';

          if (assignment.assigned_by) {
            const { data: assignedByUser } = await supabase.auth.admin.getUserById(assignment.assigned_by);
            if (assignedByUser?.user) {
              assignedByName = assignedByUser.user.user_metadata?.name || assignedByUser.user.email;
            }
          }

          return {
            id: assignment.id,
            complaint_id: assignment.complaint_id,
            complaint_title: assignment.complaints?.title || 'Untitled',
            complaint_description: assignment.complaints?.descriptive_su || '',
            complaint_type: assignment.complaints?.type || '',
            complaint_status: assignment.complaints?.workflow_status || '',
            complaint_location: assignment.complaints?.location || '',
            complaint_submitted_at: assignment.complaints?.submitted_at,
            assignment_status: assignment.status,
            assigned_by: assignment.assigned_by,
            assigned_by_name: assignedByName,
            notes: assignment.notes,
            priority: assignment.priority || 'medium',
            deadline: assignment.deadline,
            assigned_at: assignment.created_at,
            updated_at: assignment.updated_at,
            completed_at: assignment.completed_at
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
        .select('*, complaints:complaint_id(id, title, workflow_status)')
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

      // Update complaint workflow_status based on assignment status
      let complaintWorkflowStatus = assignment.complaints.workflow_status;
      if (status === 'in_progress' && complaintWorkflowStatus === 'new') {
        complaintWorkflowStatus = 'in_progress';
      } else if (status === 'completed') {
        complaintWorkflowStatus = 'completed';
      }

      await supabase
        .from('complaints')
        .update({
          workflow_status: complaintWorkflowStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignment.complaint_id);

      // Send notification to admin about status change
      if (assignment.assigned_by) {
        await notificationService.createNotification({
          userId: assignment.assigned_by,
          title: 'Task Status Updated',
          message: `Officer updated task status to "${status}" for: ${assignment.complaints?.title}`,
          type: 'task_update',
          priority: 'info',
          link: '/lgu-admin/assignments',
          metadata: {
            assignment_id: assignmentId,
            complaint_id: assignment.complaint_id,
            new_status: status
          }
        });
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
        .select('*, complaints:complaint_id(id, title, submitted_by)')
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
      if (isPublic && assignment.complaints?.submitted_by) {
        await notificationService.createNotification({
          userId: assignment.complaints.submitted_by,
          title: 'Update on Your Complaint',
          message: `Officer added an update: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
          type: 'officer_update',
          priority: 'info',
          link: `/complaint/${assignment.complaint_id}`,
          metadata: {
            complaint_id: assignment.complaint_id,
            assignment_id: assignmentId
          }
        });
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

      // Get total tasks
      const { count: totalTasks, error: totalError } = await supabase
        .from('complaint_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId);

      if (totalError) throw totalError;

      // Get pending tasks
      const { count: pendingTasks, error: pendingError } = await supabase
        .from('complaint_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .in('status', ['assigned', 'in_progress']);

      if (pendingError) throw pendingError;

      // Get completed tasks
      const { count: completedTasks, error: completedError } = await supabase
        .from('complaint_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('status', 'completed');

      if (completedError) throw completedError;

      // Calculate efficiency rate
      const efficiencyRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return res.json({
        success: true,
        data: {
          total_tasks: totalTasks || 0,
          pending_tasks: pendingTasks || 0,
          completed_tasks: completedTasks || 0,
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

      // Get recent activities from assignments
      const { data: activities, error } = await supabase
        .from('complaint_assignments')
        .select(`
          id,
          status,
          notes,
          created_at,
          updated_at,
          complaint_id
        `)
        .eq('assigned_to', userId)
        .order('updated_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) {
        console.warn('[LGU_OFFICER] Activities query failed, using fallback:', error.message);
        // Fallback: get activities without joins
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('complaint_assignments')
          .select('id, status, notes, created_at, updated_at, complaint_id')
          .eq('assigned_to', userId)
          .order('updated_at', { ascending: false })
          .limit(parseInt(limit));
        
        if (fallbackError) throw fallbackError;
        
        // Transform fallback data
        const transformedActivities = fallbackData.map(activity => ({
          id: activity.id,
          type: 'task_update',
          description: `Task status updated to ${activity.status}`,
          created_at: activity.updated_at
        }));
        
        return res.json({
          success: true,
          data: transformedActivities
        });
      }

      // Transform to activity format
      const transformedActivities = activities.map(activity => ({
        id: activity.id,
        type: 'task_update',
        description: `Task "${activity.complaints?.title || 'Unknown'}" status updated to ${activity.status}`,
        created_at: activity.updated_at
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

      // Get department updates (mock data for now)
      const updates = [
        {
          id: 1,
          title: 'Department Meeting Scheduled',
          content: 'Monthly department meeting scheduled for next Friday at 2:00 PM.',
          priority: 'medium',
          author: 'Department Head',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          title: 'New Procedures Update',
          content: 'Updated procedures for complaint handling. Please review the new guidelines.',
          priority: 'high',
          author: 'Admin',
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

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
