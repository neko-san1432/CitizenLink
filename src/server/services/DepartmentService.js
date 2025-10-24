const DepartmentRepository = require('../repositories/DepartmentRepository');
const { getDepartmentsByCategory } = require('../utils/departmentMapping');
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
    try {
      // Map complaint types to department structure categories
      const typeToCategoryMapping = {
        'infrastructure': 'Infrastructure & Public Works',
        'health': 'Health & Social Services',
        'security': 'Law Enforcement & Legal Affairs',
        'environment': 'Environment & Sanitation',
        'social': 'Health & Social Services',
        'utilities': 'Infrastructure & Public Works'
      };

      const categoryName = typeToCategoryMapping[type];
      if (!categoryName) {
        return await this.getActiveDepartments();
      }

      // Get departments from the new structure
      const departments = await getDepartmentsByCategory(categoryName);
      
      // Convert to the expected format
      return departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description || '',
        is_active: true
      }));
    } catch (error) {
      console.error('Error getting departments by type:', error);
      // Fallback to all departments
      return await this.getActiveDepartments();
    }
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

  /**
   * Get all departments with their subcategory mappings
   */
  async getDepartmentsWithMappings() {
    const Database = require('../config/database');
    const supabase = Database.getClient();

    try {
      // Get all departments
      const { data: departments, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (deptError) throw deptError;

      // Get department-subcategory mappings
      const { data: mappings, error: mapError } = await supabase
        .from('department_subcategory_mapping')
        .select(`
          department_id,
          subcategory_id,
          is_primary,
          response_priority,
          departments (code),
          subcategories (code)
        `);

      if (mapError) throw mapError;

      return {
        departments,
        mappings
      };
    } catch (error) {
      console.error('Error getting departments with mappings:', error);
      throw error;
    }
  }

  /**
   * Get departments by subcategory
   */
  async getDepartmentsBySubcategory(subcategoryId) {
    const Database = require('../config/database');
    const supabase = Database.getClient();

    try {
      const { data, error } = await supabase
        .from('department_subcategory_mapping')
        .select(`
          department_id,
          is_primary,
          response_priority,
          departments (
            id,
            code,
            name,
            description,
            response_time_hours,
            level
          )
        `)
        .eq('subcategory_id', subcategoryId)
        .order('response_priority');

      if (error) throw error;

      // Flatten the structure
      return data.map(item => ({
        department_id: item.department_id,
        department_code: item.departments.code,
        department_name: item.departments.name,
        is_primary: item.is_primary,
        response_priority: item.response_priority,
        response_time_hours: item.departments.response_time_hours,
        level: item.departments.level
      }));
    } catch (error) {
      console.error('Error getting departments by subcategory:', error);
      throw error;
    }
  }
}

module.exports = DepartmentService;

