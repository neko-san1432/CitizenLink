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
   * Get department queue
   * Returns complaints assigned to the admin's department
   */
  async getDepartmentQueue(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { status, priority, limit } = req.query;

      // Debug logging to see what we're receiving
      console.log('[LGU_ADMIN] Request received:', {
        userId,
        userRole,
        department: req.user.department,
        metadata: req.user.metadata,
        rawMetadata: req.user.raw_user_meta_data,
        path: req.path
      });

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
            hasMetadata: !!req.user.metadata,
            hasRawMetadata: !!req.user.raw_user_meta_data,
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
            .eq('complaint_id', complaint.id)
            .eq('department_id', department.id);

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
      const { complaintId } = req.params;
      const { officerIds, officerId, priority, deadline, notes } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;
      
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
      const assignmentGroupId = require('crypto').randomUUID();
      const assignmentType = officersToAssign.length > 1 ? 'multi' : 'single';

      // Create assignment records for each officer
      const assignments = [];
      for (let i = 0; i < officersToAssign.length; i++) {
        const officerId = officersToAssign[i];
        
        // Verify officer exists and belongs to this department
        const { data: officerData, error: officerError } = await supabase.auth.admin.getUserById(officerId);
        
        if (officerError || !officerData?.user) {
          console.error('[LGU_ADMIN] Officer not found:', { officerId, error: officerError });
          continue; // Skip this officer but continue with others
        }
        
        const officer = officerData.user;

        // Debug: Log officer metadata structure
        console.log('[LGU_ADMIN] Officer metadata debug:', {
          officerId,
          officerEmail: officer.email,
          raw_user_meta_data: officer.raw_user_meta_data,
          user_metadata: officer.user_metadata,
          app_metadata: officer.app_metadata
        });

        // Check if officer belongs to this department
        const officerDept = officer.raw_user_meta_data?.dpt || 
                           officer.raw_user_meta_data?.department ||
                           officer.user_metadata?.dpt ||
                           officer.user_metadata?.department ||
                           officer.app_metadata?.dpt ||
                           officer.app_metadata?.department;
        
        console.log('[LGU_ADMIN] Officer department extraction:', {
          officerId,
          officerDept,
          departmentCode,
          matches: officerDept === departmentCode
        });
        
        if (officerDept !== departmentCode) {
          console.error('[LGU_ADMIN] Officer does not belong to department:', { officerId, officerDept, departmentCode });
          continue; // Skip this officer but continue with others
        }

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
        return res.status(400).json({
          success: false,
          error: 'No valid officers found for assignment'
        });
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
          notificationService.createNotification(
            assignment.assigned_to,
            'task_assigned',
            'New Task Assigned',
            `You've been assigned complaint: "${updatedComplaint.title}"${officersToAssign.length > 1 ? ' (Multi-officer assignment)' : ''}`,
            {
              priority: priority === 'urgent' ? 'urgent' : 'info',
              link: `/lgu-officer/tasks/${complaintId}`,
              metadata: {
                complaint_id: complaintId,
                priority: priority || 'medium',
                deadline: deadline || null,
                assignment_group_id: assignmentGroupId,
                officer_order: assignment.officer_order,
                total_officers: officersToAssign.length
              }
            }
          ).catch(notifError => {
            console.warn('[LGU_ADMIN] Failed to notify officer:', notifError.message);
          })
        );
      }

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
      res.status(500).json({
        success: false,
        error: 'Failed to assign complaint to officer'
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
      console.log('[LGU_ADMIN] Request received:', {
        userId,
        userRole,
        department: req.user.department,
        metadata,
        rawMetadata: req.user.raw_user_meta_data,
        path: req.path,
        fullUserObject: req.user
      });

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
        'departmentCode truthy': !!departmentCode,
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
              hasMetadata: !!req.user.metadata,
              hasRawMetadata: !!req.user.raw_user_meta_data,
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

      console.log('[LGU_ADMIN] Final response data:', {
        departmentCode,
        departmentId: department?.id,
        totalComplaints: departmentComplaints?.length || 0,
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
            hasMetadata: !!req.user.metadata,
            hasRawMetadata: !!req.user.raw_user_meta_data,
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
      const { data: allUsers } = await supabase.auth.admin.listUsers();

      console.log('[LGU_ADMIN] Scanning for officers in department:', departmentCode);
      console.log('[LGU_ADMIN] Total users found:', allUsers.users.length);

      const officers = allUsers.users
        .filter(user => {
          const metadata = user.user_metadata || {};
          const rawMetadata = user.raw_user_meta_data || {};
          const role = metadata.role || rawMetadata.role || '';
          
          // Debug logging for each user
          console.log('[LGU_ADMIN] Checking user:', {
            id: user.id,
            email: user.email,
            role: role,
            metadata: metadata,
            rawMetadata: rawMetadata,
            hasDpt: !!(metadata.dpt || rawMetadata.dpt),
            dptValue: metadata.dpt || rawMetadata.dpt
          });
          
          // Check for simplified role system: lgu with department in metadata
          const isLguOfficer = role === 'lgu' || role === 'lgu-officer';
          const hasCorrectDepartment = (metadata.dpt === departmentCode) || 
                                      (rawMetadata.dpt === departmentCode) ||
                                      (metadata.department === departmentCode) ||
                                      (rawMetadata.department === departmentCode);
          
          // Check for legacy role system: lgu-{departmentCode}
          const isLegacyOfficer = /^lgu-(?!admin|hr)/.test(role);
          const roleContainsDepartment = role.includes(`-${departmentCode}`);
          const hasLegacyDepartment = metadata.department === departmentCode || rawMetadata.department === departmentCode;

          const isMatch = (isLguOfficer && hasCorrectDepartment) || 
                         (isLegacyOfficer && (roleContainsDepartment || hasLegacyDepartment));
          
          if (isMatch) {
            console.log('[LGU_ADMIN] Found matching officer:', {
              id: user.id,
              email: user.email,
              role: role,
              department: metadata.dpt || rawMetadata.dpt
            });
          }
          
          return isMatch;
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
            hasMetadata: !!req.user.metadata,
            hasRawMetadata: !!req.user.raw_user_meta_data,
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
            department_id: null, // Department is tracked via complaint.department_r
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

module.exports = LguAdminController;
