const DepartmentService = require('../services/DepartmentService');

class DepartmentController {

  constructor() {
    this.departmentService = new DepartmentService();
  }
  async getAllDepartments(req, res) {
    try {
      const departments = await this.departmentService.getAllDepartments();
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch departments'
      });
    }
  }
  async getActiveDepartments(req, res) {
    try {
      const departments = await this.departmentService.getActiveDepartments();
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error('Error fetching active departments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active departments'
      });
    }
  }
  async getDepartmentById(req, res) {
    try {
      const { id } = req.params;
      const department = await this.departmentService.getDepartmentById(id);
      res.json({
        success: true,
        data: department
      });
    } catch (error) {
      console.error('Error fetching department:', error);
      const status = error.message === 'Department not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async createDepartment(req, res) {
    try {
      const department = await this.departmentService.createDepartment(req.body);
      res.status(201).json({
        success: true,
        data: department,
        message: 'Department created successfully'
      });
    } catch (error) {
      console.error('Error creating department:', error);
      const status = error.message.includes('Validation failed') ||
                     error.message.includes('already exists') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await this.departmentService.updateDepartment(id, req.body);
      res.json({
        success: true,
        data: department,
        message: 'Department updated successfully'
      });
    } catch (error) {
      console.error('Error updating department:', error);
      const status = error.message === 'Department not found' ? 404 :
        error.message.includes('Validation failed') ||
                     error.message.includes('already exists') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      await this.departmentService.deleteDepartment(id);
      res.json({
        success: true,
        message: 'Department deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting department:', error);
      const status = error.message === 'Department not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async getDepartmentsByType(req, res) {
    try {
      const { type } = req.params;
      const departments = await this.departmentService.getDepartmentsByType(type);
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error('Error fetching departments by type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch departments'
      });
    }
  }
  async getDepartmentOfficers(req, res) {
    try {
      const { id } = req.params;
      const officers = await this.departmentService.getDepartmentOfficers(id);
      res.json({
        success: true,
        data: officers
      });
    } catch (error) {
      console.error('Error fetching department officers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch department officers'
      });
    }
  }
  /**
   * Get all departments with their subcategory mappings
   */
  async getDepartmentsWithMappings(req, res) {
    try {
      const result = await this.departmentService.getDepartmentsWithMappings();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching departments with mappings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch departments with mappings'
      });
    }
  }
  /**
   * Get departments by subcategory
   */
  async getDepartmentsBySubcategory(req, res) {
    try {
      const { subcategoryId } = req.params;
      const departments = await this.departmentService.getDepartmentsBySubcategory(subcategoryId);
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error('Error fetching departments by subcategory:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch departments by subcategory'
      });
    }
  }
}

module.exports = DepartmentController;
