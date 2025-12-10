/**
 * Unit Tests: Heatmap Role-Based Filtering
 * Verifies that the controller enforces department filtering based on user roles
 */

const ComplaintController = require('../../src/server/controllers/ComplaintController');
const ComplaintService = require('../../src/server/services/ComplaintService');
const { createMockRequest, createMockResponse } = require('../utils/testHelpers');

// Mock ComplaintService
jest.mock('../../src/server/services/ComplaintService');

describe('Heatmap Role-Based Filtering', () => {
  let complaintController;
  let mockServiceInstance;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock service
    mockServiceInstance = {
      getComplaintLocations: jest.fn().mockResolvedValue([])
    };
    ComplaintService.mockImplementation(() => mockServiceInstance);

    // Initialize controller
    complaintController = new ComplaintController();
  });

  describe('Complaint Coordinator Access', () => {
    it('should allow coordinator to see all departments', async () => {
      const req = createMockRequest({
        method: 'GET',
        user: {
          id: 'coord_1',
          role: 'complaint-coordinator',
          department: 'DILG' // Even if they have a dept, they see all
        },
        query: {}
      });
      const res = createMockResponse();

      await complaintController.getComplaintLocations(req, res);

      // Should NOT have department filter forced
      expect(mockServiceInstance.getComplaintLocations).toHaveBeenCalledWith(
        expect.objectContaining({
          includeResolved: true
        })
      );

      const callArgs = mockServiceInstance.getComplaintLocations.mock.calls[0][0];
      expect(callArgs.department).toBeUndefined();
    });

    it('should allow coordinator to filter by specific department via query', async () => {
      const req = createMockRequest({
        method: 'GET',
        user: {
          id: 'coord_1',
          role: 'complaint-coordinator'
        },
        query: {
          department: 'DPWH'
        }
      });
      const res = createMockResponse();

      await complaintController.getComplaintLocations(req, res);

      // Should respect the query param
      expect(mockServiceInstance.getComplaintLocations).toHaveBeenCalledWith(
        expect.objectContaining({
          department: ['DPWH']
        })
      );
    });
  });

  describe('LGU Admin Access', () => {
    it('should restrict LGU admin to their own department', async () => {
      const req = createMockRequest({
        method: 'GET',
        user: {
          id: 'admin_1',
          role: 'lgu-admin',
          department: 'DPWH'
        },
        query: {}
      });
      const res = createMockResponse();

      await complaintController.getComplaintLocations(req, res);

      // Should force department filter
      expect(mockServiceInstance.getComplaintLocations).toHaveBeenCalledWith(
        expect.objectContaining({
          department: ['DPWH']
        })
      );
    });

    it('should ignore query param if it differs from assigned department', async () => {
      const req = createMockRequest({
        method: 'GET',
        user: {
          id: 'admin_1',
          role: 'lgu-admin',
          department: 'DPWH'
        },
        query: {
          department: 'DOH' // Trying to access another dept
        }
      });
      const res = createMockResponse();

      await complaintController.getComplaintLocations(req, res);

      // Should STILL use assigned department
      expect(mockServiceInstance.getComplaintLocations).toHaveBeenCalledWith(
        expect.objectContaining({
          department: ['DPWH']
        })
      );
    });
  });

  describe('LGU Officer Access', () => {
    it('should restrict LGU officer to their own department', async () => {
      const req = createMockRequest({
        method: 'GET',
        user: {
          id: 'officer_1',
          role: 'lgu-officer',
          department: 'BFP'
        },
        query: {}
      });
      const res = createMockResponse();

      await complaintController.getComplaintLocations(req, res);

      expect(mockServiceInstance.getComplaintLocations).toHaveBeenCalledWith(
        expect.objectContaining({
          department: ['BFP']
        })
      );
    });
  });
});
