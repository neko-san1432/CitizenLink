const Database = require('../config/database');
const NotificationService = require('../services/NotificationService');

const db = new Database();
const supabase = db.getClient();
const notificationService = new NotificationService();

class LguOfficerController {
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
            complaint_status: assignment.complaints?.status || '',
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
        .select('*, complaints:complaint_id(id, title, status)')
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

      // Update complaint status based on assignment status
      let complaintStatus = assignment.complaints.status;
      if (status === 'in_progress' && complaintStatus === 'pending review') {
        complaintStatus = 'in progress';
      } else if (status === 'completed') {
        complaintStatus = 'resolved';
      }

      await supabase
        .from('complaints')
        .update({
          status: complaintStatus,
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
}

module.exports = new LguOfficerController();
