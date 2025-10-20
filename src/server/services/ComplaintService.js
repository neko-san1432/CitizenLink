const ComplaintRepository = require('../repositories/ComplaintRepository');
const ComplaintAssignmentRepository = require('../repositories/ComplaintAssignmentRepository');
const DepartmentRepository = require('../repositories/DepartmentRepository');
const Complaint = require('../models/Complaint');
const NotificationService = require('./NotificationService');

class ComplaintService {
  constructor() {
    this.complaintRepo = new ComplaintRepository();
    this.assignmentRepo = new ComplaintAssignmentRepository();
    this.departmentRepo = new DepartmentRepository();
    this.notificationService = new NotificationService();
  }

  async createComplaint(userId, complaintData, files = []) {
    // Parse departments - handle both array and individual values
    let departments = complaintData.departments || complaintData.department_r || [];
    
    // If departments is a string, try to parse as JSON
    if (typeof departments === 'string') {
      try {
        departments = JSON.parse(departments);
      } catch (e) {
        console.warn('[COMPLAINT] Failed to parse departments JSON:', e);
        departments = [];
      }
    }
    
    // If departments is not an array, convert it to array
    if (!Array.isArray(departments)) {
      departments = [departments].filter(Boolean);
    }

    // console.log removed for security

    // Map client field names to server field names
    const mappedData = {
      ...complaintData,
      submitted_by: userId,
      // Map 'description' from client to 'descriptive_su' expected by server model
      descriptive_su: complaintData.description || complaintData.descriptive_su,
      // Map 'departments' to 'department_r' for database
      department_r: departments
    };

    const complaint = new Complaint(mappedData);

    const validation = Complaint.validate(complaint);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedData = complaint.sanitizeForInsert();
    const createdComplaint = await this.complaintRepo.create(sanitizedData);

    // console.log removed for security

    try {
      await this._processWorkflow(createdComplaint, departments);
      await this._processFileUploads(createdComplaint.id, files);

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
          primary_department: departmentArray[0],
          secondary_departments: departmentArray.slice(1),
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

    if (complaint.type) {
      try {
        const autoAssignResult = await this.complaintRepo.autoAssignDepartments(complaint.id);
        if (autoAssignResult && autoAssignResult.length > 0) {
          // console.log removed for security
        }
      } catch (error) {
        console.warn('[WORKFLOW] Auto-assignment failed:', error.message);
      }
    }

    if (complaint.primary_department || departmentArray.length > 0) {
      const targetDept = complaint.primary_department || departmentArray[0];
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
          type: complaint.type,
          departments: departmentArray,
          has_evidence: false
        }
      });
    } catch (error) {
      console.warn('[WORKFLOW] Audit logging failed:', error.message);
    }
  }

  async _processFileUploads(complaintId, files) {
    if (!files || files.length === 0) return [];

    const evidenceFiles = [];
    for (const file of files) {
      try {
        const fileName = `${complaintId}/${Date.now()}-${file.originalname}`;

        const { data: uploadData, error: uploadError } = await this.complaintRepo.supabase.storage
          .from('complaint-evidence')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          console.error('[FILE] Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = this.complaintRepo.supabase.storage
          .from('complaint-evidence')
          .getPublicUrl(fileName);

        evidenceFiles.push({
          fileName: file.originalname,
          filePath: fileName,
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
      await this.complaintRepo.updateEvidence(complaintId, evidenceFiles);
    }

    return evidenceFiles;
  }

  async addEvidence(complaintId, files) {
    return this._processFileUploads(complaintId, files);
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

  async getAllComplaints(options = {}) {
    return this.complaintRepo.findAll(options);
  }

  async updateComplaintStatus(id, status, notes = null, userId = null) {
    const complaint = await this.getComplaintById(id);

    const validStatuses = ['pending review', 'in progress', 'resolved', 'closed', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const updatedComplaint = await this.complaintRepo.updateStatus(id, status, notes);

    try {
      await this.complaintRepo.logAction(id, 'status_updated', {
        reason: `Status changed to ${status}`,
        details: { old_status: complaint.status, new_status: status, notes }
      });
    } catch (error) {
      console.warn('[AUDIT] Status update logging failed:', error.message);
    }

    // Send notification to citizen if status changed
    if (complaint.status !== status) {
      try {
        await this.notificationService.notifyComplaintStatusChanged(
          complaint.submitted_by,
          id,
          complaint.title,
          status,
          complaint.status
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
      primary_department: toDept,
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
      .select('status, type, priority, submitted_at');

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
      stats.by_status[complaint.status] = (stats.by_status[complaint.status] || 0) + 1;
      stats.by_type[complaint.type] = (stats.by_type[complaint.type] || 0) + 1;
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
        .select('id, title, type, status, priority, latitude, longitude, location_text, submitted_at, primary_department, secondary_departments, department_r')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Filter by status
      if (status) {
        query = query.eq('status', status);
      } else if (!includeResolved) {
        query = query.neq('status', 'resolved').neq('status', 'closed');
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
        type: complaint.type,
        status: complaint.status,
        priority: complaint.priority,
        lat: parseFloat(complaint.latitude),
        lng: parseFloat(complaint.longitude),
        location: complaint.location_text,
        submittedAt: complaint.submitted_at,
        department: complaint.primary_department,
        departments: complaint.department_r || [],
        secondaryDepartments: complaint.secondary_departments || []
      }));

      // console.log removed for security
      return transformedData;
    } catch (error) {
      console.error('[COMPLAINT-SERVICE] getComplaintLocations error:', error);
      throw error;
    }
  }
}

module.exports = ComplaintService;

