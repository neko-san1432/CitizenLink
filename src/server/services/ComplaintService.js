const ComplaintRepository = require("../repositories/ComplaintRepository");
const ComplaintAssignmentRepository = require("../repositories/ComplaintAssignmentRepository");
const ComplaintHistoryRepository = require("../repositories/ComplaintHistoryRepository");
const DepartmentRepository = require("../repositories/DepartmentRepository");
const NotificationService = require("./NotificationService");
const {
  normalizeComplaintData,
  prepareComplaintForInsert,
  validateComplaintConsistency,
} = require("../utils/complaintUtils");
const { isPotentialDuplicate } = require("../utils/similarityUtils");

const advancedDecisionEngine = require("./ml/AdvancedDecisionEngine");
const DepartmentService = require("./DepartmentService");

const ComplaintCreateService = require("./complaint/ComplaintCreateService");
const ComplaintReadService = require("./complaint/ComplaintReadService");
const ComplaintUpdateService = require("./complaint/ComplaintUpdateService");
const ComplaintVoteService = require("./complaint/ComplaintVoteService");
const ComplaintEvidenceService = require("./complaint/ComplaintEvidenceService");

class ComplaintService {
  constructor(
    complaintRepo,
    assignmentRepo,
    departmentRepo,
    notificationService,
    historyRepo
  ) {
    this.complaintRepo = complaintRepo || new ComplaintRepository();
    this.assignmentRepo = assignmentRepo || new ComplaintAssignmentRepository();
    this.departmentRepo = departmentRepo || new DepartmentRepository();
    this.notificationService = notificationService || new NotificationService();
    this.historyRepo = historyRepo || new ComplaintHistoryRepository();

    this.createService = new ComplaintCreateService(this.complaintRepo, this.assignmentRepo, this.departmentRepo);
    this.readService = new ComplaintReadService(this.complaintRepo);
    this.updateService = new ComplaintUpdateService(this.complaintRepo, this.assignmentRepo);
    this.voteService = new ComplaintVoteService(this.complaintRepo);
    this.evidenceService = new ComplaintEvidenceService(this.complaintRepo);
  }

  // Delegate to specialized services
  async createcomplaint(userId, complaintData, files = [], token = null) {
    // ... original create logic kept for backward compatibility
    // Will be gradually migrated to use this.createService
    return this._createComplaintInternal(userId, complaintData, files, token);
  }

  async _createComplaintInternal(userId, complaintData, files = [], token = null) {
    let nlpResult = null;
    const complaintText = complaintData.description || complaintData.descriptive_su;

    if (complaintText && (!complaintData.category || !complaintData.urgency_score)) {
      try {
        nlpResult = await advancedDecisionEngine.classify(complaintText);
        if (!complaintData.category && nlpResult.category && nlpResult.category !== "Others") {
          complaintData.category = nlpResult.category;
        }
        if (!complaintData.urgency_score) {
          complaintData.urgency_score = nlpResult.urgency || 30;
        }
        const urgencyVal = complaintData.urgency_score;
        if (urgencyVal >= 80) {
          complaintData.priority = "urgent";
          complaintData.urgency_level = "urgent";
        } else if (urgencyVal >= 60) {
          complaintData.priority = "high";
          complaintData.urgency_level = "high";
        } else if (urgencyVal >= 40) {
          complaintData.priority = "medium";
          complaintData.urgency_level = "medium";
        } else {
          complaintData.priority = "low";
          complaintData.urgency_level = "low";
        }
      } catch (nlpError) {
        console.warn("[COMPLAINT] NLP Classification failed:", nlpError.message);
      }
    }

    const normalizedData = normalizeComplaintData(complaintData);
    const insertData = prepareComplaintForInsert(normalizedData, userId);
    const validatedData = validateComplaintConsistency(insertData);

    const createdcomplaint = await this.complaintRepo.create(validatedData);

    if (files && files.length > 0) {
      try {
        await this.evidenceService.addEvidence(createdcomplaint.id, files, userId);
      } catch (err) {
        console.warn("[COMPLAINT] File upload failed:", err.message);
      }
    }

    if (complaintData.department_code) {
      await this.createService.processWorkflow(createdcomplaint, [complaintData.department_code]);
    }

    return await this.complaintRepo.findById(createdcomplaint.id, token);
  }

  // Delegate read methods
  async getcomplaintById(id, userId = null, token = null) {
    return await this.readService.getComplaintById(id, userId, token);
  }

  async getUsercomplaints(userId, options = {}) {
    return await this.readService.getUserComplaints(userId, options);
  }

  async getAllcomplaints(options = {}) {
    return await this.readService.getAllComplaints(options);
  }

  async getcomplaintStats(filters = {}) {
    return await this.readService.getComplaintStats(filters);
  }

  async getcomplaintLocations(filters = {}) {
    return await this.readService.getComplaintLocations(filters);
  }

  async getcomplaintLocationSlim(filters = {}) {
    return await this.readService.getComplaintLocationSlim(filters);
  }

  async getFalsecomplaints(filters = {}) {
    return await this.readService.getFalseComplaints(filters);
  }

  async getcomplaintEvidence(complaintId, user) {
    return await this.readService.getComplaintEvidence(complaintId, user);
  }

  async getcomplaintHistory(complaintId) {
    return await this.readService.getComplaintHistory(complaintId);
  }

  async getUserStatistics(userId) {
    return await this.readService.getUserStatistics(userId);
  }

  // Delegate update methods
  async updatecomplaintStatus(id, updateData, userId = null) {
    return await this.updateService.updateComplaintStatus(id, updateData, userId);
  }

  async assignCoordinator(complaintId, coordinatorId, assignedBy) {
    return await this.updateService.assignCoordinator(complaintId, coordinatorId, assignedBy);
  }

  async transfercomplaint(complaintId, fromDepartmentId, toDepartmentId, userId) {
    return await this.updateService.transferComplaint(complaintId, fromDepartmentId, toDepartmentId, userId);
  }

  async confirmResolution(complaintId, citizenId, confirmed, feedback = null) {
    return await this.updateService.confirmResolution(complaintId, citizenId, confirmed, feedback);
  }

  async markAsFalsecomplaint(complaintId, userId, reason, notes) {
    return await this.updateService.markAsFalseComplaint(complaintId, userId, reason, notes);
  }

  async markAsDuplicate(complaintId, mastercomplaintId, userId) {
    return await this.updateService.markAsDuplicate(complaintId, mastercomplaintId, userId);
  }

  // Delegate vote methods
  async upvotecomplaint(complaintId, userId) {
    return await this.voteService.upvoteComplaint(complaintId, userId);
  }

  async getPotentialDuplicatesForId(complaintId) {
    return await this.voteService.getPotentialDuplicatesForId(complaintId);
  }

  async bulkMergecomplaints(masterId, childIds) {
    return await this.voteService.bulkMergeComplaints(masterId, childIds);
  }

  // Delegate evidence methods
  async addEvidence(complaintId, files, userId = null) {
    return await this.evidenceService.addEvidence(complaintId, files, userId);
  }

  // Keep legacy methods for backward compatibility
  async detectDuplicates(complaintData) {
    return await this.createService.detectDuplicates(complaintData);
  }

  async _processWorkflow(complaint, departmentArray) {
    return await this.createService.processWorkflow(complaint, departmentArray);
  }

  async sendReminder(complaintId, userId) {
    // Notification service method
    const { data: complaint } = await this.complaintRepo.findById(complaintId);
    if (!complaint) return;
    await this.notificationService.notifyTaskAssigned(
      userId,
      complaintId,
      complaint.description,
      complaint.priority,
      null
    );
  }
}

module.exports = ComplaintService;
