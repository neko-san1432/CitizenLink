const ComplaintRepository = require('../repositories/ComplaintRepository');
const Complaint = require('../models/Complaint').default;

class ComplaintService {
  constructor() {
    this.complaintRepo = new ComplaintRepository();
  }

  async createComplaint(userId, complaintData, files = []) {
    const complaint = new Complaint({
      ...complaintData,
      submitted_by: userId
    });

    const validation = Complaint.validate(complaint);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const sanitizedData = complaint.sanitizeForInsert();
    const createdComplaint = await this.complaintRepo.create(sanitizedData);

    try {
      await this._processWorkflow(createdComplaint, complaintData.department_r || []);
      await this._processFileUploads(createdComplaint.id, files);
      
      const finalComplaint = await this.complaintRepo.findById(createdComplaint.id);
      return finalComplaint;
    } catch (error) {
      console.warn('Post-creation processing failed:', error.message);
      return createdComplaint;
    }
  }

  async _processWorkflow(complaint, departmentArray) {
    if (complaint.type) {
      try {
        const autoAssignResult = await this.complaintRepo.autoAssignDepartments(complaint.id);
        if (autoAssignResult && autoAssignResult.length > 0) {
          console.log('[WORKFLOW] Auto-assignment successful:', autoAssignResult[0]);
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
          console.log('[WORKFLOW] Coordinator assigned:', coordinator.user_id);
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

        console.log('[FILE] File uploaded:', file.originalname);
      } catch (error) {
        console.error('[FILE] Processing error:', error);
      }
    }

    if (evidenceFiles.length > 0) {
      await this.complaintRepo.updateEvidence(complaintId, evidenceFiles);
    }

    return evidenceFiles;
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
}

module.exports = ComplaintService;
