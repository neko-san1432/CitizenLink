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
        message: "Complaint submitted successfully"
      };

      if (complaint.primary_department || complaint.assigned_coordinator_id) {
        response.workflow = {
          auto_assigned: !!complaint.primary_department,
          coordinator_assigned: !!complaint.assigned_coordinator_id,
          workflow_status: complaint.workflow_status
        };
      }

      res.status(201).json(response);
      console.log("[COMPLAINT] Enhanced complaint submission completed successfully");
    } catch (error) {
      console.error("[COMPLAINT] Submission error:", error);
      const status = error.message.includes('Validation failed') ? 400 : 500;
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
      console.error("Error fetching user complaints:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch complaints"
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
      console.error("Error fetching complaint:", error);
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
      console.error("Error fetching all complaints:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch complaints"
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
          error: "Status is required"
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
        message: "Complaint status updated successfully"
      });
    } catch (error) {
      console.error("Error updating complaint status:", error);
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
          error: "Coordinator ID is required"
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
        message: "Coordinator assigned successfully"
      });
    } catch (error) {
      console.error("Error assigning coordinator:", error);
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
          error: "From department, to department, and reason are required"
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
        message: "Complaint transferred successfully"
      });
    } catch (error) {
      console.error("Error transferring complaint:", error);
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
      console.error("Error fetching complaint stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch complaint statistics"
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
      console.error("[COMPLAINT-CONTROLLER] Error fetching complaint locations:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch complaint locations"
      });
    }
  }
}

module.exports = ComplaintController;
