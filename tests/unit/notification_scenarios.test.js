const ComplaintService = require('../../src/server/services/ComplaintService');
const CoordinatorService = require('../../src/server/services/CoordinatorService');
const NotificationService = require('../../src/server/services/NotificationService');

// Mock Repositories
const ComplaintRepository = require('../../src/server/repositories/ComplaintRepository');
const CoordinatorRepository = require('../../src/server/repositories/CoordinatorRepository');
const ComplaintAssignmentRepository = require('../../src/server/repositories/ComplaintAssignmentRepository');
const DepartmentRepository = require('../../src/server/repositories/DepartmentRepository');

jest.mock('../../src/server/repositories/ComplaintRepository');
jest.mock('../../src/server/repositories/CoordinatorRepository');
jest.mock('../../src/server/repositories/ComplaintAssignmentRepository');
jest.mock('../../src/server/repositories/DepartmentRepository');
jest.mock('../../src/server/services/DuplicationDetectionService');
jest.mock('../../src/server/services/SimilarityCalculatorService');
jest.mock('../../src/server/services/RuleBasedSuggestionService');
jest.mock('../../src/server/utils/departmentMapping', () => ({
  validateDepartmentCodes: jest.fn().mockResolvedValue({ validCodes: [], invalidCodes: [] }),
  getCategoryToDepartmentMapping: jest.fn().mockResolvedValue({}),
  getKeywordBasedSuggestions: jest.fn().mockResolvedValue([])
}));

jest.mock('../../src/server/models/Complaint', () => {
  return class MockComplaint {
    constructor(data) {
      Object.assign(this, data);
    }
    sanitizeForInsert() {
      return this;
    }
    static validate() {
      return { isValid: true, errors: [] };
    }
  };
});

describe('Notification Scenarios (Role-Based)', () => {
  let complaintService;
  let coordinatorService;
  let mockNotificationService;
  let mockComplaintRepo;
  let mockCoordinatorRepo;
  let mockAssignmentRepo;
  let mockDepartmentRepo;

  beforeEach(() => {
    jest.clearAllMocks();

    // 1. Setup Mock Notification Service
    mockNotificationService = {
      notifyComplaintSubmitted: jest.fn().mockResolvedValue(true),
      notifyAllCoordinators: jest.fn().mockResolvedValue(true),
      notifyComplaintStatusChanged: jest.fn().mockResolvedValue(true),
      notifyTaskAssigned: jest.fn().mockResolvedValue(true),
      notifyDepartmentAdmins: jest.fn().mockResolvedValue(true),
      notifyDepartmentAdminsByCode: jest.fn().mockResolvedValue(true),
      createNotification: jest.fn().mockResolvedValue(true),
      notifyComplaintDuplicate: jest.fn().mockResolvedValue(true),
      notifyComplaintStatusChange: jest.fn().mockResolvedValue(true),
      notifyComplaintAssignedToOfficer: jest.fn().mockResolvedValue(true)
    };

    // 2. Setup Mock Supabase Client
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null })
    };

    // 3. Setup Mock Repositories
    mockComplaintRepo = new ComplaintRepository();
    mockComplaintRepo.create = jest.fn();
    mockComplaintRepo.updateStatus = jest.fn();
    mockComplaintRepo.findById = jest.fn();
    mockComplaintRepo.supabase = mockSupabase;

    mockCoordinatorRepo = {
      getComplaintForReview: jest.fn(),
      logAction: jest.fn(),
      assignToDepartment: jest.fn(),
      markAsDuplicate: jest.fn(),
      supabase: mockSupabase,
      myRepoId: 'created-in-beforeEach',
      randomId: Math.random()
    };
    console.log('TEST DEBUG: BeforeEach Repo Random ID:', mockCoordinatorRepo.randomId);

    mockAssignmentRepo = new ComplaintAssignmentRepository();
    mockAssignmentRepo.assign = jest.fn();
    mockAssignmentRepo.supabase = mockSupabase;

    mockDepartmentRepo = new DepartmentRepository();
    mockDepartmentRepo.findByCode = jest.fn();
    mockDepartmentRepo.supabase = mockSupabase;

    // 4. Initialize Services with Mocks
    console.log('DEBUG: mockNotificationService:', mockNotificationService);
    console.log('DEBUG: mockDepartmentRepo:', mockDepartmentRepo);

    complaintService = new ComplaintService(
      mockComplaintRepo,
      mockAssignmentRepo,
      mockDepartmentRepo,
      mockNotificationService
    );
    coordinatorService = new CoordinatorService(
      mockCoordinatorRepo,
      mockAssignmentRepo,
      mockDepartmentRepo,
      mockNotificationService
    );
  });

  describe('Citizen Role Notifications', () => {
    test('should notify citizen when complaint status changes', async () => {
      // Arrange
      const complaintId = 'comp-456';
      const userId = 'user-citizen-1';
      const newStatus = 'in_progress';
      const coordId = 'user-coord-1';

      const mockComplaint = {
        id: complaintId,
        title: 'Broken Streetlight',
        submitted_by: userId,
        status: 'pending'
      };

      // Mock Supabase chain for markAsFalse/update
      const mockSingle = jest.fn();
      mockCoordinatorRepo.supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: mockSingle
            })
          })
        })
      });

      mockSingle.mockResolvedValue({ data: { ...mockComplaint, status: 'false', submitted_by: userId }, error: null });
      mockCoordinatorRepo.logAction.mockResolvedValue(true);

      // Act
      // We use markAsFalse as a proxy for status change notification logic in CoordinatorService
      await coordinatorService.markAsFalse(complaintId, coordId, 'False report');

      // Assert
      expect(mockNotificationService.notifyComplaintStatusChange).toHaveBeenCalledWith(
        userId,
        complaintId,
        'false',
        expect.stringContaining('marked as false'),
        expect.anything()
      );
    });

    test('should notify citizen when complaint is marked as duplicate', async () => {
      // Arrange
      const complaintId = 'comp-dup';
      const masterId = 'comp-master';
      const userId = 'user-citizen-1';
      const coordinatorId = 'user-coord-1';

      const mockComplaint = {
        id: complaintId,
        title: 'Duplicate Issue',
        submitted_by: userId
      };

      mockCoordinatorRepo.getComplaintForReview.mockResolvedValue(mockComplaint);
      mockCoordinatorRepo.markAsDuplicate.mockResolvedValue(true);
      mockCoordinatorRepo.logAction.mockResolvedValue(true);

      // Act
      await coordinatorService.markAsDuplicate(complaintId, masterId, coordinatorId);

      // Assert
      expect(mockNotificationService.notifyComplaintDuplicate).toHaveBeenCalledWith(
        userId,
        complaintId,
        mockComplaint.title,
        masterId
      );
    });
  });

  describe('Coordinator Role Notifications', () => {
    test('should notify all coordinators when a new complaint is submitted', async () => {
      // Arrange
      const userId = 'user-citizen-1';
      const complaintData = { title: 'New Issue', category: 'Roads' };
      const createdComplaint = { id: 'comp-new', ...complaintData, submitted_by: userId };

      mockComplaintRepo.create.mockResolvedValue(createdComplaint);
      mockDepartmentRepo.findByCode.mockResolvedValue(null); // No auto-assign

      // Act
      await complaintService.createComplaint(userId, complaintData, []);

      // Assert
      expect(mockNotificationService.notifyAllCoordinators).toHaveBeenCalledWith(
        createdComplaint.id,
        createdComplaint.title
      );
      // Should also notify the citizen
      expect(mockNotificationService.notifyComplaintSubmitted).toHaveBeenCalledWith(
        userId,
        createdComplaint.id,
        createdComplaint.title
      );
    });
  });

  describe('Officer/Department Role Notifications', () => {
    test('should notify department admins when assigned to department', async () => {
      // Arrange
      const complaintId = 'comp-123';
      const department = 'ENG';
      const coordinatorId = 'user-coord-1';

      const mockComplaint = { id: complaintId, title: 'Engineering Issue' };

      mockAssignmentRepo.assign.mockResolvedValue({ id: 'assign-1' });
      mockCoordinatorRepo.getComplaintForReview.mockResolvedValue(mockComplaint);
      mockCoordinatorRepo.logAction.mockResolvedValue(true);
      mockComplaintRepo.updateStatus.mockResolvedValue(true);
      mockDepartmentRepo.findByCode.mockResolvedValue({ id: 'dept-1', code: 'ENG' });
      mockCoordinatorRepo.assignToDepartment.mockResolvedValue({
        id: complaintId,
        title: mockComplaint.title,
        priority: 'medium',
        response_deadline: new Date()
      });

      // Mock Supabase responses with explicit chaining
      const mockSingle = jest.fn();
      const mockFrom = jest.fn();

      // Chain for departments: .from('departments').select().eq().single()
      const departmentsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: mockSingle
      };

      // Chain for complaints: .from('complaints').update().eq()
      const complaintsChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [mockComplaint], error: null })
      };

      // Chain for complaint_assignments: .from('complaint_assignments').insert().select().single()
      const assignmentsChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: mockSingle
      };

      mockFrom.mockImplementation((table) => {
        if (table === 'departments') return departmentsChain;
        if (table === 'complaints') return complaintsChain;
        if (table === 'complaint_assignments') return assignmentsChain;
        return { select: jest.fn().mockReturnThis() };
      });

      mockCoordinatorRepo.supabase.from = mockFrom;

      // Mock the single() call sequences
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'dept-1' }, error: null }) // 1. Department lookup
        .mockResolvedValueOnce({ data: { id: 'assign-1', title: 'Engineering Issue', priority: 'medium', response_deadline: null }, error: null }); // 2. Assignment creation

      // Act
      await coordinatorService.assignToDepartment(complaintId, department, coordinatorId, {});

      // Assert
      expect(mockNotificationService.notifyDepartmentAdminsByCode).toHaveBeenCalledWith(
        department,
        complaintId,
        mockComplaint.title
      );
    });

    test('should notify specific officer when directly assigned', async () => {
      // Arrange
      const complaintId = 'comp-123';
      const department = 'ENG';
      const coordinatorId = 'user-coord-1';
      const officerId = 'user-officer-1';

      const mockComplaint = { id: complaintId, title: 'Officer Task' };

      mockAssignmentRepo.assign.mockResolvedValue({ id: 'assign-1' });
      mockCoordinatorRepo.getComplaintForReview.mockResolvedValue(mockComplaint);
      mockCoordinatorRepo.logAction.mockResolvedValue(true);
      mockComplaintRepo.updateStatus.mockResolvedValue(true);
      mockDepartmentRepo.findByCode.mockResolvedValue({ id: 'dept-1', code: 'ENG' });
      mockCoordinatorRepo.assignToDepartment.mockResolvedValue({
        id: complaintId,
        title: mockComplaint.title,
        priority: 'info',
        response_deadline: null
      });

      // Act
      // Mock Supabase responses with explicit chaining
      const mockSingle = jest.fn();
      const mockFrom = jest.fn();

      // Chain for departments: .from('departments').select().eq().single()
      const departmentsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: mockSingle
      };

      // Chain for complaints: .from('complaints').update().eq()
      const complaintsChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };

      // Chain for assignments: .from('complaint_assignments').insert().select().single()
      const assignmentsChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: mockSingle
      };

      mockFrom.mockImplementation((table) => {
        if (table === 'departments') return departmentsChain;
        if (table === 'complaints') return complaintsChain;
        if (table === 'complaint_assignments') return assignmentsChain;
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn() };
      });

      mockCoordinatorRepo.supabase.from = mockFrom;

      mockSingle
        .mockResolvedValueOnce({ data: { id: 'dept-1' }, error: null }) // Department lookup
        .mockResolvedValueOnce({ data: { id: 'assign-1', title: 'Officer Task' }, error: null }); // Assignment creation

      // Act
      await coordinatorService.assignToDepartment(complaintId, department, coordinatorId, {
        assigned_to: officerId
      });

      // Assert
      expect(mockNotificationService.notifyTaskAssigned).toHaveBeenCalledWith(
        officerId,
        complaintId,
        mockComplaint.title,
        'info', // transformed priority
        null // default deadline
      );
    });
  });
});
