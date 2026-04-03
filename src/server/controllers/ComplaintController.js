const ComplaintService = require("../services/ComplaintService");
const { getWorkflowFromStatus } = require("../utils/complaintUtils");
const fs = require("fs");
const path = require("path");

class ComplaintController {
  constructor() {
    this.complaintService = new ComplaintService();
  }

  async createcomplaint(req, res) {
    const { user } = req;
    const complaintData = req.body;
    const token = req.headers.authorization; // Get token from headers

    // Handle multer .fields() response (files is an object, not array)
    let files = [];
    if (req.files && req.files.evidenceFiles) {
      files = req.files.evidenceFiles;
    }

    const complaint = await this.complaintService.createcomplaint(
      user.id,
      complaintData,
      files,
      token
    );

    const response = {
      success: true,
      data: complaint,
      message: "complaint submitted successfully",
    };

    if (
      (complaint.departments && complaint.departments.length > 0) ||
      complaint.assigned_coordinator_id
    ) {
      response.workflow = {
        auto_assigned: Boolean(
          complaint.departments && complaint.departments.length > 0
        ),
        coordinator_assigned: Boolean(complaint.assigned_coordinator_id),
        workflow_status: complaint.workflow_status,
      };
    }

    res.status(201).json(response);
  }

  /**
   * Get coordinator stats
   */
  async getCoordinatorStats(req, res) {
    try {
      const stats = await this.complaintService.getcomplaintStats(req.user);

      // Map to dashboard expected format
      const dashboardStats = {
        incoming: stats.byStatus?.submitted || 0,
        unverified: stats.byStatus?.submitted || 0, // In this flow, submitted is unverified
        assigned: (stats.byStatus?.verified || 0) + (stats.byStatus?.under_review || 0),
        escalated: (stats.byPriority?.urgent || 0) + (stats.byPriority?.critical || 0)
      };

      res.json({ success: true, data: dashboardStats });
    } catch (error) {
      console.error("[complaintController] getCoordinatorStats error:", error.message);
      res.status(500).json({ success: false, error: "Failed to fetch coordinator stats" });
    }
  }

  /**
   * Get review queue
   */
  async getReviewQueue(req, res) {
    try {
      // Re-use getcomplaints logic but ensure we filter for relevant status
      // Use req.query directly as getcomplaints handles pagination/filtering
      const { user } = req;
      // Force status filter if not provided, or ensure it's within coordinator scope
      // [MODIFIED] User requested to show ALL complaints, so we remove the default "pending review" filter.
      // [FIX] Force-clear status if it's "pending review" (which returns 0 results for LGU usually)
      // or if it's "undefined"/"null" string from some clients.
      if (req.query.status === "pending review" || req.query.status === "null" || req.query.status === "undefined") {
        console.log("[DEBUG] complaintController: Clearing 'pending review' filter.");
        delete req.query.status;
      }

      console.log("[DEBUG] complaintController: getReviewQueue query:", req.query);

      // Use getAllcomplaints instead of non-existent getcomplaints
      const result = await this.complaintService.getAllcomplaints(req.query);
      res.json(result);
    } catch (error) {
      console.error("[complaintController] getReviewQueue error:", error.message);
      res.status(500).json({ success: false, error: "Failed to fetch review queue" });
    }
  }


  /**
   * Send reminder for complaint
   */
  async sendReminder(req, res) {
    const { id: complaintId } = req.params;
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

  async getMycomplaints(req, res) {
    const { user } = req;
    const token = req.headers.authorization;
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      status: req.query.status,
      type: req.query.type,
      token,
    };

    const result = await this.complaintService.getUsercomplaints(
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

  async getcomplaintById(req, res) {
    const { user } = req;
    const { id } = req.params;
    const userRole = user.role || "citizen";

    console.log(
      `[COMPLAINT_CONTROLLER] Fetching complaint ${id} for user ${user.id} (role: ${userRole})`
    );

    const token = req.headers.authorization;
    let complaint;
    if (userRole === "citizen") {
      complaint = await this.complaintService.getcomplaintById(
        id,
        user.id,
        token
      );
    } else {
      complaint = await this.complaintService.getcomplaintById(id, null, token);
    }

    res.json({
      success: true,
      data: complaint,
    });
  }

  async getAllcomplaints(req, res) {
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      status: req.query.status,
      type: req.query.type,
      department: req.query.department,
      search: req.query.search,
    };

    const result = await this.complaintService.getAllcomplaints(options);
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

  async updatecomplaintStatus(req, res) {
    const { id } = req.params;
    const { status, priority, category, subcategory, notes } = req.body;
    const { user } = req;

    const complaint = await this.complaintService.updatecomplaintStatus(
      id,
      { status, priority, category, subcategory, notes },
      user.id
    );

    res.json({
      success: true,
      data: complaint,
      message: "complaint status updated successfully",
    });
  }

  async getcomplaintStatus(req, res) {
    const { id } = req.params;
    const token = req.headers.authorization;

    // Re-use core service method to respect visibility rules
    const complaint = await this.complaintService.getcomplaintById(id, null, token);

    res.json({
      success: true,
      data: {
        status: complaint.workflow_status,
        priority: complaint.priority,
        updated_at: complaint.updated_at
      }
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

    const updated = await this.complaintService.updatecomplaintStatus(
      complaintId,
      {
        status,
        notes: resolution_notes || admin_notes || feedback || null
      },
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

  async transfercomplaint(req, res) {
    const { id } = req.params;
    const { from_department, to_department, reason } = req.body;
    const { user } = req;

    const complaint = await this.complaintService.transfercomplaint(
      id,
      from_department,
      to_department,
      reason,
      user.id
    );

    res.json({
      success: true,
      data: complaint,
      message: "complaint transferred successfully",
    });
  }

  async getcomplaintStats(req, res) {
    const filters = {
      department: req.query.department,
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
    };

    const stats = await this.complaintService.getcomplaintStats(filters);
    res.json({
      success: true,
      data: stats,
    });
  }

  async getcomplaintLocations(req, res) {
    const {
      status,
      _type,
      department,
      category,
      startDate,
      endDate,
      includeResolved = "true",
      lightweight,
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
    const userdepartment = req.user?.department;

    // LGU staff can ONLY see their own department's data
    if (userRole === "lgu" && userdepartment) {
      departmentArray = [userdepartment];
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

    const locations = lightweight === "true"
      ? await this.complaintService.getcomplaintLocationSlim(serviceFilters)
      : await this.complaintService.getcomplaintLocations(serviceFilters);

    if (
      Array.isArray(locations) &&
      locations.length === 0 &&
      String(process.env.NODE_ENV || "").toLowerCase() === "development"
    ) {
      try {
        const mockPath = path.join(
          __dirname,
          "..",
          "..",
          "..",
          "public",
          "data",
          "complaints",
          "mockcomplaints.json"
        );
        const raw = fs.readFileSync(mockPath, "utf8");
        const parsed = JSON.parse(raw);
        const complaints = Array.isArray(parsed) ? parsed : parsed?.complaints;
        const fallback = Array.isArray(complaints)
          ? complaints
            .map((c) => {
              const lat = Number.parseFloat(c.latitude);
              const lng = Number.parseFloat(c.longitude);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              const departments = Array.isArray(c.departments)
                ? c.departments
                : c.departments
                  ? [c.departments]
                  : [];
              return {
                id: c.id,
                title: c.title || null,
                status: c.workflow_status || "new",
                priority: c.priority || "medium",
                lat,
                lng,
                location: c.location_text || "",
                submittedAt: c.submitted_at || null,
                department: departments.length > 0 ? departments[0] : "Unknown",
                departments,
                secondarydepartments: departments.length > 1 ? departments.slice(1) : [],
                type: c.category || "General",
                category: c.category || null,
                subcategory: c.subcategory || null,
                departments,
              };
            })
            .filter(Boolean)
          : [];

        res.json({
          success: true,
          data: fallback,
          count: fallback.length,
        });
        return;
      } catch (e) {
      }
    }

    res.json({
      success: true,
      data: locations,
      count: locations.length,
    });
  }

  /**
   * Mark a complaint as false
   */
  async markAsFalsecomplaint(req, res) {
    const { id } = req.params;
    const { reason, notes } = req.body;
    const { user } = req;

    const result = await this.complaintService.markAsFalsecomplaint(
      id,
      user.id,
      reason,
      notes
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
    const { mastercomplaintId } = req.body;
    const { user } = req;

    const result = await this.complaintService.markAsDuplicate(
      id,
      mastercomplaintId,
      user.id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  }

  /**
   * Upvote a complaint (Citizen "Me Too")
   */
  async upvotecomplaint(req, res) {
    const { id } = req.params;
    const { user } = req;

    const result = await this.complaintService.upvotecomplaint(id, user.id);
    res.json(result);
  }

  /**
   * Check for duplicate complaints
   */
  async checkDuplicates(req, res) {
    // Feature Flag Check
    const config = require("../../../config/app");
    if (!config.features || !config.features.duplicateDetection) {
      return res.json({ success: true, data: [] });
    }

    const { latitude, longitude, category, subcategory } = req.query;

    // Validate inputs
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: "Latitude and longitude are required",
      });
    }

    const duplicates = await this.complaintService.detectDuplicates({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      category,
      subcategory,
    });

    res.json({
      success: true,
      data: duplicates,
    });
  }

  /**
   * Admin: Get duplicates for a specific complaint
   */
  async getPotentialDuplicatesForId(req, res) {
    const { id } = req.params;
    const duplicates = await this.complaintService.getPotentialDuplicatesForId(
      id
    );
    res.json({ success: true, data: duplicates });
  }

  /**
   * Admin: Bulk Merge
   */
  async bulkMergecomplaints(req, res) {
    const { id } = req.params; // Master ID
    const { childIds } = req.body;

    const result = await this.complaintService.bulkMergecomplaints(
      id,
      childIds
    );
    res.json(result);
  }

  /**
   * Get all false complaints
   */
  async getFalsecomplaints(req, res) {
    const { limit } = req.query;
    const result = await this.complaintService.getFalsecomplaints({
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
  async getFalsecomplaintStatistics(req, res) {
    const result = await this.complaintService.getFalsecomplaintStatistics();

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
  async getcomplaintEvidence(req, res) {
    const id = req.params.id || req.params.complaintId;
    const { user } = req;
    const files = await this.complaintService.getcomplaintEvidence(id, user);
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

  async getcomplaintHistory(req, res) {
    const { id } = req.params;
    const { user } = req;

    // Check permission by fetching complaint with validation
    // If citizen, userId ensures ownership check. If admin/officer, passed as null (role checks handled by middleware/service logic)
    const checkUserId = user.role === "citizen" ? user.id : null;
    await this.complaintService.getcomplaintById(id, checkUserId);

    const history = await this.complaintService.getcomplaintHistory(id);
    res.json({ success: true, data: history });
  }

  /**
   * Get barangay insights for prioritization widget
   * Returns volume, urgency, and recency scores per barangay
   */
  async getBarangayInsights(req, res) {
    try {
      // List of Digos City barangays
      const BARANGAYS = [
        "Aplaya", "Balabag", "Binaton", "Cogon", "Colorado", "Dawis",
        "Dulangan", "Goma", "Igpit", "Kiagot", "Lungag", "Mahayahay",
        "Matti", "Kapatagan (Rizal)", "Ruparan", "San Agustin",
        "San Jose (Balutakay)", "San Miguel (Odaca)", "San Roque",
        "Sinawilan", "Soong", "Tiguman", "Tres de Mayo",
        "Zone 1 (Pob.)", "Zone 2 (Pob.)", "Zone 3 (Pob.)"
      ];

      const Database = require("../config/database");
      const supabase = Database.getServiceClient();

      // Fetch all relevant complaints (last 30 days for recency calculations)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: complaints, error } = await supabase
        .from("complaints")
        .select("id, location_text, priority, submitted_at, workflow_status")
        .gte("submitted_at", thirtyDaysAgo.toISOString())
        .not("workflow_status", "in", "(cancelled,rejected)");

      if (error) throw error;

      // Initialize barangay stats
      const barangayStats = new Map();
      BARANGAYS.forEach(name => {
        barangayStats.set(name, {
          name,
          totalcomplaints: 0,
          urgentCount: 0,
          highCount: 0,
          recentCount: 0 // Last 7 days
        });
      });

      // Calculate date threshold for recency (7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Process each complaint
      complaints?.forEach(complaint => {
        const locationText = complaint.location_text?.toLowerCase() || "";

        // Find matching barangay
        for (const barangay of BARANGAYS) {
          if (locationText.includes(barangay.toLowerCase())) {
            const stats = barangayStats.get(barangay);
            stats.totalcomplaints++;

            // Count urgent/high priority
            const priority = complaint.priority?.toLowerCase();
            if (priority === "urgent") stats.urgentCount++;
            else if (priority === "high") stats.highCount++;

            // Count recent (last 7 days)
            if (new Date(complaint.submitted_at) >= sevenDaysAgo) {
              stats.recentCount++;
            }

            break; // Match first barangay only
          }
        }
      });

      // Calculate scores and sort by volume
      const maxVolume = Math.max(...Array.from(barangayStats.values()).map(s => s.totalcomplaints), 1);

      const barangays = Array.from(barangayStats.values())
        .filter(s => s.totalcomplaints > 0) // Only show barangays with complaints
        .map(stats => {
          const volumeScore = Math.round((stats.totalcomplaints / maxVolume) * 100);
          const urgencyScore = stats.totalcomplaints > 0
            ? Math.round(((stats.urgentCount * 2 + stats.highCount) / stats.totalcomplaints) * 100)
            : 0;
          const recencyScore = stats.totalcomplaints > 0
            ? Math.round((stats.recentCount / stats.totalcomplaints) * 100)
            : 0;

          return {
            name: stats.name,
            totalcomplaints: stats.totalcomplaints,
            volumeScore: Math.min(volumeScore, 100),
            urgencyScore: Math.min(urgencyScore, 100),
            recencyScore: Math.min(recencyScore, 100)
          };
        })
        .sort((a, b) => b.totalcomplaints - a.totalcomplaints)
        .slice(0, 10); // Top 10 barangays

      res.json({
        success: true,
        data: { barangays },
        meta: {
          period: "30 days",
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("[complaintController] getBarangayInsights error:", error.message);
      res.status(500).json({ success: false, error: "Failed to fetch barangay insights" });
    }
  }
}

module.exports = ComplaintController;
