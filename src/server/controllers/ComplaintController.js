const ComplaintService = require("../services/ComplaintService");
const { getWorkflowFromStatus } = require("../utils/complaintUtils");

class ComplaintController {
  constructor() {
    this.complaintService = new ComplaintService();
  }

  async createComplaint(req, res) {
    const { user } = req;
    const complaintData = req.body;
    const token = req.headers.authorization; // Get token from headers

    // Handle multer .fields() response (files is an object, not array)
    let files = [];
    if (req.files && req.files.evidenceFiles) {
      files = req.files.evidenceFiles;
    }

    const complaint = await this.complaintService.createComplaint(
      user.id,
      complaintData,
      files,
      token
    );

    const response = {
      success: true,
      data: complaint,
      message: "Complaint submitted successfully",
    };

    if (
      (complaint.department_r && complaint.department_r.length > 0) ||
      complaint.assigned_coordinator_id
    ) {
      response.workflow = {
        auto_assigned: Boolean(
          complaint.department_r && complaint.department_r.length > 0
        ),
        coordinator_assigned: Boolean(complaint.assigned_coordinator_id),
        workflow_status: complaint.workflow_status,
      };
    }

    res.status(201).json(response);
  }

  /**
   * Cancel complaint
   */
  async cancelComplaint(req, res) {
    const { complaintId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const result = await this.complaintService.cancelComplaint(
      complaintId,
      userId,
      reason
    );
    res.json({
      success: true,
      message: "Complaint cancelled successfully",
      data: result,
    });
  }

  /**
   * Send reminder for complaint
   */
  async sendReminder(req, res) {
    const { complaintId } = req.params;
    const userId = req.user.id;
    const result = await this.complaintService.sendReminder(
      complaintId,
      userId
    );
    res.json({
      success: true,
      message: "Reminder sent successfully",
      data: result,
    });
  }

  async getMyComplaints(req, res) {
    const { user } = req;
    const token = req.headers.authorization;
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      status: req.query.status,
      type: req.query.type,
      token,
    };

    const result = await this.complaintService.getUserComplaints(
      user.id,
      options
    );
    res.json({
      success: true,
      data: result.complaints,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  async getMyStatistics(req, res) {
    const { user } = req;
    const result = await this.complaintService.getUserStatistics(user.id);
    res.json({
      success: true,
      data: result,
    });
  }

  async getComplaintById(req, res) {
    const { user } = req;
    const { id } = req.params;
    const userRole = user.role || "citizen";

    console.log(
      `[COMPLAINT_CONTROLLER] Fetching complaint ${id} for user ${user.id} (role: ${userRole})`
    );

    const token = req.headers.authorization;
    let complaint;
    if (userRole === "citizen") {
      complaint = await this.complaintService.getComplaintById(
        id,
        user.id,
        token
      );
    } else {
      complaint = await this.complaintService.getComplaintById(id, null, token);
    }

    res.json({
      success: true,
      data: complaint,
    });
  }

  async getAllComplaints(req, res) {
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      status: req.query.status,
      type: req.query.type,
      department: req.query.department,
      search: req.query.search,
    };

    const result = await this.complaintService.getAllComplaints(options);
    res.json({
      success: true,
      data: result.complaints,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  async updateComplaintStatus(req, res) {
    const { id } = req.params;
    const { status, priority, category, subcategory, notes } = req.body;
    const { user } = req;

    const complaint = await this.complaintService.updateComplaintStatus(
      id,
      { status, priority, category, subcategory, notes },
      user.id
    );

    res.json({
      success: true,
      data: complaint,
      message: "Complaint status updated successfully",
    });
  }

  async transitionStatus(req, res) {
    const complaintId = req.params.id;
    const { status, resolution_notes, admin_notes, feedback } = req.body || {};
    const userId = req.user?.id;
    const userRole = req.user?.role || "citizen";

    // Optional evidence from officer during submit-for-approval
    const files =
      req.files && req.files.evidenceFiles ? req.files.evidenceFiles : [];

    // Citizens can only confirm resolution (one-way)
    if (userRole === "citizen" && status !== "resolved") {
      return res.status(400).json({
        success: false,
        error: "Citizens can only confirm resolution",
      });
    }

    if (files && files.length > 0) {
      await this.complaintService.addEvidence(complaintId, files);
    }

    const updated = await this.complaintService.updateComplaintStatus(
      complaintId,
      status,
      userRole === "citizen"
        ? null
        : resolution_notes || admin_notes || feedback || null,
      userId
    );

    return res.json({ success: true, data: updated });
  }

  async assignCoordinator(req, res) {
    const { id } = req.params;
    const { coordinator_id } = req.body;
    const { user } = req;

    const complaint = await this.complaintService.assignCoordinator(
      id,
      coordinator_id,
      user.id
    );

    res.json({
      success: true,
      data: complaint,
      message: "Coordinator assigned successfully",
    });
  }

  async transferComplaint(req, res) {
    const { id } = req.params;
    const { from_department, to_department, reason } = req.body;
    const { user } = req;

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
      message: "Complaint transferred successfully",
    });
  }

  async getComplaintStats(req, res) {
    const filters = {
      department: req.query.department,
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
    };

    const stats = await this.complaintService.getComplaintStats(filters);
    res.json({
      success: true,
      data: stats,
    });
  }

  async getComplaintLocations(req, res) {
    const {
      status,
      _type,
      department,
      category,
      startDate,
      endDate,
      includeResolved = "true",
    } = req.query;

    // Map query params to service filters
    // Handle arrays for multiple selections (Express parses multiple query params as arrays)
    const statusArray = Array.isArray(status) ? status : status ? [status] : [];
    const categoryArray = Array.isArray(category)
      ? category
      : category
        ? [category]
        : [];
    let departmentArray = Array.isArray(department)
      ? department
      : department
        ? [department]
        : [];

    // ROLE-BASED FILTERING: Enforce department restrictions
    const userRole = req.user?.role || "citizen";
    const userDepartment = req.user?.department;

    // LGU Admins and Officers can ONLY see their own department's data
    if (["lgu-admin", "lgu-officer"].includes(userRole) && userDepartment) {
      departmentArray = [userDepartment];
    }

    // Process status filters - separate workflow_status and confirmation_status
    const workflowStatuses = [];
    const confirmationStatuses = [];
    const confirmationStatusList = [
      "waiting_for_responders",
      "waiting_for_complainant",
      "confirmed",
      "disputed",
    ];

    statusArray.forEach((statusValue) => {
      if (!statusValue) return;
      const statusLower = statusValue.toLowerCase();
      if (confirmationStatusList.includes(statusLower)) {
        confirmationStatuses.push(statusLower);
      } else {
        // Convert legacy status to workflow_status
        const workflowStatus = getWorkflowFromStatus(statusValue);
        if (workflowStatus && workflowStatus !== statusValue) {
          workflowStatuses.push(workflowStatus);
        } else if (
          [
            "new",
            "assigned",
            "in_progress",
            "pending_approval",
            "completed",
            "cancelled",
          ].includes(statusLower)
        ) {
          workflowStatuses.push(statusLower);
        }
      }
    });

    const serviceFilters = {
      status: workflowStatuses.length > 0 ? workflowStatuses : undefined,
      confirmationStatus:
        confirmationStatuses.length > 0 ? confirmationStatuses : undefined,
      category: categoryArray.length > 0 ? categoryArray : undefined,
      subcategory: req.query.subcategory || undefined,
      department: departmentArray.length > 0 ? departmentArray : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeResolved: includeResolved === "true",
    };

    // Remove undefined values
    Object.keys(serviceFilters).forEach((key) => {
      if (serviceFilters[key] === void 0) {
        delete serviceFilters[key];
      }
    });

    const locations = await this.complaintService.getComplaintLocations(
      serviceFilters
    );

    res.json({
      success: true,
      data: locations,
      count: locations.length,
    });
  }

  /**
   * Mark a complaint as false
   */
  async markAsFalseComplaint(req, res) {
    const { id } = req.params;
    const { reason } = req.body;
    const { user } = req;

    const result = await this.complaintService.markAsFalseComplaint(
      id,
      user.id,
      reason
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  }

  /**
   * Mark a complaint as duplicate
   */
  async markAsDuplicate(req, res) {
    const { id } = req.params;
    const { masterComplaintId } = req.body;
    const { user } = req;

    const result = await this.complaintService.markAsDuplicate(
      id,
      masterComplaintId,
      user.id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  }

  /**
   * Get all false complaints
   */
  async getFalseComplaints(req, res) {
    const { limit } = req.query;
    const result = await this.complaintService.getFalseComplaints({
      limit: limit ? parseInt(limit) : undefined,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  }

  /**
   * Get false complaint statistics
   */
  async getFalseComplaintStatistics(req, res) {
    const result = await this.complaintService.getFalseComplaintStatistics();

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  }

  /**
   * Mark assignment as complete (LGU Officer)
   */
  async markAssignmentComplete(req, res) {
    const { id: complaintId } = req.params;
    const { notes } = req.body;
    const { user } = req;

    // Extract completion evidence files if uploaded
    const files =
      req.files && req.files.completionEvidence
        ? req.files.completionEvidence
        : [];

    const result = await this.complaintService.markAssignmentComplete(
      complaintId,
      user.id,
      notes,
      files
    );

    res.json({
      success: true,
      message: "Assignment marked as complete successfully",
      data: result,
    });
  }

  /**
   * Confirm resolution (Citizen side)
   */
  async confirmResolution(req, res) {
    const { id: complaintId } = req.params;
    const { confirmed, feedback } = req.body;
    const { user } = req;

    const result = await this.complaintService.confirmResolution(
      complaintId,
      user.id,
      confirmed,
      feedback
    );

    res.json({
      success: true,
      message: confirmed
        ? "Resolution confirmed successfully"
        : "Resolution rejected",
      data: result,
    });
  }

  /**
   * Get evidence files for a complaint (citizen and authorized roles)
   */
  async getComplaintEvidence(req, res) {
    const id = req.params.id || req.params.complaintId;
    const { user } = req;
    const files = await this.complaintService.getComplaintEvidence(id, user);
    return res.json({ success: true, data: files });
  }

  async getConfirmationMessage(req, res) {
    const { id } = req.params;
    const { user } = req;
    const message = await this.complaintService.getConfirmationMessage(
      id,
      user.role
    );
    res.json({
      success: true,
      data: message,
    });
  }

  /**
   * Create assignment for officers
   */
  async createAssignment(req, res) {
    const { complaintId } = req.params; // Get from URL parameter
    const { officerIds } = req.body;
    const { user } = req;

    if (
      !complaintId ||
      !officerIds ||
      !Array.isArray(officerIds) ||
      officerIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: complaintId and officerIds array",
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
      message: "Assignment created successfully",
    });
  }
}

module.exports = ComplaintController;
