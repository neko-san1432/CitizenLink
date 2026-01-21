const ComplaintService = require("../../src/server/services/ComplaintService");
const _CoordinatorService = require("../../src/server/services/_CoordinatorService");
const _NotificationService = require("../../src/server/services/_NotificationService");

// Mock Repositories
const ComplaintRepository = require("../../src/server/repositories/ComplaintRepository");
const _CoordinatorRepository = require("../../src/server/repositories/_CoordinatorRepository");
const ComplaintAssignmentRepository = require("../../src/server/repositories/ComplaintAssignmentRepository");
const DepartmentRepository = require("../../src/server/repositories/DepartmentRepository");

jest.mock("../../src/server/repositories/ComplaintRepository");
jest.mock("../../src/server/repositories/CoordinatorRepository");
jest.mock("../../src/server/repositories/ComplaintAssignmentRepository");
jest.mock("../../src/server/repositories/DepartmentRepository");
jest.mock("../../src/server/services/DuplicationDetectionService");
jest.mock("../../src/server/services/SimilarityCalculatorService");
jest.mock("../../src/server/services/RuleBasedSuggestionService");
jest.mock("../../src/server/utils/departmentMapping", () => ({
  validateDepartmentCodes: jest.fn().mockResolvedValue({ validCodes: [], invalidCodes: [] }),
  getCategoryToDepartmentMapping: jest.fn().mockResolvedValue({}),
  getKeywordBasedSuggestions: jest.fn().mockResolvedValue([])
}));

describe("Minimal Debug Test", () => {
  let complaintService;
  let mockNotificationService;
  let mockComplaintRepo;
  let mockAssignmentRepo;
  let mockDepartmentRepo;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNotificationService = {
      notifyComplaintStatusChanged: jest.fn().mockResolvedValue(true)
    };

    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockResolvedValue({ data: {}, error: null }),
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({ data: { user: { id: "u1", email: "test@example.com" } }, error: null })
        }
      }
    };

    mockComplaintRepo = new ComplaintRepository();
    mockComplaintRepo.supabase = mockSupabase;

    mockAssignmentRepo = new ComplaintAssignmentRepository();
    mockAssignmentRepo.supabase = mockSupabase;

    mockDepartmentRepo = new DepartmentRepository();
    mockDepartmentRepo.supabase = mockSupabase;

    complaintService = new ComplaintService(
      mockComplaintRepo,
      mockAssignmentRepo,
      mockDepartmentRepo,
      mockNotificationService
    );
  });

  test("should run logic without crashing", async () => {
    const complaintId = "comp-123";
    const userId = "user-citizen-1";
    const adminId = "user-admin-1";
    const oldStatus = "pending";
    const newStatus = "in_progress";

    const mockComplaint = {
      id: complaintId,
      title: "Broken Streetlight",
      submitted_by: userId,
      workflow_status: oldStatus
    };

    mockComplaintRepo.findById.mockResolvedValue(mockComplaint);
    mockComplaintRepo.updateStatus.mockResolvedValue({ ...mockComplaint, workflow_status: newStatus });
    mockComplaintRepo.updateStatus.mockResolvedValue({ ...mockComplaint, workflow_status: newStatus });
    // mockComplaintRepo.addTimelineEvent.mockResolvedValue(true); // Method does not exist

    try {
      await complaintService.updateComplaintStatus(complaintId, newStatus, "Working on it", adminId);
    } catch (e) {
      console.error("Update failed:", e);
      throw e;
    }

    expect(mockNotificationService.notifyComplaintStatusChanged).toHaveBeenCalled();
  });
});
