const ComplaintService = require("../../src/server/services/complaintService");

describe("Notification scenarios (current services)", () => {
  let complaintService;
  let mockcomplaintRepo;
  let mocknotificationService;
  let mockHistoryRepo;

  beforeEach(() => {
    mockcomplaintRepo = {
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

    mocknotificationService = {
      notifycomplaintStatusChanged: jest.fn().mockResolvedValue(true),
      notifycomplaintUpdate: jest.fn().mockResolvedValue(true)
    };

    mockHistoryRepo = {
      addEntry: jest.fn().mockResolvedValue(true)
    };

    complaintService = new ComplaintService(
      mockcomplaintRepo,
      null,
      null,
      mocknotificationService,
      mockHistoryRepo
    );
  });

  test("notifies citizen when status changes", async () => {
    jest.spyOn(complaintService, "getcomplaintById").mockResolvedValue({
      id: "comp-1",
      submitted_by: "citizen-1",
      descriptive_su: "Road damage near market",
      workflow_status: "submitted",
      priority: "low",
      comment: {}
    });
    mockcomplaintRepo.update.mockResolvedValue({
      id: "comp-1",
      workflow_status: "in_progress"
    });

    await complaintService.updatecomplaintStatus(
      "comp-1",
      { status: "in_progress", notes: "Escalated to engineering" },
      "admin-1"
    );

    expect(mocknotificationService.notifycomplaintStatusChanged).toHaveBeenCalledWith(
      "citizen-1",
      "comp-1",
      expect.any(String),
      "in_progress",
      "submitted"
    );
  });

  test("records false complaint status correctly", async () => {
    mockcomplaintRepo.findById.mockResolvedValue({
      id: "comp-2",
      submitted_by: "citizen-2",
      workflow_status: "under_review",
      comment: {}
    });

    mockcomplaintRepo.supabase.single.mockResolvedValue({
      data: {
        id: "comp-2",
        is_false_complaint: true,
        false_complaint_reason: "Insufficient evidence",
        workflow_status: "rejected"
      },
      error: null
    });

    const result = await complaintService.markAsFalsecomplaint(
      "comp-2",
      "coord-1",
      "Insufficient evidence",
      "Validation checks failed"
    );

    expect(result.success).toBe(true);
    expect(result.data.workflow_status).toBe("rejected");
  });
});
