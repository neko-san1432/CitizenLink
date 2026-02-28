describe("ComplaintService - Management Features", () => {
  let ComplaintService;
  let complaintService;
  let mockSupabase;
  let mockComplaintRepo;
  let mockNotificationService;

  beforeEach(() => {
    jest.resetModules();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis()
    };

    mockComplaintRepo = {
      supabase: mockSupabase,
      findById: jest.fn(),
      logAction: jest.fn()
    };

    mockNotificationService = {
      notifyComplaintCancelled: jest.fn().mockResolvedValue(true),
      createNotification: jest.fn().mockResolvedValue(true)
    };

    ComplaintService = require("../../src/server/services/ComplaintService");
    // Inject mocks via constructor
    complaintService = new ComplaintService(mockComplaintRepo, null, null, mockNotificationService);
  });

  describe("markAsFalseComplaint", () => {
    test("should mark complaint as false and update status", async () => {
      const complaintId = "comp-123";
      const userId = "officer-123";
      const reason = "Prank call";

      // Mock findById
      mockComplaintRepo.findById.mockResolvedValue({
        id: complaintId,
        submitted_by: "citizen-1",
        comment: {}
      });

      // Mock logAction
      mockComplaintRepo.logAction.mockResolvedValue(true);

      // Mock Supabase update for markAsFalseComplaint
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: complaintId,
          is_false_complaint: true,
          false_complaint_reason: reason,
          workflow_status: "rejected"
        },
        error: null
      });

      const result = await complaintService.markAsFalseComplaint(complaintId, userId, reason);

      expect(result.success).toBe(true);
      expect(result.data.is_false_complaint).toBe(true);
      expect(result.data.workflow_status).toBe("rejected");

      // Verify update call
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        is_false_complaint: true,
        false_complaint_reason: reason,
        workflow_status: "rejected",
        marked_false_by: userId
      }));
    });
  });

  describe("markAsDuplicate", () => {
    test("should mark complaint as duplicate of master complaint", async () => {
      const complaintId = "comp-duplicate";
      const masterId = "comp-master";
      const userId = "officer-123";

      // Mock findById for both calls
      mockComplaintRepo.findById
        .mockResolvedValueOnce({ id: complaintId }) // Duplicate
        .mockResolvedValueOnce({ id: masterId });   // Master

      // Mock logAction
      mockComplaintRepo.logAction.mockResolvedValue(true);

      // Mock Supabase update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: complaintId,
          is_duplicate: true,
          master_complaint_id: masterId,
          workflow_status: "closed"
        },
        error: null
      });

      const result = await complaintService.markAsDuplicate(complaintId, masterId, userId);

      expect(result.success).toBe(true);
      expect(result.data.is_duplicate).toBe(true);
      expect(result.data.master_complaint_id).toBe(masterId);

    });
  });

  describe("updateComplaintStatus", () => {
    test("should update workflow status and notes", async () => {
      const complaintId = "comp-update";
      const userId = "officer-123";

      jest.spyOn(complaintService, "getComplaintById").mockResolvedValue({
        id: complaintId,
        submitted_by: "citizen-1",
        descriptive_su: "Test Complaint",
        workflow_status: "submitted",
        priority: "low",
        comment: {}
      });

      mockComplaintRepo.update = jest.fn().mockResolvedValue({
        id: complaintId,
        workflow_status: "in_progress"
      });

      const result = await complaintService.updateComplaintStatus(
        complaintId,
        { status: "in_progress", notes: "Assigned to team" },
        userId
      );

      expect(result.workflow_status).toBe("in_progress");
      expect(mockComplaintRepo.update).toHaveBeenCalledWith(
        complaintId,
        expect.objectContaining({
          workflow_status: "in_progress",
          coordinator_notes: "Assigned to team"
        })
      );
    });
  });
});
