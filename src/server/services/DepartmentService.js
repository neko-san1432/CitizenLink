const DepartmentRepository = require('../repositories/DepartmentRepository');
const Department = require('../models/Department');

class DepartmentService {
  constructor() {
    this.departmentRepo = new DepartmentRepository();
  }

  async getAllDepartments() {
    return this.departmentRepo.findAll();
  }

  async getActiveDepartments() {
    return this.departmentRepo.findActive();
  }

  async getDepartmentById(id) {
    const department = await this.departmentRepo.findById(id);
    if (!department) {
      throw new Error('Department not found');
    }
    return department;
  }

  async createDepartment(departmentData) {
    const validation = Department.validate(departmentData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const codeExists = await this.departmentRepo.checkCodeExists(departmentData.code);
    if (codeExists) {
      throw new Error('Department code already exists');
    }

    const sanitizedData = {
      name: departmentData.name.trim(),
      code: departmentData.code.trim().toUpperCase(),
      description: departmentData.description?.trim() || null,
      is_active: departmentData.is_active !== undefined ? departmentData.is_active : true
    };

    return this.departmentRepo.create(sanitizedData);
  }

  async updateDepartment(id, departmentData) {
    const existingDepartment = await this.getDepartmentById(id);
    
    const validation = Department.validate(departmentData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (departmentData.code && departmentData.code !== existingDepartment.code) {
      const codeExists = await this.departmentRepo.checkCodeExists(departmentData.code, id);
      if (codeExists) {
        throw new Error('Department code already exists');
      }
    }

    const sanitizedData = {
      name: departmentData.name.trim(),
      code: departmentData.code.trim().toUpperCase(),
      description: departmentData.description?.trim() || null,
      is_active: departmentData.is_active
    };

    return this.departmentRepo.update(id, sanitizedData);
  }

  async deleteDepartment(id) {
    await this.getDepartmentById(id);
    return this.departmentRepo.softDelete(id);
  }

  async permanentlyDeleteDepartment(id) {
    await this.getDepartmentById(id);
    return this.departmentRepo.delete(id);
  }

  async getDepartmentsByType(type) {
    const allDepartments = await this.getActiveDepartments();
    
    const typeMapping = {
      'infrastructure': ['DPWH', 'ENGINEERING', 'ROADS', 'BRIDGES'],
      'health': ['DOH', 'HEALTH', 'MEDICAL', 'SANITATION'],
      'security': ['PNP', 'SECURITY', 'PEACE_ORDER', 'TRAFFIC'],
      'environment': ['DENR', 'ENVIRONMENT', 'WASTE_MANAGEMENT'],
      'social': ['DSWD', 'SOCIAL_SERVICES', 'WELFARE'],
      'utilities': ['UTILITIES', 'WATER', 'ELECTRICITY', 'TELECOM']
    };

    if (!typeMapping[type]) {
      return allDepartments;
    }

    return allDepartments.filter(dept => 
      typeMapping[type].some(keyword => 
        dept.code.includes(keyword) || dept.name.toUpperCase().includes(keyword)
      )
    );
  }

  async getDepartmentOfficers(departmentId) {
    // First get the department to get its code
    const department = await this.getDepartmentById(departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    // Get all users from auth.users
    const { data: allUsers, error } = await this.departmentRepo.supabase.auth.admin.listUsers();
    if (error) {
      throw new Error('Failed to fetch users');
    }

    // Filter users who are officers for this department
    const officers = allUsers.users
      .filter(user => {
        const metadata = user.user_metadata || {};
        const role = metadata.role || '';
        
        // Match lgu-* but exclude lgu-admin-* and lgu-hr-*
        const isOfficer = /^lgu-(?!admin|hr)/.test(role);
        
        // Check if the role contains the department code (e.g., lgu-wst for wst department)
        const roleContainsDepartment = role.includes(`-${department.code}`);
        const hasCorrectDepartment = metadata.department === department.code;
        
        return isOfficer && (roleContainsDepartment || hasCorrectDepartment);
      })
      .map(user => ({
        id: user.id,
        name: user.user_metadata?.name || user.email,
        email: user.email,
        role: user.user_metadata?.role,
        employee_id: user.user_metadata?.employee_id,
        mobile: user.user_metadata?.mobile,
        department: user.user_metadata?.department,
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at,
        is_online: this.isUserOnline(user.last_sign_in_at)
      }));

    return officers;
  }

  isUserOnline(lastSignInAt) {
    if (!lastSignInAt) return false;
    
    const lastSignIn = new Date(lastSignInAt);
    const now = new Date();
    const diffInMinutes = (now - lastSignIn) / (1000 * 60);
    
    // Consider user online if they signed in within the last 10 minutes
    return diffInMinutes <= 10;
  }

  getLastSeenText(lastSignInAt) {
    if (!lastSignInAt) return 'Never';
    
    const lastSignIn = new Date(lastSignInAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now - lastSignIn) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return lastSignIn.toLocaleDateString();
  }
}

module.exports = DepartmentService;
