/**
 * LGU Admin Controller
 * Handles department-specific admin operations
 */

const Database = require('../config/database');
const db = new Database();
const supabase = db.getClient();
const NotificationService = require('../services/NotificationService');

// Create notification service instance
const notificationService = new NotificationService();

class LguAdminController {
  /**
   * Get department assignments
   * Returns complaints assigned to the admin's department that need officer assignment
   */
  async getDepartmentAssignments(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const metadata = req.user.metadata || {};
      const { status, sub_type, priority } = req.query; // Get filters from query params

      // Extract department from role (e.g., lgu-admin-{dept} -> {dept})
      const departmentCode = userRole.replace('lgu-admin-', '');

      // Get the department ID
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('code', departmentCode)
        .single();

      if (deptError || !department) {
        console.error('[LGU_ADMIN] Department not found:', { departmentCode, error: deptError });
        return res.status(404).json({
          success: false,
          error: 'Department not found'
        });
      }

      // Step 1: Get all complaints for this department with filters
      let query = supabase
        .from('complaints')
        .select('id, title, descriptive_su, location_text, submitted_at, submitted_by, primary_department, status, subtype, priority')
        .eq('primary_department', departmentCode)
        .order('submitted_at', { ascending: false });

      // Apply status filter
      if (status && status !== 'all') {
        query = query.eq('status', status);
      } else {
        // Default: show pending review and in progress
        query = query.in('status', ['pending review', 'in progress']);
      }

      // Apply other filters
      if (sub_type && sub_type !== 'all') {
        query = query.eq('subtype', sub_type);
      }
      if (priority && priority !== 'all') {
        query = query.eq('priority', priority);
      }

      const { data: departmentComplaints, error: complaintsError } = await query;

      if (complaintsError) {
        console.error('[LGU_ADMIN] Error fetching complaints:', complaintsError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch complaints',
          details: complaintsError.message
        });
      }

      // Step 2: Get existing assignments for these complaints
      const complaintIds = departmentComplaints.map(c => c.id);
      const { data: existingAssignments, error: assignError } = await supabase
        .from('complaint_assignments')
        .select('*')
        .in('complaint_id', complaintIds)
        .in('status', ['pending', 'active', 'in_progress']);

      if (assignError) {
        console.error('[LGU_ADMIN] Error fetching assignments:', assignError);
      }

      // Create a map of complaint_id -> assignment
      const assignmentsMap = {};
      (existingAssignments || []).forEach(assignment => {
        assignmentsMap[assignment.complaint_id] = assignment;
      });

      // Combine complaints with their assignments (or null if unassigned)
      const departmentAssignments = departmentComplaints.map(complaint => {
        const assignment = assignmentsMap[complaint.id];
        return {
          id: assignment?.id || null,
          complaint_id: complaint.id,
          assigned_to: assignment?.assigned_to || null,
          assigned_by: assignment?.assigned_by || null,
          status: assignment?.status || 'unassigned',
          priority: assignment?.priority || 'medium',
          deadline: assignment?.deadline || null,
          notes: assignment?.notes || null,
          created_at: assignment?.created_at || complaint.submitted_at,
          updated_at: assignment?.updated_at || complaint.submitted_at,
          complaints: complaint
        };
      });

      // Get officer information for assigned complaints
      const assignedOfficerIds = departmentAssignments
        .filter(a => a.assigned_to)
        .map(a => a.assigned_to);

      let officersMap = {};
      if (assignedOfficerIds.length > 0) {
        const { data: officers } = await supabase.auth.admin.listUsers();

        officersMap = officers.users
          .filter(u => assignedOfficerIds.includes(u.id))
          .reduce((acc, user) => {
            acc[user.id] = {
              id: user.id,
              name: user.user_metadata?.name || user.email,
              email: user.email
            };
            return acc;
          }, {});
      }

      // Get citizen information
      const citizenIds = [...new Set(departmentAssignments.map(a => a.complaints?.submitted_by).filter(Boolean))];
      let citizensMap = {};
      if (citizenIds.length > 0) {
        const { data: citizens } = await supabase.auth.admin.listUsers();

        citizensMap = citizens.users
          .filter(u => citizenIds.includes(u.id))
          .reduce((acc, user) => {
            acc[user.id] = {
              name: user.user_metadata?.name || user.email
            };
            return acc;
          }, {});
      }

      // Format response
      const formattedAssignments = departmentAssignments.map(assignment => ({
        id: assignment.id,
        complaint_id: assignment.complaint_id,
        title: assignment.complaints?.title,
        description: assignment.complaints?.descriptive_su,
        location_text: assignment.complaints?.location_text,
        submitted_at: assignment.complaints?.submitted_at,
        assigned_to: assignment.assigned_to,
        assigned_at: assignment.updated_at, // Use updated_at as assignment time
        officer_name: assignment.assigned_to ? officersMap[assignment.assigned_to]?.name : null,
        officer_email: assignment.assigned_to ? officersMap[assignment.assigned_to]?.email : null,
        citizen_name: citizensMap[assignment.complaints?.submitted_by]?.name,
        priority: assignment.priority,
        deadline: assignment.deadline,
        status: assignment.status,
        notes: assignment.notes
      }));

      return res.json({
        success: true,
        data: formattedAssignments
      });

    } catch (error) {
      console.error('[LGU_ADMIN] Get assignments error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get department assignments'
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

      // Extract department from role
      const departmentCode = userRole.replace('lgu-admin-', '');

      // Get the department ID
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .select('id')
        .eq('code', departmentCode)
        .single();

      if (deptError || !department) {
        console.error('[LGU_ADMIN] Department not found:', { departmentCode, error: deptError });
        return res.status(404).json({
          success: false,
          error: 'Department not found'
        });
      }

      // Get all users with lgu-* officer role in this department
      // Officer roles follow pattern: lgu-wst, lgu-engineering, lgu-health, etc.
      const { data: allUsers } = await supabase.auth.admin.listUsers();

      const allLguUsers = allUsers.users.filter(user => {
        const metadata = user.user_metadata || {};
        const role = metadata.role || '';
        return /^lgu-(?!admin|hr)/.test(role);
      });

      const officers = allUsers.users
        .filter(user => {
          const metadata = user.user_metadata || {};
          const role = metadata.role || '';
          // Match lgu-* but exclude lgu-admin-* and lgu-hr-*
          const isOfficer = /^lgu-(?!admin|hr)/.test(role);

          // Check if the role contains the department code (e.g., lgu-wst for wst department)
          const roleContainsDepartment = role.includes(`-${departmentCode}`);
          const hasCorrectDepartment = metadata.department === departmentCode;

          // console.log removed for security

          // Match if role contains department code OR if department field matches
          return isOfficer && (roleContainsDepartment || hasCorrectDepartment);
        })
        .map(user => ({
          id: user.id,
          name: user.user_metadata?.name || user.email,
          email: user.email,
          employee_id: user.user_metadata?.employee_id,
          mobile: user.user_metadata?.mobile
        }));

      return res.json({
        success: true,
        data: officers
      });

    } catch (error) {
      console.error('[LGU_ADMIN] Get officers error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get department officers'
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
          error: 'Complaint ID and Officer ID are required'
        });
      }

      // Extract department from role
      const departmentCode = userRole.replace('lgu-admin-', '');

      // Get the department ID
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .select('id')
        .eq('code', departmentCode)
        .single();

      if (deptError || !department) {
        return res.status(404).json({
          success: false,
          error: 'Department not found'
        });
      }

      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from('complaint_assignments')
        .select('id')
        .eq('complaint_id', complaintId)
        .maybeSingle(); // Don't error if not found

      let assignment;

      if (existingAssignment) {
        // Update existing assignment
        const { data: updatedAssignment, error: updateError } = await supabase
          .from('complaint_assignments')
          .update({
            assigned_to: officerId,
            assigned_by: userId,
            priority: priority || 'medium',
            deadline: deadline || null,
            notes: notes || null,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAssignment.id)
          .select()
          .single();

        if (updateError) {
          console.error('[LGU_ADMIN] Error updating assignment:', updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to update assignment'
          });
        }

        assignment = updatedAssignment;
      } else {
        // Create new assignment
        const { data: newAssignment, error: insertError } = await supabase
          .from('complaint_assignments')
          .insert({
            complaint_id: complaintId,
            assigned_to: officerId,
            assigned_by: userId,
            department_id: null, // Department is tracked via complaint.primary_department
            priority: priority || 'medium',
            deadline: deadline || null,
            notes: notes || null,
            status: 'active'
          })
          .select()
          .single();

        if (insertError) {
          console.error('[LGU_ADMIN] Error creating assignment:', insertError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create assignment'
          });
        }

        assignment = newAssignment;
      }

      // Get complaint details
      const { data: complaint } = await supabase
        .from('complaints')
        .select('title, descriptive_su, id')
        .eq('id', complaintId)
        .single();

      // Send notification to the officer
      // Map complaint priority to notification priority
      const notificationPriority = priority === 'urgent' ? 'urgent' :
        priority === 'high' ? 'warning' : 'info';

      await notificationService.createNotification(
        officerId,
        'task_assigned',
        'New Task Assigned',
        `You have been assigned to handle: ${complaint?.title || 'a complaint'}`,
        {
          priority: notificationPriority,
          link: `/lgu/tasks/${complaintId}`, // LGU officer task page
          metadata: {
            complaint_id: complaintId,
            assigned_by: userId,
            deadline: deadline
          }
        }
      );

      return res.json({
        success: true,
        data: assignment
      });

    } catch (error) {
      console.error('[LGU_ADMIN] Assign complaint error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign complaint'
      });
    }
  }
}

module.exports = new LguAdminController();
