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
}

module.exports = DepartmentService;
