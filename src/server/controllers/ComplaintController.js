const ComplaintService = require('../services/ComplaintService');
const { getWorkflowFromStatus } = require('../utils/complaintUtils');

class ComplaintController {

  constructor() {
    this.complaintService = new ComplaintService();
  }
  async createComplaint(req, res) {
    try {
      const { user } = req;
      const complaintData = req.body;
      // Handle multer .fields() response (files is an object, not array)
      let files = [];
      if (req.files && req.files.evidenceFiles) {
        files = req.files.evidenceFiles;
      }
      const complaint = await this.complaintService.createComplaint(
        user.id,
        complaintData,
        files
      );
      const response = {
        success: true,
        data: complaint,
        message: 'Complaint submitted successfully'
      };
      if (complaint.department_r && complaint.department_r.length > 0 || complaint.assigned_coordinator_id) {
        response.workflow = {
          auto_assigned: Boolean(complaint.department_r && complaint.department_r.length > 0),
          coordinator_assigned: Boolean(complaint.assigned_coordinator_id),
          workflow_status: complaint.workflow_status
        };
      }
      res.status(201).json(response);
      // console.log removed for security
    } catch (error) {
      console.error('[COMPLAINT] Submission error:', error);
      const status = error.message.includes('Validation failed') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Cancel complaint
   */
  async cancelComplaint(req, res) {
    try {
      const { complaintId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;
      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Cancellation reason is required'
        });
      }
      const result = await this.complaintService.cancelComplaint(complaintId, userId, reason);
      res.json({
        success: true,
        message: 'Complaint cancelled successfully',
        data: result
      });
    } catch (error) {
      console.error('[COMPLAINT] Cancel complaint error:', error);
      const status = error.message.includes('not found') ? 404 :
        error.message.includes('not authorized') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Send reminder for complaint
   */
  async sendReminder(req, res) {
    try {
      const { complaintId } = req.params;
      const userId = req.user.id;
      const result = await this.complaintService.sendReminder(complaintId, userId);
      res.json({
        success: true,
        message: 'Reminder sent successfully',
        data: result
      });
    } catch (error) {
      console.error('[COMPLAINT] Send reminder error:', error);
      const status = error.message.includes('not found') ? 404 :
        error.message.includes('not authorized') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Confirm resolution
   */
  async confirmResolution(req, res) {
    try {
      const { complaintId } = req.params;
      const { confirmed, feedback } = req.body;
      const userId = req.user.id;
      if (typeof confirmed !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Confirmation status is required'
        });
      }
      const result = await this.complaintService.confirmResolution(complaintId, userId, confirmed, feedback);
      res.json({
        success: true,
        message: confirmed ? 'Resolution confirmed successfully' : 'Resolution rejected',
        data: result
      });
    } catch (error) {
      console.error('[COMPLAINT] Confirm resolution error:', error);
      const status = error.message.includes('not found') ? 404 :
        error.message.includes('not authorized') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async getMyComplaints(req, res) {
    try {
      const { user } = req;
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        status: req.query.status,
        type: req.query.type
      };
      const result = await this.complaintService.getUserComplaints(user.id, options);
      res.json({
        success: true,
        data: result.complaints,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('[COMPLAINT_CONTROLLER] Error fetching user complaints:', error);
      console.error('[COMPLAINT_CONTROLLER] Error stack:', error.stack);
      console.error('[COMPLAINT_CONTROLLER] Request details:', {
        userId: req.user?.id,
        userRole: req.user?.role,
        queryParams: req.query,
        headers: req.headers
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch complaints',
        details: error.message
      });
    }
  }
  async getMyStatistics(req, res) {
    try {
      const { user } = req;
      const result = await this.complaintService.getUserStatistics(user.id);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics'
      });
    }
  }
  async getComplaintById(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const userRole = user.role || 'citizen';
      let complaint;
      if (userRole === 'citizen') {
        complaint = await this.complaintService.getComplaintById(id, user.id);
      } else {
        complaint = await this.complaintService.getComplaintById(id);
      }
      res.json({
        success: true,
        data: complaint
      });
    } catch (error) {
      console.error('Error fetching complaint:', error);
      const status = error.message === 'Complaint not found' ||
                     error.message === 'Access denied' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async getAllComplaints(req, res) {
    try {
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        status: req.query.status,
        type: req.query.type,
        department: req.query.department,
        search: req.query.search
      };
      const result = await this.complaintService.getAllComplaints(options);
      res.json({
        success: true,
        data: result.complaints,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error fetching all complaints:', error.message, error.stack);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch complaints',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  async updateComplaintStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const { user } = req;
      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }
      const complaint = await this.complaintService.updateComplaintStatus(
        id,
        status,
        notes,
        user.id
      );
      res.json({
        success: true,
        data: complaint,
        message: 'Complaint status updated successfully'
      });
    } catch (error) {
      console.error('Error updating complaint status:', error);
      const status = error.message === 'Complaint not found' ? 404 :
        error.message === 'Invalid status' ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async transitionStatus(req, res) {
    try {
      const complaintId = req.params.id;
      const { status, resolution_notes, admin_notes, feedback } = req.body || {};
      const userId = req.user?.id;
      const userRole = req.user?.role || 'citizen';
      // Optional evidence from officer during submit-for-approval
      const files = (req.files && req.files.evidenceFiles) ? req.files.evidenceFiles : [];

      if (!status) {
        return res.status(400).json({ success: false, error: 'Status is required' });
      }
      // Citizens can only confirm resolution (one-way)
      if (userRole === 'citizen' && status !== 'resolved') {
        return res.status(400).json({ success: false, error: 'Citizens can only confirm resolution' });
      }
      if (files && files.length > 0) {
        await this.complaintService.addEvidence(complaintId, files);
      }
      const updated = await this.complaintService.updateComplaintStatus(
        complaintId,
        status,
        userRole === 'citizen' ? null : (resolution_notes || admin_notes || feedback || null),
        userId
      );
      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[COMPLAINT] Transition status error:', error);
      res.status(500).json({ success: false, error: 'Failed to update complaint status' });
    }
  }
  async assignCoordinator(req, res) {
    try {
      const { id } = req.params;
      const { coordinator_id } = req.body;
      const { user } = req;
      if (!coordinator_id) {
        return res.status(400).json({
          success: false,
          error: 'Coordinator ID is required'
        });
      }
      const complaint = await this.complaintService.assignCoordinator(
        id,
        coordinator_id,
        user.id
      );
      res.json({
        success: true,
        data: complaint,
        message: 'Coordinator assigned successfully'
      });
    } catch (error) {
      console.error('Error assigning coordinator:', error);
      const status = error.message === 'Complaint not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async transferComplaint(req, res) {
    try {
      const { id } = req.params;
      const { from_department, to_department, reason } = req.body;
      const { user } = req;
      if (!from_department || !to_department || !reason) {
        return res.status(400).json({
          success: false,
          error: 'From department, to department, and reason are required'
        });
      }
      const complaint = await this.complaintService.transferComplaint(
        id,
        from_department,
        to_department,
        reason,
        user.id
      );
      res.json({
        success: true,
        data: complaint,
        message: 'Complaint transferred successfully'
      });
    } catch (error) {
      console.error('Error transferring complaint:', error);
      const status = error.message === 'Complaint not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async getComplaintStats(req, res) {
    try {
      const filters = {
        department: req.query.department,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to
      };
      const stats = await this.complaintService.getComplaintStats(filters);
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching complaint stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch complaint statistics'
      });
    }
  }
  async getComplaintLocations(req, res) {
    try {
      // console.log removed for security
      // console.log removed for security
      const {
        status,
        type,
        department,
        startDate,
        endDate,
        includeResolved = 'true'
      } = req.query;
      // console.log removed for security
      // Map query params to service filters
      // IMPORTANT: Convert legacy status values to workflow_status
      let workflowStatus = undefined;
      if (status) {
        // Convert legacy status (e.g., "pending review", "in progress", "resolved") 
        // to workflow_status (e.g., "new", "in_progress", "completed")
        workflowStatus = getWorkflowFromStatus(status);
        // If conversion failed (returned original), check if it's already a workflow status
        if (workflowStatus === status && !['new', 'assigned', 'in_progress', 'pending_approval', 'completed', 'cancelled'].includes(status)) {
          // Try direct workflow status values
          workflowStatus = ['new', 'assigned', 'in_progress', 'pending_approval', 'completed', 'cancelled'].includes(status) ? status : undefined;
        }
        // console.log removed for security
      }
      const serviceFilters = {
        status: workflowStatus,
        category: req.query.category || undefined,
        subcategory: req.query.subcategory || undefined,
        department: department || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        includeResolved: includeResolved === 'true'
      };
      // Remove undefined values
      Object.keys(serviceFilters).forEach(key => {
        if (serviceFilters[key] === undefined) {
          delete serviceFilters[key];
        }
      });
      // console.log removed for security
      const locations = await this.complaintService.getComplaintLocations(serviceFilters);
      // console.log removed for security
      res.json({
        success: true,
        data: locations,
        count: locations.length
      });
    } catch (error) {
      console.error('[COMPLAINT-CONTROLLER] Error fetching complaint locations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch complaint locations'
      });
    }
  }
  /**
   * Mark a complaint as false
   */
  async markAsFalseComplaint(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const { user } = req;
      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Reason is required'
        });
      }
      const result = await this.complaintService.markAsFalseComplaint(
        id,
        user.id,
        reason
      );
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      console.error('[COMPLAINT-CONTROLLER] Error marking complaint as false:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark complaint as false'
      });
    }
  }
  /**
   * Get all false complaints
   */
  async getFalseComplaints(req, res) {
    try {
      const { limit } = req.query;
      const result = await this.complaintService.getFalseComplaints({
        limit: limit ? parseInt(limit) : undefined
      });
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      console.error('[COMPLAINT-CONTROLLER] Error getting false complaints:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get false complaints'
      });
    }
  }
  /**
   * Get false complaint statistics
   */
  async getFalseComplaintStatistics(req, res) {
    try {
      const result = await this.complaintService.getFalseComplaintStatistics();
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      console.error('[COMPLAINT-CONTROLLER] Error getting false complaint statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get false complaint statistics'
      });
    }
  }
  /**
   * Mark assignment as complete (LGU Officer)
   */
  async markAssignmentComplete(req, res) {
    try {
      const { id: complaintId } = req.params;
      const { notes } = req.body;
      const { user } = req;
      // Extract completion evidence files if uploaded
      const files = (req.files && req.files.completionEvidence) ? req.files.completionEvidence : [];

      const result = await this.complaintService.markAssignmentComplete(
        complaintId,
        user.id,
        notes,
        files
      );
      res.json({
        success: true,
        message: 'Assignment marked as complete successfully',
        data: result
      });
    } catch (error) {
      console.error('[COMPLAINT] Mark assignment complete error:', error);
      const status = error.message.includes('not found') ? 404 :
        error.message.includes('not authorized') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Confirm resolution (Citizen side)
   */
  async confirmResolution(req, res) {
    try {
      const { id: complaintId } = req.params;
      const { confirmed, feedback } = req.body;
      const { user } = req;
      if (typeof confirmed !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Confirmed status is required (true/false)'
        });
      }
      // Note: Ownership and consistency checks are handled in the service.
      // We no longer block citizen confirmation here on coordinator/confirmation gates
      // to avoid false 400s; the service will update and reconcile workflow accordingly.
      const result = await this.complaintService.confirmResolution(
        complaintId,
        user.id,
        confirmed,
        feedback
      );
      res.json({
        success: true,
        message: confirmed ? 'Resolution confirmed successfully' : 'Resolution rejected',
        data: result
      });
    } catch (error) {
      console.error('[COMPLAINT] Confirm resolution error:', error);
      const status = error.message.includes('not found') ? 404 :
        error.message.includes('not authorized') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Get evidence files for a complaint (citizen and authorized roles)
   */
  async getComplaintEvidence(req, res) {
    try {
      const id = req.params.id || req.params.complaintId;
      const { user } = req;
      const files = await this.complaintService.getComplaintEvidence(id, user);
      return res.json({ success: true, data: files });
    } catch (error) {
      console.error('Error getting complaint evidence:', error);
      return res.status(500).json({ success: false, error: 'Failed to load complaint evidence' });
    }
  }
  async getConfirmationMessage(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const message = await this.complaintService.getConfirmationMessage(id, user.role);
      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      console.error('Error getting confirmation message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get confirmation message'
      });
    }
  }
  /**
   * Create assignment for officers
   */
  async createAssignment(req, res) {
    try {
      const complaintId = req.params.complaintId; // Get from URL parameter
      const { officerIds } = req.body;
      const user = req.user;
      if (!complaintId || !officerIds || !Array.isArray(officerIds) || officerIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: complaintId and officerIds array'
        });
      }
      const result = await this.complaintService.createAssignment(
        complaintId,
        officerIds,
        user.id
      );
      res.json({
        success: true,
        data: result,
        message: 'Assignment created successfully'
      });
    } catch (error) {
      console.error('Error creating assignment:', error.message, error.stack);
      res.status(500).json({
        success: false,
        error: 'Failed to create assignment',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = ComplaintController;
