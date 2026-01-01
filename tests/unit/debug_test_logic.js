const ComplaintService = require("../../src/server/services/ComplaintService");
const ComplaintRepository = require("../../src/server/repositories/ComplaintRepository");
const CoordinatorRepository = require("../../src/server/repositories/CoordinatorRepository");
const ComplaintAssignmentRepository = require("../../src/server/repositories/ComplaintAssignmentRepository");
const DepartmentRepository = require("../../src/server/repositories/DepartmentRepository");

// Mocks
const mockNotificationService = {
  notifyComplaintStatusChanged: console.log, // Log directly
  notifyComplaintAssignedToOfficer: console.log
};

const mockSupabase = {
  from: () => mockSupabase,
  select: () => mockSupabase,
  eq: () => mockSupabase,
  order: () => mockSupabase,
  limit: () => mockSupabase,
  single: async () => ({ data: {}, error: null }),
  insert: () => mockSupabase,
  update: () => mockSupabase,
  delete: () => mockSupabase,
  auth: {
    admin: {
      getUserById: async () => ({ data: { user: { id: "u1", email: "test@example.com" } }, error: null })
    }
  }
};

// Mock Repositories
const { normalizeComplaintData } = require("../../src/server/utils/complaintUtils");

class MockComplaintRepo {
  constructor() { this.supabase = mockSupabase; }
  async findById(id) {
    return { id, title: "Test", submitted_by: "u1", workflow_status: "pending" };
  }
  updateStatus(id, status) { return Promise.resolve({ id, status }); }
  logAction() { return Promise.resolve(true); }
  addTimelineEvent() { return Promise.resolve(true); }
}

// Override getComplaintById in ComplaintService to use normalizeComplaintData like real code
// Wait, ComplaintService ALREADY uses it. I don't need to override it.
// I just need to make sure my MockComplaintRepo returns what the real one returns.


class MockCoordinatorRepo { constructor() { this.supabase = mockSupabase; } }
class MockAssignmentRepo { constructor() { this.supabase = mockSupabase; } }
class MockDepartmentRepo { constructor() { this.supabase = mockSupabase; } }

async function run() {
  try {
    console.log("Setting up services...");
    const complaintRepo = new MockComplaintRepo();
    const coordinatorRepo = new MockCoordinatorRepo();
    const assignmentRepo = new MockAssignmentRepo();
    const departmentRepo = new MockDepartmentRepo();

    const complaintService = new ComplaintService(
      complaintRepo,
      assignmentRepo,
      departmentRepo,
      mockNotificationService
    );

    console.log("Running updateComplaintStatus...");
    await complaintService.updateComplaintStatus("c1", "in_progress", "Working on it", "admin1");
    console.log("✅ updateComplaintStatus success");
  } catch (e) {
    console.error("❌ Error:", e);
    console.error("Stack:", e.stack);
  }
}

// Mock other dependencies that might crash
require("../../src/server/services/DuplicationDetectionService"); // Should crash if not mocked?
// Actually, in standalone script, I can just NOT require them if ComplaintService doesn't need them.
// But ComplaintService requires them at top level?
// Let's check ComplaintService imports again.
// It imports ComplaintRepository etc.
// It does NOT import DuplicationDetectionService.
// So it should be fine.

run();
