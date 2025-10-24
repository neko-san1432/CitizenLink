const ComplaintRepository = require('../repositories/ComplaintRepository');
const ComplaintAssignmentRepository = require('../repositories/ComplaintAssignmentRepository');
const DepartmentRepository = require('../repositories/DepartmentRepository');
const Complaint = require('../models/Complaint');
const NotificationService = require('./NotificationService');
const { normalizeComplaintData, prepareComplaintForInsert, validateComplaintConsistency } = require('../utils/complaintUtils');

class ComplaintService {
  constructor() {
    this.complaintRepo = new ComplaintRepository();
    this.assignmentRepo = new ComplaintAssignmentRepository();
    this.departmentRepo = new DepartmentRepository();
    this.notificationService = new NotificationService();
  }

  async createComplaint(userId, complaintData, files = []) {
    // Parse department_r - handle both array and individual values
    let departments = complaintData.department_r || [];
    
    // If department_r is a string, try to parse as JSON
    if (typeof departments === 'string') {
      try {
        departments = JSON.parse(departments);
      } catch (e) {
        console.warn('[COMPLAINT] Failed to parse department_r JSON:', e);
        departments = [];
      }
    }
    
    // If department_r is not an array, convert it to array
    if (!Array.isArray(departments)) {
      departments = [departments].filter(Boolean);
    }

    // console.log removed for security

    // Map client field names to server field names
    const mappedData = {
      ...complaintData,
      submitted_by: userId,
      // All submissions are complaints - no need for user to choose type
      type: 'complaint',
      // Map 'description' from client to 'descriptive_su' expected by server model
      descriptive_su: complaintData.description || complaintData.descriptive_su,
      // Map 'departments' to 'department_r' for database
      department_r: departments
    };

    // Prepare data for insertion using utility functions
    const preparedData = prepareComplaintForInsert(mappedData);
    
    // Debug: Log what fields are being sent to database
    console.log('[COMPLAINT_SERVICE] Fields being sent to database:', Object.keys(preparedData));
    
    // Validate data consistency
    const consistencyCheck = validateComplaintConsistency(preparedData);
    if (!consistencyCheck.isValid) {
      console.warn('[COMPLAINT] Data consistency issues:', consistencyCheck.errors);
    }

    const complaint = new Complaint(preparedData);

    const validation = Complaint.validate(complaint);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedData = complaint.sanitizeForInsert();
    const createdComplaint = await this.complaintRepo.create(sanitizedData);

    // console.log removed for security

    try {
      await this._processWorkflow(createdComplaint, departments);
      await this._processFileUploads(createdComplaint.id, files, userId);

      // Send notification to citizen
      try {
        await this.notificationService.notifyComplaintSubmitted(
          userId,
          createdComplaint.id,
          createdComplaint.title
        );
      } catch (notifError) {
        console.warn('[COMPLAINT] Failed to send submission notification:', notifError.message);
      }

      const finalComplaint = await this.complaintRepo.findById(createdComplaint.id);
      return finalComplaint;
    } catch (error) {
      console.warn('Post-creation processing failed:', error.message);
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
          updated_at: new Date().toISOString()
        });
        // console.log removed for security
        // Create complaint_assignments for primary and secondary departments
        for (const deptCode of departmentArray) {
          try {
            const dept = await this.departmentRepo.findByCode(deptCode);
            if (dept && dept.id) {
              await this.assignmentRepo.assign(
                complaint.id,
                dept.id,
                complaint.submitted_by,
                { status: 'pending' }
              );
              // Notify department admins about new assignment
              try {
                await this.notificationService.notifyDepartmentAdminsByCode(
                  deptCode,
                  complaint.id,
                  complaint.title
                );
              } catch (notifErr) {
                console.warn('[WORKFLOW] Notify admins failed:', notifErr.message);
              }
            }
          } catch (assignErr) {
            console.warn('[WORKFLOW] Assignment creation failed for dept:', deptCode, assignErr.message);
          }
        }
      } catch (error) {
        console.warn('[WORKFLOW] Department assignment failed:', error.message);
      }
    }

    // Auto-assignment based on complaint content (type field removed)
    try {
      const autoAssignResult = await this.complaintRepo.autoAssignDepartments(complaint.id);
      if (autoAssignResult && autoAssignResult.length > 0) {
        // console.log removed for security
      }
    } catch (error) {
      console.warn('[WORKFLOW] Auto-assignment failed:', error.message);
    }

    if (departmentArray.length > 0) {
      const targetDept = departmentArray[0];
      try {
        const coordinator = await this.complaintRepo.findActiveCoordinator(targetDept);
        if (coordinator) {
          await this.complaintRepo.assignCoordinator(complaint.id, coordinator.user_id);
          await this.complaintRepo.logAction(complaint.id, 'coordinator_assigned', {
            to_dept: targetDept,
            reason: 'Auto-assigned available coordinator'
          });
          // console.log removed for security
        }
      } catch (error) {
        console.warn('[WORKFLOW] Coordinator assignment failed:', error.message);
      }
    }

    try {
      await this.complaintRepo.logAction(complaint.id, 'created', {
        reason: 'Complaint submitted by citizen',
        details: {
          title: complaint.title,
          departments: departmentArray,
          has_evidence: false
        }
      });
    } catch (error) {
      console.warn('[WORKFLOW] Audit logging failed:', error.message);
    }
  }

  async _processFileUploads(complaintId, files, userId = null) {
    if (!files || files.length === 0) {
      return [];
    }

    // Use the same Database instance to ensure consistent client
    const Database = require('../config/database');
    const db = new Database();
    const supabase = db.getClient();

    const evidenceFiles = [];
    for (const file of files) {
      try {
        const fileName = `${complaintId}/${Date.now()}-${file.originalname}`;

        // Upload file to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('complaint-evidence')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('[FILE] Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('complaint-evidence')
          .getPublicUrl(fileName);

        evidenceFiles.push({
          fileName: file.originalname,
          filePath: uploadData.path,
          fileType: file.mimetype,
          fileSize: file.size,
          publicUrl: publicUrl
        });

        // console.log removed for security
      } catch (error) {
        console.error('[FILE] Processing error:', error);
      }
    }

    if (evidenceFiles.length > 0) {
      await this.complaintRepo.updateEvidence(complaintId, evidenceFiles, userId);
    }

    return evidenceFiles;
  }

  async addEvidence(complaintId, files, userId = null) {
    return this._processFileUploads(complaintId, files, userId);
  }

  async getComplaintById(id, userId = null) {
    const complaint = await this.complaintRepo.findById(id);
    if (!complaint) {
      throw new Error('Complaint not found');
    }

    if (userId && complaint.submitted_by !== userId) {
      throw new Error('Access denied');
    }

    return complaint;
  }

  async getUserComplaints(userId, options = {}) {
    return this.complaintRepo.findByUserId(userId, options);
  }

  async getUserStatistics(userId) {
    try {
      const supabase = this.complaintRepo.supabase;
      
      // Get total complaints count
      const { count: totalComplaints, error: totalError } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('submitted_by', userId);

      if (totalError) throw totalError;

      // Get complaints by workflow_status
      const { data: statusData, error: statusError } = await supabase
        .from('complaints')
        .select('workflow_status')
        .eq('submitted_by', userId);

      if (statusError) throw statusError;

      // Count by workflow_status
      const statusCounts = statusData.reduce((acc, complaint) => {
        acc[complaint.workflow_status] = (acc[complaint.workflow_status] || 0) + 1;
        return acc;
      }, {});

      // Get complaints by category (more meaningful than type)
      const { data: categoryData, error: categoryError } = await supabase
        .from('complaints')
        .select('category')
        .eq('submitted_by', userId);

      if (categoryError) throw categoryError;

      // Count by category
      const categoryCounts = categoryData.reduce((acc, complaint) => {
        const category = complaint.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentComplaints, error: recentError } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('submitted_by', userId)
        .gte('submitted_at', thirtyDaysAgo.toISOString());

      if (recentError) throw recentError;

      return {
        totalComplaints: totalComplaints || 0,
        recentComplaints: recentComplaints || 0,
        statusCounts,
        categoryCounts, // Changed from typeCounts to categoryCounts
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] Error fetching user statistics:', error);
      throw error;
    }
  }

  async getAllComplaints(options = {}) {
    return this.complaintRepo.findAll(options);
  }

  async updateComplaintStatus(id, workflowStatus, notes = null, userId = null) {
    const complaint = await this.getComplaintById(id);

    const validStatuses = ['new', 'assigned', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(workflowStatus)) {
      throw new Error('Invalid workflow status');
    }

    const updatedComplaint = await this.complaintRepo.updateStatus(id, workflowStatus, notes);

    try {
      await this.complaintRepo.logAction(id, 'status_updated', {
        reason: `Workflow status changed to ${workflowStatus}`,
        details: { old_status: complaint.workflow_status, new_status: workflowStatus, notes }
      });
    } catch (error) {
      console.warn('[AUDIT] Status update logging failed:', error.message);
    }

    // Send notification to citizen if status changed
    if (complaint.workflow_status !== workflowStatus) {
      try {
        await this.notificationService.notifyComplaintStatusChanged(
          complaint.submitted_by,
          id,
          complaint.title,
          workflowStatus,
          complaint.workflow_status
        );
      } catch (notifError) {
        console.warn('[COMPLAINT] Failed to send status change notification:', notifError.message);
      }
    }

    return updatedComplaint;
  }

  async assignCoordinator(complaintId, coordinatorId, assignedBy) {
    const complaint = await this.getComplaintById(complaintId);
    const updatedComplaint = await this.complaintRepo.assignCoordinator(complaintId, coordinatorId);

    try {
      await this.complaintRepo.logAction(complaintId, 'coordinator_assigned', {
        reason: 'Manually assigned by admin',
        details: { assigned_by: assignedBy, coordinator_id: coordinatorId }
      });
    } catch (error) {
      console.warn('[AUDIT] Coordinator assignment logging failed:', error.message);
    }

    return updatedComplaint;
  }

  async transferComplaint(complaintId, fromDept, toDept, reason, transferredBy) {
    const complaint = await this.getComplaintById(complaintId);

    const updatedComplaint = await this.complaintRepo.update(complaintId, {
      // primary_department: toDept, // Removed - derived from department_r
      assigned_coordinator_id: null
    });

    try {
      const newCoordinator = await this.complaintRepo.findActiveCoordinator(toDept);
      if (newCoordinator) {
        await this.complaintRepo.assignCoordinator(complaintId, newCoordinator.user_id);
      }
    } catch (error) {
      console.warn('[TRANSFER] New coordinator assignment failed:', error.message);
    }

    try {
      await this.complaintRepo.logAction(complaintId, 'transferred', {
        reason,
        details: {
          from_dept: fromDept,
          to_dept: toDept,
          transferred_by: transferredBy
        }
      });
    } catch (error) {
      console.warn('[AUDIT] Transfer logging failed:', error.message);
    }

    return updatedComplaint;
  }

  async getComplaintStats(filters = {}) {
    const { department, dateFrom, dateTo } = filters;

    let query = this.complaintRepo.supabase
      .from('complaints')
      .select('workflow_status, type, priority, submitted_at');

    if (department) {
      query = query.contains('department_r', [department]);
    }

    if (dateFrom) {
      query = query.gte('submitted_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('submitted_at', dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      total: data.length,
      by_status: {},
      by_type: {},
      by_priority: {},
      by_month: {}
    };

    data.forEach(complaint => {
      stats.by_status[complaint.workflow_status] = (stats.by_status[complaint.workflow_status] || 0) + 1;
      stats.by_priority[complaint.priority] = (stats.by_priority[complaint.priority] || 0) + 1;

      const month = new Date(complaint.submitted_at).toISOString().slice(0, 7);
      stats.by_month[month] = (stats.by_month[month] || 0) + 1;
    });

    return stats;
  }

  async getComplaintLocations(filters = {}) {
    // console.log removed for security

    const {
      status,
      type,
      category,
      subcategory,
      department,
      startDate,
      endDate,
      includeResolved = true
    } = filters;

    try {
      let query = this.complaintRepo.supabase
        .from('complaints')
        .select('id, title, type, workflow_status, priority, latitude, longitude, location_text, submitted_at, department_r')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Filter by workflow_status
      if (status) {
        query = query.eq('workflow_status', status);
      } else if (!includeResolved) {
        query = query.neq('workflow_status', 'completed').neq('workflow_status', 'cancelled');
      }

      // Filter by type
      if (type) {
        query = query.eq('type', type);
      }

      // Filter by department
      if (department) {
        query = query.contains('department_r', [department]);
      }

      // Filter by category and subcategory (if complaint has these fields)
      if (category || subcategory) {
        // For now, we'll filter by type as a proxy for category
        // This would need to be updated when complaints table has category/subcategory fields
        if (category) {
          // Map category to complaint types for now
          const categoryTypeMapping = {
            'infrastructure': 'infrastructure',
            'health': 'health',
            'environmental': 'environmental',
            'social': 'social',
            'safety': 'public-safety'
          };
          const mappedType = categoryTypeMapping[category];
          if (mappedType) {
            query = query.eq('type', mappedType);
          }
        }
      }

      // Filter by date range
      if (startDate) {
        query = query.gte('submitted_at', startDate);
      }

      if (endDate) {
        query = query.lte('submitted_at', endDate);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[COMPLAINT-SERVICE] Database error:', error);
        throw error;
      }

      // console.log removed for security

      // Transform data for heatmap
      const transformedData = data.map(complaint => ({
        id: complaint.id,
        title: complaint.title,
        status: complaint.workflow_status,
        priority: complaint.priority,
        lat: parseFloat(complaint.latitude),
        lng: parseFloat(complaint.longitude),
        location: complaint.location_text,
        submittedAt: complaint.submitted_at,
        department: complaint.department_r && complaint.department_r.length > 0 ? complaint.department_r[0] : 'Unknown',
        departments: complaint.department_r || [],
        secondaryDepartments: complaint.department_r && complaint.department_r.length > 1 ? complaint.department_r.slice(1) : []
      }));

      // console.log removed for security
      return transformedData;
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] getComplaintLocations error:', error);
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
        throw new Error('Complaint not found');
      }

      if (complaint.submitted_by !== userId) {
        throw new Error('Not authorized to cancel this complaint');
      }

      // Check if complaint can be cancelled
      const cancellableStatuses = ['new', 'assigned', 'in_progress'];
      if (!cancellableStatuses.includes(complaint.workflow_status)) {
        throw new Error('Complaint cannot be cancelled in its current status');
      }

      // Update complaint status
      const { data: updatedComplaint, error: updateError } = await this.complaintRepo.supabase
        .from('complaints')
        .update({
          workflow_status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: reason,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to cancel complaint');
      }

      // Notify relevant parties
      try {
        // Notify coordinator if assigned
        if (complaint.assigned_coordinator_id) {
          await this.notificationService.createNotification(
            complaint.assigned_coordinator_id,
            'complaint_cancelled',
            'Complaint Cancelled',
            `Complaint "${complaint.title}" has been cancelled by the citizen.`,
            {
              priority: 'info',
              link: `/coordinator/review-queue`,
              metadata: { complaint_id: complaintId, reason }
            }
          );
        }

        // Notify assigned departments
        const departments = complaint.department_r || [];
        for (const deptCode of departments) {
          try {
            const { data: dept } = await this.complaintRepo.supabase
              .from('departments')
              .select('id')
              .eq('code', deptCode)
              .single();

            if (dept) {
              // Get department admins and notify them
              const { data: assignments } = await this.complaintRepo.supabase
                .from('complaint_assignments')
                .select('assigned_by')
                .eq('complaint_id', complaintId)
                .eq('department_id', dept.id);

              for (const assignment of assignments || []) {
                if (assignment.assigned_by) {
                  await this.notificationService.createNotification(
                    assignment.assigned_by,
                    'complaint_cancelled',
                    'Complaint Cancelled',
                    `Complaint "${complaint.title}" has been cancelled by the citizen.`,
                    {
                      priority: 'info',
                      link: `/lgu-admin/department-queue`,
                      metadata: { complaint_id: complaintId, reason }
                    }
                  );
                }
              }
            }
          } catch (deptError) {
            console.warn('[COMPLAINT-SERVICE] Failed to notify department:', deptError.message);
          }
        }
      } catch (notifError) {
        console.warn('[COMPLAINT-SERVICE] Failed to send cancellation notifications:', notifError.message);
      }

      return updatedComplaint;
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] Cancel complaint error:', error);
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
        throw new Error('Complaint not found');
      }

      if (complaint.submitted_by !== userId) {
        throw new Error('Not authorized to send reminder for this complaint');
      }

      // Check if reminder can be sent (not cancelled, closed, or resolved)
      const reminderBlockedStatuses = ['cancelled', 'completed'];
      if (reminderBlockedStatuses.includes(complaint.workflow_status)) {
        throw new Error('Cannot send reminder for complaint in current status');
      }

      // Check cooldown period (24 hours)
      const { data: lastReminder } = await this.complaintRepo.supabase
        .from('complaint_reminders')
        .select('reminded_at')
        .eq('complaint_id', complaintId)
        .order('reminded_at', { ascending: false })
        .limit(1)
        .single();

      if (lastReminder) {
        const lastReminderTime = new Date(lastReminder.reminded_at);
        const now = new Date();
        const hoursSinceLastReminder = (now - lastReminderTime) / (1000 * 60 * 60);

        if (hoursSinceLastReminder < 24) {
          const remainingHours = Math.ceil(24 - hoursSinceLastReminder);
          throw new Error(`Please wait ${remainingHours} more hours before sending another reminder`);
        }
      }

      // Create reminder record
      const { data: reminder, error: reminderError } = await this.complaintRepo.supabase
        .from('complaint_reminders')
        .insert({
          complaint_id: complaintId,
          reminded_by: userId,
          reminder_type: 'manual',
          reminded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (reminderError) {
        throw new Error('Failed to create reminder record');
      }

      // Notify assigned departments/officers
      try {
        const { data: assignments } = await this.complaintRepo.supabase
          .from('complaint_assignments')
          .select('assigned_to, assigned_by, department_id')
          .eq('complaint_id', complaintId);

        for (const assignment of assignments || []) {
          // Notify assigned officer
          if (assignment.assigned_to) {
            await this.notificationService.createNotification(
              assignment.assigned_to,
              'complaint_reminder',
              'Complaint Reminder',
              `Citizen has sent a reminder for complaint: "${complaint.title}"`,
              {
                priority: 'warning',
                link: `/lgu-officer/tasks/${complaintId}`,
                metadata: { complaint_id: complaintId }
              }
            );
          }

          // Notify department admin
          if (assignment.assigned_by) {
            await this.notificationService.createNotification(
              assignment.assigned_by,
              'complaint_reminder',
              'Complaint Reminder',
              `Citizen has sent a reminder for complaint: "${complaint.title}"`,
              {
                priority: 'warning',
                link: `/lgu-admin/department-queue`,
                metadata: { complaint_id: complaintId }
              }
            );
          }
        }
      } catch (notifError) {
        console.warn('[COMPLAINT-SERVICE] Failed to send reminder notifications:', notifError.message);
      }

      return reminder;
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] Send reminder error:', error);
      throw error;
    }
  }

  /**
   * Confirm resolution
   */
  async confirmResolution(complaintId, userId, confirmed, feedback) {
    try {
      // Get complaint and verify ownership
      const complaint = await this.complaintRepo.getComplaintById(complaintId);
      
      if (!complaint) {
        throw new Error('Complaint not found');
      }

      if (complaint.submitted_by !== userId) {
        throw new Error('Not authorized to confirm resolution for this complaint');
      }

      // Check if complaint is in resolved status
      if (complaint.workflow_status !== 'completed') {
        throw new Error('Complaint must be completed by officer before citizen can confirm');
      }

      // Update complaint status
      const newStatus = confirmed ? 'confirmed by citizen' : 'reopened';
      const newWorkflowStatus = confirmed ? 'completed' : 'in_progress';

      const { data: updatedComplaint, error: updateError } = await this.complaintRepo.supabase
        .from('complaints')
        .update({
          workflow_status: newWorkflowStatus,
          confirmed_by_citizen: confirmed,
          citizen_confirmation_date: confirmed ? new Date().toISOString() : null,
          citizen_feedback: feedback || null,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to update complaint status');
      }

      // Notify relevant parties
      try {
        if (confirmed) {
          // Notify officer who resolved it
          if (complaint.resolved_by) {
            await this.notificationService.createNotification(
              complaint.resolved_by,
              'resolution_confirmed',
              'Resolution Confirmed',
              `Citizen has confirmed the resolution of complaint: "${complaint.title}"`,
              {
                priority: 'success',
                link: `/lgu-officer/tasks`,
                metadata: { complaint_id: complaintId, feedback }
              }
            );
          }

          // Notify department admin
          const { data: assignments } = await this.complaintRepo.supabase
            .from('complaint_assignments')
            .select('assigned_by')
            .eq('complaint_id', complaintId)
            .limit(1)
            .single();

          if (assignments?.assigned_by) {
            await this.notificationService.createNotification(
              assignments.assigned_by,
              'resolution_confirmed',
              'Resolution Confirmed',
              `Citizen has confirmed the resolution of complaint: "${complaint.title}"`,
              {
                priority: 'success',
                link: `/lgu-admin/department-queue`,
                metadata: { complaint_id: complaintId, feedback }
              }
            );
          }
        } else {
          // Notify officer that resolution was rejected
          if (complaint.resolved_by) {
            await this.notificationService.createNotification(
              complaint.resolved_by,
              'resolution_rejected',
              'Resolution Rejected',
              `Citizen has rejected the resolution of complaint: "${complaint.title}". Feedback: ${feedback || 'No feedback provided'}`,
              {
                priority: 'warning',
                link: `/lgu-officer/tasks/${complaintId}`,
                metadata: { complaint_id: complaintId, feedback }
              }
            );
          }
        }
      } catch (notifError) {
        console.warn('[COMPLAINT-SERVICE] Failed to send confirmation notifications:', notifError.message);
      }

      return updatedComplaint;
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] Confirm resolution error:', error);
      throw error;
    }
  }

  /**
   * Get normalized complaint data with derived fields
   * @param {string} complaintId - Complaint ID
   * @returns {Object} Normalized complaint data
   */
  async getNormalizedComplaint(complaintId) {
    try {
      const complaint = await this.complaintRepo.findById(complaintId);
      if (!complaint) {
        return null;
      }
      
      return normalizeComplaintData(complaint);
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] Error getting normalized complaint:', error);
      throw error;
    }
  }

  /**
   * Get all complaints with normalized data
   * @param {Object} filters - Filter options
   * @returns {Array} Array of normalized complaint data
   */
  async getNormalizedComplaints(filters = {}) {
    try {
      const complaints = await this.complaintRepo.findAll(filters);
      return complaints.map(complaint => normalizeComplaintData(complaint));
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] Error getting normalized complaints:', error);
      throw error;
    }
  }

  /**
   * Mark a complaint as false
   * @param {string} complaintId - Complaint ID
   * @param {string} coordinatorId - Coordinator marking as false
   * @param {string} reason - Reason for marking as false
   * @returns {Promise<Object>} Result object
   */
  async markAsFalseComplaint(complaintId, coordinatorId, reason) {
    try {
      // Get complaint
      const complaint = await this.complaintRepo.findById(complaintId);
      if (!complaint) {
        return {
          success: false,
          error: 'Complaint not found'
        };
      }

      // Check if already marked as false
      if (complaint.is_false_complaint) {
        return {
          success: false,
          error: 'Complaint is already marked as false'
        };
      }

      // Update complaint
      const updatedComplaint = await this.complaintRepo.update(complaintId, {
        is_false_complaint: true,
        false_complaint_reason: reason,
        false_complaint_marked_by: coordinatorId,
        false_complaint_marked_at: new Date().toISOString(),
        workflow_status: 'rejected_false'
      });

      // Log audit
      await this.auditRepo.logAction(
        'complaint_marked_false',
        coordinatorId,
        'complaint',
        complaintId,
        {
          reason: reason,
          previous_status: complaint.workflow_status
        }
      );

      return {
        success: true,
        data: updatedComplaint,
        message: 'Complaint marked as false successfully'
      };

    } catch (error) {
      console.error('Error marking complaint as false:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get false complaint statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getFalseComplaintStatistics() {
    try {
      const Database = require('../config/database');
      const supabase = Database.getClient();

      const { data, error } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .eq('is_false_complaint', true);

      if (error) throw error;

      return {
        success: true,
        data: {
          total_false_complaints: data?.length || 0
        }
      };

    } catch (error) {
      console.error('Error getting false complaint statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all false complaints
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} List of false complaints
   */
  async getFalseComplaints(filters = {}) {
    try {
      const Database = require('../config/database');
      const supabase = Database.getClient();

      let query = supabase
        .from('complaints')
        .select('*')
        .eq('is_false_complaint', true)
        .order('false_complaint_marked_at', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('Error getting false complaints:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ComplaintService;

