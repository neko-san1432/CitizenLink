class ComplaintUpdateService {
  constructor(complaintRepo, assignmentRepo) {
    this.complaintRepo = complaintRepo || require("../../repositories/ComplaintRepository");
    this.assignmentRepo = assignmentRepo || require("../../repositories/ComplaintAssignmentRepository");
  }

  async updateComplaintStatus(id, updateData, userId = null) {
    return await this.complaintRepo.updateStatus(id, updateData, userId);
  }

  async assignCoordinator(complaintId, coordinatorId, assignedBy) {
    return await this.complaintRepo.assignCoordinator(complaintId, coordinatorId, assignedBy);
  }

  async transferComplaint(complaintId, fromDepartmentId, toDepartmentId, userId) {
    return await this.complaintRepo.transfer(complaintId, fromDepartmentId, toDepartmentId, userId);
  }

  async reconcileWorkflowStatus(complaintId) {
    return await this.complaintRepo.reconcileStatus(complaintId);
  }

  async confirmResolution(complaintId, citizenId, confirmed, feedback = null) {
    return await this.complaintRepo.confirmResolution(complaintId, citizenId, confirmed, feedback);
  }

  async createAssignment(complaintId, officerIds, assignedBy) {
    const results = [];
    for (const officerId of officerIds) {
      const result = await this.assignmentRepo.assign(complaintId, officerId, assignedBy);
      results.push(result);
    }
    return results;
  }

  async markAsFalseComplaint(complaintId, userId, reason, notes) {
    return await this.complaintRepo.markAsFalse(complaintId, userId, reason, notes);
  }

  async markAsDuplicate(complaintId, masterComplaintId, userId) {
    return await this.complaintRepo.markAsDuplicate(complaintId, masterComplaintId, userId);
  }
}

module.exports = ComplaintUpdateService;
