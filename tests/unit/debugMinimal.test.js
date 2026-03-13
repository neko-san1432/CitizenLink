const ComplaintService = require("../../src/server/services/ComplaintService");

describe("Minimal complaintService smoke test", () => {
  test("updates workflow status and notifies submitter", async () => {
    const mockcomplaintRepo = {
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

    const mocknotificationService = {
      notifycomplaintStatusChanged: jest.fn().mockResolvedValue(true),
      notifycomplaintUpdate: jest.fn().mockResolvedValue(true)
    };

    const mockHistoryRepo = {
      addEntry: jest.fn().mockResolvedValue(true)
    };

    const complaintService = new ComplaintService(
      mockcomplaintRepo,
      null,
      null,
      mocknotificationService,
      mockHistoryRepo
    );

    jest.spyOn(complaintService, "getcomplaintById").mockResolvedValue({
      id: "comp-123",
      submitted_by: "user-citizen-1",
      descriptive_su: "Broken streetlight near plaza",
      workflow_status: "submitted",
      priority: "low",
      comment: {}
    });

    await complaintService.updatecomplaintStatus(
      "comp-123",
      { status: "in_progress", notes: "Assigned to field team" },
      "admin-1"
    );

    expect(mockcomplaintRepo.update).toHaveBeenCalledWith(
      "comp-123",
      expect.objectContaining({
        workflow_status: "in_progress",
        coordinator_notes: "Assigned to field team"
      })
    );
    expect(mocknotificationService.notifycomplaintStatusChanged).toHaveBeenCalled();
  });
});
