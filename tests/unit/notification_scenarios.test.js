const ComplaintService = require("../../src/server/services/ComplaintService");

describe("Notification scenarios (current services)", () => {
  let complaintService;
  let mockComplaintRepo;
  let mockNotificationService;
  let mockHistoryRepo;

  beforeEach(() => {
    mockComplaintRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      logAction: jest.fn().mockResolvedValue(true),
      supabase: {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn()
      }
    };

    mockNotificationService = {
      notifyComplaintStatusChanged: jest.fn().mockResolvedValue(true),
      notifyComplaintUpdate: jest.fn().mockResolvedValue(true)
    };

    mockHistoryRepo = {
      addEntry: jest.fn().mockResolvedValue(true)
    };

    complaintService = new ComplaintService(
      mockComplaintRepo,
      null,
      null,
      mockNotificationService,
      mockHistoryRepo
    );
  });

  test("notifies citizen when status changes", async () => {
    jest.spyOn(complaintService, "getComplaintById").mockResolvedValue({
      id: "comp-1",
      submitted_by: "citizen-1",
      descriptive_su: "Road damage near market",
      workflow_status: "submitted",
      priority: "low",
      comment: {}
    });
    mockComplaintRepo.update.mockResolvedValue({
      id: "comp-1",
      workflow_status: "in_progress"
    });

    await complaintService.updateComplaintStatus(
      "comp-1",
      { status: "in_progress", notes: "Escalated to engineering" },
      "admin-1"
    );

    expect(mockNotificationService.notifyComplaintStatusChanged).toHaveBeenCalledWith(
      "citizen-1",
      "comp-1",
      expect.any(String),
      "in_progress",
      "submitted"
    );
  });

  test("records false complaint status correctly", async () => {
    mockComplaintRepo.findById.mockResolvedValue({
      id: "comp-2",
      submitted_by: "citizen-2",
      workflow_status: "under_review",
      comment: {}
    });

    mockComplaintRepo.supabase.single.mockResolvedValue({
      data: {
        id: "comp-2",
        is_false_complaint: true,
        false_complaint_reason: "Insufficient evidence",
        workflow_status: "rejected"
      },
      error: null
    });

    const result = await complaintService.markAsFalseComplaint(
      "comp-2",
      "coord-1",
      "Insufficient evidence",
      "Validation checks failed"
    );

    expect(result.success).toBe(true);
    expect(result.data.workflow_status).toBe("rejected");
  });
});
