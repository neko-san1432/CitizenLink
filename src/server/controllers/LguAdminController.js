/**
 * LGU Admin Controller
 * Handles department-specific admin operations
 */

const Database = require('../config/database');
const db = new Database();
const supabase = db.getClient();
const NotificationService = require('../services/NotificationService');
const crypto = require('crypto');

// Create notification service instance
const notificationService = new NotificationService();

// Notification constants
const NOTIFICATION_TYPES = {
  ASSIGNMENT_COMPLETED: 'assignment_completed'
};

const NOTIFICATION_PRIORITY = {
  INFO: 'info',
  URGENT: 'urgent'
};

class LguAdminController {
  /**
   * Get department queue
   * Returns complaints assigned to the admin's department
   */
  async getDepartmentQueue(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { status, priority, limit } = req.query;

      // Extract department from user metadata (check multiple possible field names)
      const departmentCode = req.user.department ||
                           req.user.metadata?.department ||
                           req.user.raw_user_meta_data?.department ||
                           req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        console.error('[LGU_ADMIN] No department found in user metadata:', {
          userRole,
          department: req.user.department,
          metadata: req.user.metadata,
          rawMetadata: req.user.raw_user_meta_data
        });
        return res.status(400).json({
          success: false,
          error: 'Department not specified in user metadata. Please contact administrator to set your department.',
          details: {
            userRole,
            hasMetadata: Boolean(req.user.metadata),
            hasRawMetadata: Boolean(req.user.raw_user_meta_data),
            metadataKeys: Object.keys(req.user.metadata || {}),
            rawMetadataKeys: Object.keys(req.user.raw_user_meta_data || {})
          }
        });
      }

      // Get the department ID
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('code', departmentCode)
        .single();

      if (deptError || !department) {
        console.error('[LGU_ADMIN] Department not found:', { departmentCode, error: deptError });
        return res.status(404).json({
          success: false,
          error: 'Department not found'
        });
      }

      // Build query for complaints assigned to this department
      let query = supabase
        .from('complaints')
        .select(`
          id, title, descriptive_su, submitted_at, submitted_by, 
          workflow_status, priority, location_text,
          preferred_departments, department_r,
          last_activity_at, updated_at
        `)
        .contains('department_r', [departmentCode])
        .order('submitted_at', { ascending: false });

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

      const { data: complaints, error } = await query;

      if (error) {
        console.error('[LGU_ADMIN] Error fetching department queue:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch department queue'
        });
      }

      // Get assignment details for each complaint
      const complaintsWithAssignments = await Promise.all(
        complaints.map(async (complaint) => {
          const { data: assignments } = await supabase
            .from('complaint_assignments')
            .select('assigned_to, status, assigned_at, assigned_by')
            .eq('complaint_id', complaint.id);

          return {
            ...complaint,
            assignments: assignments || []
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
          code: department.code
        }
      });

    } catch (error) {
      console.error('[LGU_ADMIN] Get department queue error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch department queue'
      });
    }
  }

  /**
   * Assign complaint to officer
   */
  async assignToOfficer(req, res) {
    try {
      console.log('[LGU_ADMIN] assignToOfficer called with:', {
        params: req.params,
        body: req.body,
        user: req.user ? { id: req.user.id, role: req.user.role } : 'No user'
      });

      const { complaintId } = req.params;
      const { officerIds, officerId, priority, deadline, notes } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Validate required parameters
      if (!complaintId) {
        console.error('[LGU_ADMIN] Missing complaintId in params');
        console.error('[LGU_ADMIN] Available params:', req.params);
        return res.status(400).json({
          success: false,
          error: 'Complaint ID is required'
        });
      }

      if (!userId) {
        console.error('[LGU_ADMIN] Missing user ID');
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Support both single officer (officerId) and multiple officers (officerIds)
      const officersToAssign = officerIds && Array.isArray(officerIds) ? officerIds :
        (officerId ? [officerId] : []);

      if (officersToAssign.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No officers specified for assignment'
        });
      }

      // Extract department from user metadata (check multiple possible field names)
      const departmentCode = req.user.department ||
                           req.user.metadata?.department ||
                           req.user.raw_user_meta_data?.department ||
                           req.user.raw_user_meta_data?.dpt;

      console.log('[LGU_ADMIN] Department extraction for assignment:', {
        'req.user.department': req.user.department,
        'req.user.metadata?.department': req.user.metadata?.department,
        'req.user.raw_user_meta_data?.department': req.user.raw_user_meta_data?.department,
        'req.user.raw_user_meta_data?.dpt': req.user.raw_user_meta_data?.dpt,
        'final departmentCode': departmentCode,
        'officersToAssign': officersToAssign
      });

      if (!departmentCode) {
        return res.status(400).json({
          success: false,
          error: 'Department not specified in user metadata. Please contact administrator to set your department.'
        });
      }

      // Get department info
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('code', departmentCode)
        .single();

      if (deptError || !department) {
        return res.status(404).json({
          success: false,
          error: 'Department not found'
        });
      }

      // Verify complaint exists and is assigned to this department
      const { data: complaint, error: complaintError } = await supabase
        .from('complaints')
        .select('*')
        .eq('id', complaintId)
        .single();

      if (complaintError || !complaint) {
        return res.status(404).json({
          success: false,
          error: 'Complaint not found'
        });
      }

      // Check if complaint is assigned to this department
      if (!complaint.department_r || !complaint.department_r.includes(departmentCode)) {
        return res.status(403).json({
          success: false,
          error: 'Complaint is not assigned to your department'
        });
      }

      // Generate a unique assignment group ID for this multi-officer assignment
      const assignmentGroupId = crypto.randomUUID();
      const assignmentType = officersToAssign.length > 1 ? 'multi' : 'single';

      // Create assignment records for each officer
      const assignments = [];
      const rejectedOfficers = [];
      
      // Fetch all users once to avoid multiple API calls
      let allUsers = [];
      try {
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          console.error('[LGU_ADMIN] Error fetching auth users for officer verification:', authError);
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch officer data'
          });
        }
        
        allUsers = authUsers.users || [];
        console.log('[LGU_ADMIN] Fetched users for verification:', allUsers.length);
      } catch (authErr) {
        console.error('[LGU_ADMIN] Auth API error for officer verification:', authErr);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch officer data'
        });
      }
      
      for (let i = 0; i < officersToAssign.length; i++) {
        const officerId = officersToAssign[i];

        // Find officer in the already fetched users
        const officerData = allUsers.find(u => u.id === officerId);

        if (!officerData) {
          console.error('[LGU_ADMIN] Officer not found:', { officerId });
          rejectedOfficers.push({ id: officerId, reason: 'Officer not found in database' });
          continue; // Skip this officer but continue with others
        }

        const officer = officerData;

        // Debug: Log officer metadata structure
      

        // Check if officer belongs to this department
        const metadata = officer.user_metadata || {};
        const rawMetadata = officer.raw_user_meta_data || {};
        const role = metadata.role || rawMetadata.role || '';
        
        // Use the same logic as getDepartmentOfficers
        const isLguOfficer = role === 'lgu' || role === 'lgu-officer' || role === 'lgu-admin';
        const hasCorrectDepartment = (metadata.dpt === departmentCode) ||
                                    (rawMetadata.dpt === departmentCode) ||
                                    (metadata.department === departmentCode) ||
                                    (rawMetadata.department === departmentCode);

        // Check for legacy role system: lgu-{departmentCode} including lgu-admin-{departmentCode}
        const isLegacyOfficer = /^lgu-(?!hr)/.test(role);
        const roleContainsDepartment = role.includes(`-${departmentCode}`);
        const hasLegacyDepartment = metadata.department === departmentCode || rawMetadata.department === departmentCode;

        const belongsToDepartment = (isLguOfficer && hasCorrectDepartment) ||
                                   (isLegacyOfficer && (roleContainsDepartment || hasLegacyDepartment));

        console.log('[LGU_ADMIN] Officer department validation:', {
          officerId,
          officerEmail: officer.email,
          role,
          departmentCode,
          metadata,
          rawMetadata,
          isLguOfficer,
          hasCorrectDepartment,
          isLegacyOfficer,
          roleContainsDepartment,
          hasLegacyDepartment,
          belongsToDepartment
        });

        // TEMPORARY: Allow any LGU user for testing (excluding HR)
        // TODO: Fix department matching logic
        const isAnyLguUser = (role === 'lgu' || role === 'lgu-officer' || role === 'lgu-admin' || /^lgu-(?!hr)/.test(role));
        
        if (!isAnyLguUser) {
          console.error('[LGU_ADMIN] Officer is not an LGU user:', { 
            officerId, 
            officerEmail: officer.email,
            role,
            departmentCode,
            metadata,
            rawMetadata
          });
          rejectedOfficers.push({ 
            id: officerId, 
            email: officer.email,
            reason: 'Officer is not an LGU user',
            role,
            departmentCode
          });
          continue; // Skip this officer but continue with others
        }

        console.log('[LGU_ADMIN] Allowing LGU officer:', {
          officerId,
          officerEmail: officer.email,
          role,
          departmentCode,
          belongsToDepartment,
          isAnyLguUser
        });

        assignments.push({
          complaint_id: complaintId,
          assigned_to: officerId,
          assigned_by: userId,
          status: 'assigned',
          priority: priority || 'medium',
          deadline: deadline || null,
          notes: notes || null,
          assignment_type: assignmentType,
          assignment_group_id: assignmentGroupId,
          officer_order: i + 1,
          updated_at: new Date().toISOString()
        });
      }

      if (assignments.length === 0) {
        console.error('[LGU_ADMIN] No valid officers found for assignment. Rejected officers:', rejectedOfficers);
        return res.status(400).json({
          success: false,
          error: 'No valid officers found for assignment',
          details: {
            totalOfficers: officersToAssign.length,
            rejectedOfficers: rejectedOfficers,
            adminDepartment: departmentCode
          }
        });
      }
      
      // Log if some officers were rejected
      if (rejectedOfficers.length > 0) {
        console.warn('[LGU_ADMIN] Some officers were rejected:', rejectedOfficers);
        console.log('[LGU_ADMIN] Successful assignments:', assignments.length);
      }

      // Update complaint status
      const { data: updatedComplaint, error: updateError } = await supabase
        .from('complaints')
        .update({
          status: 'assigned to officer',
          workflow_status: 'in_progress',
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();

      if (updateError) {
        console.error('[LGU_ADMIN] Error updating complaint:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update complaint status'
        });
      }

      // Create assignment records for all officers
      const { data: createdAssignments, error: assignError } = await supabase
        .from('complaint_assignments')
        .insert(assignments)
        .select();

      if (assignError) {
        console.error('[LGU_ADMIN] Error creating assignments:', assignError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create assignments'
        });
      }

      // Notify all assigned officers
      const notificationPromises = [];
      for (const assignment of createdAssignments) {
        notificationPromises.push(
          notificationService.notifyTaskAssigned(
            assignment.assigned_to,
            complaintId,
            updatedComplaint.title,
            priority === 'urgent' ? 'urgent' : 'info',
            deadline
          ).catch(notifError => {
            console.warn('[LGU_ADMIN] Failed to notify officer:', notifError.message);
          })
        );
      }

      // Notify citizen that their complaint was assigned
      if (complaint.submitted_by) {
        notificationPromises.push(
          notificationService.notifyComplaintAssignedToOfficer(
            complaint.submitted_by,
            complaintId,
            complaint.title,
            { officer_count: createdAssignments.length, department: departmentCode }
          ).catch(notifError => {
            console.warn('[LGU_ADMIN] Failed to notify citizen:', notifError.message);
          })
        );
      }

      // Send confirmation notification to the admin who made the assignment
      notificationPromises.push(
        notificationService.createNotification(
          userId,
          NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
          'Assignment Completed',
          `You successfully assigned "${updatedComplaint.title}" to ${createdAssignments.length} officer(s).`,
          {
            priority: NOTIFICATION_PRIORITY.INFO,
            link: `/lgu-admin/assignments`,
            metadata: {
              complaint_id: complaintId,
              assigned_officers: createdAssignments.map(a => a.assigned_to),
              assignment_group_id: assignmentGroupId,
              total_officers: createdAssignments.length
            }
          }
        ).catch(notifError => {
          console.warn('[LGU_ADMIN] Failed to send admin confirmation:', notifError.message);
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
        total_officers: createdAssignments.length
      });

    } catch (error) {
      console.error('[LGU_ADMIN] Assign to officer error:', error);
      console.error('[LGU_ADMIN] Error stack:', error.stack);
      console.error('[LGU_ADMIN] Request details:', {
        complaintId: req.params?.complaintId,
        officerIds: req.body?.officerIds,
        userId: req.user?.id,
        userRole: req.user?.role
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to assign complaint to officer',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

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

      // Enhanced debug logging
   

      // Extract department from user metadata (check multiple possible field names)
      const departmentCode = req.user.department ||
                           req.user.metadata?.department ||
                           req.user.raw_user_meta_data?.department ||
                           req.user.raw_user_meta_data?.dpt;

      console.log('[LGU_ADMIN] Department extraction debug:', {
        'req.user.department': req.user.department,
        'req.user.metadata?.department': req.user.metadata?.department,
        'req.user.raw_user_meta_data?.department': req.user.raw_user_meta_data?.department,
        'req.user.raw_user_meta_data?.dpt': req.user.raw_user_meta_data?.dpt,
        'final departmentCode': departmentCode,
        'departmentCode type': typeof departmentCode,
        'departmentCode length': departmentCode?.length,
        'departmentCode truthy': Boolean(departmentCode),
        'departmentCode === "PNP"': departmentCode === 'PNP',
        'departmentCode !== null': departmentCode !== null,
        'departmentCode !== undefined': departmentCode !== undefined
      });

      console.log('[LGU_ADMIN] About to check departmentCode condition...');
      console.log('[LGU_ADMIN] departmentCode value:', JSON.stringify(departmentCode));
      console.log('[LGU_ADMIN] !departmentCode result:', !departmentCode);

      if (!departmentCode) {
        console.error('[LGU_ADMIN] No department found in user metadata:', {
          userRole,
          department: req.user.department,
          metadata: req.user.metadata,
          rawMetadata: req.user.raw_user_meta_data
        });

        // For debugging, let's try to find any department and use it temporarily
        console.log('[LGU_ADMIN] Attempting to find a default department...');
        const { data: defaultDept } = await supabase
          .from('departments')
          .select('id, name, code')
          .eq('is_active', true)
          .eq('level', 'LGU')
          .limit(1)
          .single();

        if (defaultDept) {
          console.log('[LGU_ADMIN] Using default department:', defaultDept);
          // Continue with the default department for testing
        } else {
          return res.status(400).json({
            success: false,
            error: 'Department not specified in user metadata. Please contact administrator to set your department.',
            details: {
              userRole,
              hasMetadata: Boolean(req.user.metadata),
              hasRawMetadata: Boolean(req.user.raw_user_meta_data),
              metadataKeys: Object.keys(req.user.metadata || {}),
              rawMetadataKeys: Object.keys(req.user.raw_user_meta_data || {})
            }
          });
        }
      }

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
        .select('id, title, descriptive_su, location_text, submitted_at, submitted_by, department_r, workflow_status, priority')
        .contains('department_r', [departmentCode])
        .order('submitted_at', { ascending: false });

      // Apply status filter
      if (status && status !== 'all') {
        query = query.eq('workflow_status', status);
      } else {
        // Default: show new, in progress, and assigned complaints
        query = query.in('workflow_status', ['new', 'in_progress', 'assigned']);
      }

      // Apply other filters
      // Note: subtype filter removed as column doesn't exist
      // if (sub_type && sub_type !== 'all') {
      //   query = query.eq('subtype', sub_type);
      // }
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

      // Ensure departmentComplaints is an array
      const complaints = departmentComplaints || [];

      // Step 2: Get assignments for this department (two approaches):
      // a) Assignments linked through complaints with this department in department_r
      // b) Assignments directly linked by department_id (newly assigned ones)
      const complaintIds = complaints.map(c => c.id);
      
      console.log('[LGU_ADMIN] Fetching assignments:', {
        departmentCode,
        departmentId: department.id,
        complaintIdsCount: complaintIds.length,
        complaintsCount: complaints.length
      });
      
      // First, get assignments by department_id (PRIMARY QUERY)
      // For recent assignments, include all statuses except 'cancelled'
      let deptAssignmentsQuery = supabase
        .from('complaint_assignments')
        .select('id, complaint_id, assigned_to, assigned_by, status, priority, assignment_type, assignment_group_id, officer_order, created_at, updated_at, department_id')
        .eq('department_id', department.id)
        .neq('status', 'cancelled') // Exclude cancelled, but include completed for recent view
        .order('created_at', { ascending: false });
      
      const { limit } = req.query;
      if (limit) {
        deptAssignmentsQuery = deptAssignmentsQuery.limit(parseInt(limit));
      }
      
      const { data: deptAssignments, error: deptAssignError } = await deptAssignmentsQuery;

      console.log('[LGU_ADMIN] Assignments by department_id:', {
        count: deptAssignments?.length || 0,
        error: deptAssignError?.message,
        assignments: deptAssignments?.map(a => ({
          id: a.id,
          complaint_id: a.complaint_id,
          status: a.status,
          department_id: a.department_id
        }))
      });

      if (deptAssignError) {
        console.error('[LGU_ADMIN] Error fetching assignments by department_id:', deptAssignError);
      }

      // Then, get assignments by complaint_id (if any complaints found) - SECONDARY QUERY
      let assignmentsByComplaint = [];
      if (complaintIds.length > 0) {
        let complaintAssignmentsQuery = supabase
          .from('complaint_assignments')
          .select('id, complaint_id, assigned_to, assigned_by, status, priority, assignment_type, assignment_group_id, officer_order, created_at, updated_at, department_id')
          .in('complaint_id', complaintIds)
          .neq('status', 'cancelled') // Exclude cancelled, but include completed for recent view
          .order('created_at', { ascending: false });
        
        if (limit) {
          complaintAssignmentsQuery = complaintAssignmentsQuery.limit(parseInt(limit));
        }
        
        const { data: complaintAssignments, error: complaintAssignError } = await complaintAssignmentsQuery;
        
        console.log('[LGU_ADMIN] Assignments by complaint_id:', {
          count: complaintAssignments?.length || 0,
          error: complaintAssignError?.message
        });
        
        assignmentsByComplaint = complaintAssignments || [];
      }

      // Merge and deduplicate assignments (keep most recent if duplicate complaint_id)
      const allAssignments = [...assignmentsByComplaint, ...(deptAssignments || [])];
      console.log('[LGU_ADMIN] All assignments before dedup:', allAssignments.length);
      
      const assignmentsMap = {};
      allAssignments.forEach(assignment => {
        const existing = assignmentsMap[assignment.complaint_id];
        if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
          assignmentsMap[assignment.complaint_id] = assignment;
        }
      });

      const existingAssignments = Object.values(assignmentsMap);
      console.log('[LGU_ADMIN] Final assignments after dedup:', existingAssignments.length);

      // Get all unique complaint IDs from assignments
      const assignmentComplaintIds = [...new Set(existingAssignments.map(a => a.complaint_id).filter(Boolean))];
      
      // Fetch complaint details for assignments that weren't in the initial complaints list
      const existingComplaintIds = new Set(complaints.map(c => c.id));
      const missingComplaintIds = assignmentComplaintIds.filter(id => !existingComplaintIds.has(id));
      
      let allComplaints = [...complaints];
      if (missingComplaintIds.length > 0) {
        const { data: missingComplaints, error: missingError } = await supabase
          .from('complaints')
          .select('id, title, descriptive_su, location_text, submitted_at, submitted_by, department_r, workflow_status, priority')
          .in('id', missingComplaintIds);
        
        if (!missingError && missingComplaints) {
          allComplaints = [...complaints, ...missingComplaints];
        }
      }

      // Combine complaints with their assignments
      // IMPORTANT: Include ALL assignments found, even if complaint not in department_r
      const departmentAssignments = allComplaints
        .map(complaint => {
          const assignment = assignmentsMap[complaint.id];
          // Include if there's an assignment for this complaint
          if (assignment) {
            return {
              id: assignment.id,
              complaint_id: complaint.id,
              assigned_to: assignment.assigned_to || null,
              assigned_by: assignment.assigned_by || null,
              status: assignment.status,
              priority: assignment.priority || complaint.priority || 'medium',
              deadline: assignment.deadline || null,
              notes: assignment.notes || null,
              created_at: assignment.created_at || complaint.submitted_at,
              updated_at: assignment.updated_at || complaint.submitted_at,
              complaints: complaint
            };
          }
          // Also include complaints from department_r even if no assignment yet
          if (complaints.find(c => c.id === complaint.id)) {
            return {
              id: null,
              complaint_id: complaint.id,
              assigned_to: null,
              assigned_by: null,
              status: 'unassigned',
              priority: complaint.priority || 'medium',
              deadline: null,
              notes: null,
              created_at: complaint.submitted_at,
              updated_at: complaint.submitted_at,
              complaints: complaint
            };
          }
          return null;
        })
        .filter(Boolean); // Remove null entries
      
      console.log('[LGU_ADMIN] Final departmentAssignments count:', departmentAssignments.length);
      console.log('[LGU_ADMIN] Final departmentAssignments:', departmentAssignments.map(a => ({
        id: a.id,
        complaint_id: a.complaint_id,
        status: a.status,
        title: a.complaints?.title
      })));

      // Get officer information for assigned complaints
      const assignedOfficerIds = departmentAssignments
        .filter(a => a.assigned_to)
        .map(a => a.assigned_to);

      let officersMap = {};
      if (assignedOfficerIds && assignedOfficerIds.length > 0) {
        try {
          const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

          if (authError) {
            console.error('[LGU_ADMIN] Error fetching auth users for officers:', authError);
          } else if (authUsers?.users) {
            officersMap = authUsers.users
              .filter(u => assignedOfficerIds.includes(u.id))
              .reduce((acc, user) => {
                acc[user.id] = {
                  id: user.id,
                  name: user.user_metadata?.name || user.raw_user_meta_data?.name || user.email,
                  email: user.email
                };
                return acc;
              }, {});
          }
        } catch (authErr) {
          console.error('[LGU_ADMIN] Auth API error for officers:', authErr);
        }
      }

      // Get citizen information
      const citizenIds = [...new Set(departmentAssignments.map(a => a.complaints?.submitted_by).filter(Boolean))];
      let citizensMap = {};
      if (citizenIds && citizenIds.length > 0) {
        try {
          const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

          if (authError) {
            console.error('[LGU_ADMIN] Error fetching auth users for citizens:', authError);
          } else if (authUsers?.users) {
            citizensMap = authUsers.users
              .filter(u => citizenIds.includes(u.id))
              .reduce((acc, user) => {
                acc[user.id] = {
                  name: user.user_metadata?.name || user.raw_user_meta_data?.name || user.email
                };
                return acc;
              }, {});
          }
        } catch (authErr) {
          console.error('[LGU_ADMIN] Auth API error for citizens:', authErr);
        }
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

      console.log('[LGU_ADMIN] Final response data:', {
        departmentCode,
        departmentId: department?.id,
        totalComplaints: complaints?.length || 0,
        totalAssignments: formattedAssignments?.length || 0,
        sampleAssignment: formattedAssignments?.[0] || null
      });

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

      // Extract department from user metadata (check multiple possible field names)
      const departmentCode = req.user.department ||
                           req.user.metadata?.department ||
                           req.user.raw_user_meta_data?.department ||
                           req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        console.error('[LGU_ADMIN] No department found in user metadata:', {
          userRole,
          metadata: req.user.metadata,
          rawMetadata: req.user.raw_user_meta_data
        });
        return res.status(400).json({
          success: false,
          error: 'Department not specified in user metadata. Please contact administrator to set your department.',
          details: {
            userRole,
            hasMetadata: Boolean(req.user.metadata),
            hasRawMetadata: Boolean(req.user.raw_user_meta_data),
            metadataKeys: Object.keys(req.user.metadata || {}),
            rawMetadataKeys: Object.keys(req.user.raw_user_meta_data || {})
          }
        });
      }

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

      // Get all users and filter for LGU officers in this department
      // Use admin auth API to get users instead of direct table query
      let users = [];
      try {
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

        if (authError) {
          console.error('[LGU_ADMIN] Error fetching auth users:', authError);
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch users',
            details: authError.message
          });
        }

        users = authUsers.users || [];
        console.log('[LGU_ADMIN] Total auth users found:', users.length);
      } catch (authErr) {
        console.error('[LGU_ADMIN] Auth API error:', authErr);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch users via auth API',
          details: authErr.message
        });
      }

      console.log('[LGU_ADMIN] Scanning for officers in department:', departmentCode);
      console.log('[LGU_ADMIN] Total users found:', users.length);

      const officers = users
        .filter(user => {
          const metadata = user.user_metadata || {};
          const rawMetadata = user.raw_user_meta_data || {};
          const role = metadata.role || rawMetadata.role || '';

          // Debug logging for each user
          console.log('[LGU_ADMIN] Checking user:', {
            id: user.id,
            email: user.email,
            role,
            metadata,
            rawMetadata,
            hasDpt: Boolean(metadata.dpt || rawMetadata.dpt),
            dptValue: metadata.dpt || rawMetadata.dpt
          });

          // Check for simplified role system: lgu with department in metadata, or lgu-admin
          const isLguOfficer = role === 'lgu' || role === 'lgu-officer' || role === 'lgu-admin';
          const hasCorrectDepartment = (metadata.dpt === departmentCode) ||
                                      (rawMetadata.dpt === departmentCode) ||
                                      (metadata.department === departmentCode) ||
                                      (rawMetadata.department === departmentCode);

          // Check for legacy role system: lgu-{departmentCode} including lgu-admin-{departmentCode}
          const isLegacyOfficer = /^lgu-(?!hr)/.test(role);
          const roleContainsDepartment = role.includes(`-${departmentCode}`);
          const hasLegacyDepartment = metadata.department === departmentCode || rawMetadata.department === departmentCode;

          const isMatch = (isLguOfficer && hasCorrectDepartment) ||
                         (isLegacyOfficer && (roleContainsDepartment || hasLegacyDepartment));

          // TEMPORARY: Allow any LGU user for testing (excluding HR)
          const isAnyLguUser = (role === 'lgu' || role === 'lgu-officer' || role === 'lgu-admin' || /^lgu-(?!hr)/.test(role));
          const finalMatch = isMatch || isAnyLguUser;

          if (finalMatch) {
            console.log('[LGU_ADMIN] Found matching officer:', {
              id: user.id,
              email: user.email,
              role,
              department: metadata.dpt || rawMetadata.dpt,
              isMatch,
              isAnyLguUser,
              finalMatch
            });
          }

          return finalMatch;
        })
        .map(user => ({
          id: user.id,
          name: user.user_metadata?.name || user.raw_user_meta_data?.name || user.email,
          email: user.email,
          employee_id: user.user_metadata?.employee_id || user.raw_user_meta_data?.employee_id,
          mobile: user.user_metadata?.mobile || user.raw_user_meta_data?.mobile
        }));

      console.log('[LGU_ADMIN] Officers response:', {
        departmentCode,
        departmentId: department?.id,
        totalOfficers: officers?.length || 0,
        sampleOfficer: officers?.[0] || null
      });

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

      // Extract department from user metadata (check multiple possible field names)
      const departmentCode = req.user.department ||
                           req.user.metadata?.department ||
                           req.user.raw_user_meta_data?.department ||
                           req.user.raw_user_meta_data?.dpt;

      if (!departmentCode) {
        console.error('[LGU_ADMIN] No department found in user metadata:', {
          userRole,
          metadata: req.user.metadata,
          rawMetadata: req.user.raw_user_meta_data
        });
        return res.status(400).json({
          success: false,
          error: 'Department not specified in user metadata. Please contact administrator to set your department.',
          details: {
            userRole,
            hasMetadata: Boolean(req.user.metadata),
            hasRawMetadata: Boolean(req.user.raw_user_meta_data),
            metadataKeys: Object.keys(req.user.metadata || {}),
            rawMetadataKeys: Object.keys(req.user.raw_user_meta_data || {})
          }
        });
      }

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
            department_id: department.id, // Ensure department_id is set on update too
            priority: priority || 'medium',
            deadline: deadline || null,
            notes: notes || null,
            status: 'assigned', // Changed from 'active' to 'assigned' to match table schema
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
            department_id: department.id, // Set department ID (bigint) for proper data tracking - matches departments.id type
            priority: priority || 'medium',
            deadline: deadline || null,
            notes: notes || null,
            status: 'assigned' // Changed from 'active' to 'assigned' to match table schema
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

      await notificationService.notifyTaskAssigned(
        officerId,
        complaintId,
        complaint?.title || 'a complaint',
        notificationPriority,
        deadline
      );

      // Notify citizen that their complaint was assigned
      if (complaint?.submitted_by) {
        await notificationService.notifyComplaintAssignedToOfficer(
          complaint.submitted_by,
          complaintId,
          complaint.title,
          { officer_count: 1, department: departmentCode }
        ).catch(notifError => {
          console.warn('[LGU_ADMIN] Failed to notify citizen:', notifError.message);
        });
      }

      // Send confirmation notification to the admin who made the assignment
      await notificationService.createNotification(
        userId,
        NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
        'Assignment Completed',
        `You successfully assigned "${complaint?.title || 'a complaint'}" to an officer.`,
        {
          priority: NOTIFICATION_PRIORITY.INFO,
          link: `/lgu-admin/assignments`,
          metadata: {
            complaint_id: complaintId,
            assigned_officer_id: officerId,
            assignment_id: assignment.id
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
          error: 'Officer ID, complaint ID, and reminder type are required'
        });
      }

      // Use CoordinatorService to send the reminder
      const CoordinatorService = require('../services/CoordinatorService');
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
      console.error('[LGU_ADMIN] Send officer reminder error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send reminder'
      });
    }
  }

  /**
   * Get pending assignments summary
   */
  async getPendingAssignmentsSummary(req, res) {
    try {
      // Use CoordinatorService to get summary
      const CoordinatorService = require('../services/CoordinatorService');
      const coordinatorService = new CoordinatorService();

      const result = await coordinatorService.getPendingAssignmentsSummary();

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('[LGU_ADMIN] Get pending assignments summary error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get pending assignments summary'
      });
    }
  }

  /**
   * Get officers needing attention
   */
  async getOfficersNeedingAttention(req, res) {
    try {
      const { data: assignments, error } = await supabase
        .from('complaint_assignments')
        .select(`
          *,
          complaints!inner(id, title, workflow_status, submitted_at, priority),
          departments(id, code, name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

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
            complaints: []
          };
        }

        officerGroups[officerId].assignments_count++;

        // Check if overdue (7+ days)
        const daysSinceAssignment = Math.floor(
          (Date.now() - new Date(assignment.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceAssignment > 7) {
          officerGroups[officerId].overdue_count++;
        }

        officerGroups[officerId].complaints.push({
          id: assignment.complaints.id,
          title: assignment.complaints.title,
          priority: assignment.complaints.priority,
          assigned_days_ago: daysSinceAssignment,
          is_overdue: daysSinceAssignment > 7
        });
      }

      // Filter officers who need attention (have overdue items or many pending items)
      for (const officerId in officerGroups) {
        const officer = officerGroups[officerId];
        if (officer.overdue_count > 0 || officer.assignments_count > 3) {
          // Get officer details using admin auth API
          try {
            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

            if (authError) {
              console.error('[LGU_ADMIN] Error fetching auth users for officer details:', authError);
              continue;
            }

            const officerData = authUsers?.users?.find(u => u.id === officerId);

            if (officerData) {
              officersNeedingAttention.push({
                ...officer,
                name: officerData.user_metadata?.name ||
                      officerData.raw_user_meta_data?.name ||
                      officerData.email ||
                      'Unknown Officer',
                email: officerData.email
              });
            }
          } catch (authErr) {
            console.error('[LGU_ADMIN] Auth API error for officer details:', authErr);
            // Continue without officer details
            officersNeedingAttention.push({
              ...officer,
              name: 'Unknown Officer',
              email: 'N/A'
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          total_officers_needing_attention: officersNeedingAttention.length,
          officers: officersNeedingAttention
        }
      });
    } catch (error) {
      console.error('[LGU_ADMIN] Get officers needing attention error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get officers needing attention'
      });
    }
  }
}
module.exports = LguAdminController;
