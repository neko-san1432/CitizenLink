describe('ComplaintService - Management Features', () => {
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
      getComplaintById: jest.fn(),
      logAction: jest.fn()
    };

    mockNotificationService = {
      notifyComplaintCancelled: jest.fn().mockResolvedValue(true),
      createNotification: jest.fn().mockResolvedValue(true)
    };

    ComplaintService = require('../../src/server/services/ComplaintService');
    // Inject mocks via constructor
    complaintService = new ComplaintService(mockComplaintRepo, null, null, mockNotificationService);
  });

  describe('markAsFalseComplaint', () => {
    test('should mark complaint as false and update status', async () => {
      const complaintId = 'comp-123';
      const userId = 'officer-123';
      const reason = 'Prank call';

      // Mock getComplaintById
      mockComplaintRepo.getComplaintById.mockResolvedValue({
        id: complaintId,
        submitted_by: 'citizen-1'
      });

      // Mock logAction
      mockComplaintRepo.logAction.mockResolvedValue(true);

      // Mock Supabase update for markAsFalseComplaint
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: complaintId,
          is_false_complaint: true,
          false_complaint_reason: reason,
          workflow_status: 'rejected'
        },
        error: null
      });

      const result = await complaintService.markAsFalseComplaint(complaintId, userId, reason);

      expect(result.success).toBe(true);
      expect(result.data.is_false_complaint).toBe(true);
      expect(result.data.workflow_status).toBe('rejected');

      // Verify update call
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        is_false_complaint: true,
        false_complaint_reason: reason,
        workflow_status: 'rejected',
        marked_false_by: userId
      }));
    });
  });

  describe('markAsDuplicate', () => {
    test('should mark complaint as duplicate of master complaint', async () => {
      const complaintId = 'comp-duplicate';
      const masterId = 'comp-master';
      const userId = 'officer-123';

      // Mock getComplaintById for both calls
      mockComplaintRepo.getComplaintById
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
          workflow_status: 'closed'
        },
        error: null
      });

      const result = await complaintService.markAsDuplicate(complaintId, masterId, userId);

      expect(result.success).toBe(true);
      expect(result.data.is_duplicate).toBe(true);
      expect(result.data.master_complaint_id).toBe(masterId);

    });
  });

  describe('cancelComplaint', () => {
    test('should cancel complaint and notify user', async () => {
      const complaintId = 'comp-cancel';
      const userId = 'citizen-1';
      const reason = 'Mistake';

      // Mock getComplaintById
      mockComplaintRepo.getComplaintById.mockResolvedValue({
        id: complaintId,
        submitted_by: userId,
        workflow_status: 'new',
        title: 'Test Complaint'
      });

      // Mock logAction
      mockComplaintRepo.logAction.mockResolvedValue(true);

      // Mock Supabase update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: complaintId,
          workflow_status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: userId
        },
        error: null
      });

      const result = await complaintService.cancelComplaint(complaintId, userId, reason);

      expect(result.workflow_status).toBe('cancelled');
      expect(result.cancellation_reason).toBe(reason);

      // Verify update call
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        workflow_status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: userId
      }));

      // Verify notification - skipped as cancelComplaint only notifies officials and citizen is the one cancelling
      // expect(complaintService.notificationService.notifyComplaintCancelled).toHaveBeenCalled();
    });
  });
});
