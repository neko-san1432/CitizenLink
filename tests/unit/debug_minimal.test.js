const ComplaintService = require("../../src/server/services/ComplaintService");

describe("Minimal ComplaintService smoke test", () => {
  test("updates workflow status and notifies submitter", async () => {
    const mockComplaintRepo = {
      findById: jest.fn().mockResolvedValue({
        id: "comp-123",
        submitted_by: "user-citizen-1",
        descriptive_su: "Broken streetlight near plaza",
        workflow_status: "submitted",
        priority: "low",
        comment: {}
      }),
      update: jest.fn().mockResolvedValue({
        id: "comp-123",
        workflow_status: "in_progress"
      }),
      logAction: jest.fn().mockResolvedValue(true)
    };

    const mockNotificationService = {
      notifyComplaintStatusChanged: jest.fn().mockResolvedValue(true),
      notifyComplaintUpdate: jest.fn().mockResolvedValue(true)
    };

    const mockHistoryRepo = {
      addEntry: jest.fn().mockResolvedValue(true)
    };

    const complaintService = new ComplaintService(
      mockComplaintRepo,
      null,
      null,
      mockNotificationService,
      mockHistoryRepo
    );

    jest.spyOn(complaintService, "getComplaintById").mockResolvedValue({
      id: "comp-123",
      submitted_by: "user-citizen-1",
      descriptive_su: "Broken streetlight near plaza",
      workflow_status: "submitted",
      priority: "low",
      comment: {}
    });

    await complaintService.updateComplaintStatus(
      "comp-123",
      { status: "in_progress", notes: "Assigned to field team" },
      "admin-1"
    );

    expect(mockComplaintRepo.update).toHaveBeenCalledWith(
      "comp-123",
      expect.objectContaining({
        workflow_status: "in_progress",
        coordinator_notes: "Assigned to field team"
      })
    );
    expect(mockNotificationService.notifyComplaintStatusChanged).toHaveBeenCalled();
  });
});
