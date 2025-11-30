
describe('Link Generator (HRService)', () => {
  let HRService;
  let hrService;
  let mockSupabase;
  let mockRoleService;
  let mockRoleValidation;
  let mockUserService;

  beforeEach(() => {
    jest.resetModules(); // Clear cache

    // Mock dependencies
    mockSupabase = {
      from: jest.fn(),
      auth: {
        admin: {
          getUserById: jest.fn()
        }
      }
    };

    const mockDatabaseInstance = {
      getClient: jest.fn(() => mockSupabase)
    };

    const MockDatabase = jest.fn(() => mockDatabaseInstance);
    MockDatabase.getInstance = jest.fn(() => mockDatabaseInstance);
    MockDatabase.getClient = jest.fn(() => mockSupabase);

    mockRoleService = {
      getUserRole: jest.fn(),
      supabase: mockSupabase
    };

    mockRoleValidation = {
      validateUserRole: jest.fn().mockResolvedValue({ isValid: true }),
      isValidDepartmentCode: jest.fn().mockResolvedValue(true)
    };

    mockUserService = {
      getUsers: jest.fn()
    };

    // Setup mocks using doMock
    jest.doMock('../../src/server/config/database', () => MockDatabase);
    jest.doMock('../../src/server/services/RoleManagementService', () => {
      return jest.fn().mockImplementation(() => mockRoleService);
    });
    jest.doMock('../../src/server/utils/roleValidation', () => mockRoleValidation);
    jest.doMock('../../src/server/services/UserService', () => mockUserService);

    // Require HRService after mocks are set up
    HRService = require('../../src/server/services/HRService');
    hrService = new HRService();
  });

  describe('generateSignupLink', () => {
    it('should generate a valid signup link for HR', async () => {
      const hrId = 'hr_123';
      const role = 'lgu-officer';
      const deptCode = 'HEALTH';

      mockRoleService.getUserRole.mockResolvedValue('lgu-hr');
      
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { user_metadata: { department: 'HEALTH' } } },
        error: null
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'departments') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { name: 'Health Department' } })
          };
        }
        if (table === 'signup_links') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'link_1',
                code: 'ABC12345',
                role,
                department_code: deptCode,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 3600000).toISOString()
              },
              error: null
            })
          };
        }
        return { select: jest.fn() };
      });

      const result = await hrService.generateSignupLink(hrId, role, deptCode);

      expect(result.success).toBe(true);
      expect(result.data.code).toBe('ABC12345');
    });

    it('should restrict LGU-HR to their own department', async () => {
      const hrId = 'hr_123';
      mockRoleService.getUserRole.mockResolvedValue('lgu-hr');
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { user_metadata: { department: 'HEALTH' } } }
      });
      await expect(hrService.generateSignupLink(hrId, 'lgu-officer', 'ENGINEERING'))
        .rejects.toThrow('You can only create signup links for your own department');
    });

    it('should allow Super Admin to create link for any department', async () => {
      const adminId = 'admin_123';
      
      mockRoleService.getUserRole.mockResolvedValue('super-admin');
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { user_metadata: {} } }
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'departments') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: {} }) };
        if (table === 'signup_links') return { insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { code: '123' } }) };
      });

      await expect(hrService.generateSignupLink(adminId, 'lgu-officer', 'ANY_DEPT'))
        .resolves.toHaveProperty('success', true);
    });
  });

  describe('validateSignupCode', () => {
    it('should validate a correct and active code', async () => {
      const code = 'VALID123';
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            code,
            is_active: true,
            expires_at: futureDate,
            used_at: null,
            role: 'lgu-officer',
            department_code: 'HEALTH'
          },
          error: null
        })
      });
      const result = await hrService.validateSignupCode(code);
      expect(result.valid).toBe(true);
      expect(result.data.role).toBe('lgu-officer');
    });

    it('should reject an expired code', async () => {
      const code = 'EXPIRED';
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            code,
            is_active: true,
            expires_at: pastDate,
            used_at: null
          }
        })
      });
      const result = await hrService.validateSignupCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject a used code', async () => {
      const code = 'USED';
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            code,
            is_active: true,
            expires_at: new Date(Date.now() + 3600).toISOString(),
            used_at: new Date().toISOString()
          }
        })
      });
      const result = await hrService.validateSignupCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('already been used');
    });

    it('should handle invalid/non-existent code', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      });
      const result = await hrService.validateSignupCode('INVALID');
      expect(result.valid).toBe(false);
    });
  });

  describe('deactivateSignupLink', () => {
    it('should deactivate a link created by the HR', async () => {
      const hrId = 'hr_123';
      const linkId = 'link_1';
      mockRoleService.getUserRole.mockResolvedValue('lgu-hr');
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: linkId, is_active: false }],
          error: null
        })
      });
      const result = await hrService.deactivateSignupLink(hrId, linkId);
      expect(result.success).toBe(true);
    });
  });

  describe('getSignupLinks', () => {
    it('should fetch links for LGU-HR filtered by department', async () => {
      const hrId = 'hr_123';
      const department = 'HEALTH';
      
      mockRoleService.getUserRole.mockResolvedValue('lgu-hr');
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { user_metadata: { department } } }
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [{ id: 'link_1', department_code: department }],
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder
      });

      const result = await hrService.getSignupLinks(hrId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockEq).toHaveBeenCalledWith('department_code', department);
    });

    it('should fetch all links for Super Admin', async () => {
      const adminId = 'admin_123';
      
      mockRoleService.getUserRole.mockResolvedValue('super-admin');
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { user_metadata: {} } }
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis(); // Might be called for is_active
      const mockOrder = jest.fn().mockResolvedValue({
        data: [{ id: 'link_1' }, { id: 'link_2' }],
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder
      });

      const result = await hrService.getSignupLinks(adminId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      // Should NOT filter by department_code
      const calls = mockEq.mock.calls;
      const deptFilter = calls.find(call => call[0] === 'department_code');
      expect(deptFilter).toBeUndefined();
    });
  });
});
