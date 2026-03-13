class ComplaintReadService {
  constructor(complaintRepo) {
    this.complaintRepo = complaintRepo || require("../../repositories/ComplaintRepository");
  }

  async getComplaintById(id, userId = null, token = null) {
    return await this.complaintRepo.findById(id, token);
  }

  async getUserComplaints(userId, options = {}) {
    return await this.complaintRepo.findByUserId(userId, options);
  }

  async getAllComplaints(options = {}) {
    return await this.complaintRepo.findAll(options);
  }

  async getComplaintStats(filters = {}) {
    return await this.complaintRepo.getStats(filters);
  }

  async getComplaintLocations(filters = {}) {
    return await this.complaintRepo.getLocations(filters);
  }

  async getComplaintLocationSlim(filters = {}) {
    return await this.complaintRepo.getLocationsSlim(filters);
  }

  async getFalseComplaints(filters = {}) {
    return await this.complaintRepo.findFalseComplaints(filters);
  }

  async getFalseComplaintStatistics() {
    return await this.complaintRepo.getFalseComplaintStats();
  }

  async getComplaintEvidence(complaintId, user) {
    return await this.complaintRepo.findEvidenceByComplaintId(complaintId);
  }

  async getComplaintHistory(complaintId) {
    return await this.complaintRepo.findHistoryByComplaintId(complaintId);
  }
}

module.exports = ComplaintReadService;
