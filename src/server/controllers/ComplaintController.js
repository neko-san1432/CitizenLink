const ComplaintService = require('../services/ComplaintService');

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
          auto_assigned: !!(complaint.department_r && complaint.department_r.length > 0),
          coordinator_assigned: !!complaint.assigned_coordinator_id,
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
      console.error('Error fetching user complaints:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch complaints'
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
      console.error('Error fetching all complaints:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch complaints'
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

      const {
        status,
        type,
        department,
        startDate,
        endDate,
        includeResolved = 'true'
      } = req.query;

      const locations = await this.complaintService.getComplaintLocations({
        status,
        type,
        department,
        startDate,
        endDate,
        includeResolved: includeResolved === 'true'
      });

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
   * Get complaint evidence files
   */
  async getComplaintEvidence(req, res) {
    try {
      const { complaintId } = req.params;
      const { user } = req;

      console.log(`[COMPLAINT] Getting evidence for complaint ${complaintId} by user ${user.id}`);

      const evidence = await this.complaintService.getComplaintEvidence(complaintId, user);
      
      res.json({
        success: true,
        data: evidence
      });
    } catch (error) {
      console.error('[COMPLAINT] Get evidence error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ComplaintController;
