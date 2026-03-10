const DepartmentService = require("../services/departmentService");

class DepartmentController {

  constructor() {
    this.departmentService = new DepartmentService();
  }
  async getAlldepartments(req, res) {
    try {
      const departments = await this.departmentService.getAlldepartments();
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch departments"
      });
    }
  }
  async getActivedepartments(req, res) {
    try {
      const departments = await this.departmentService.getActivedepartments();
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error("Error fetching active departments:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch active departments"
      });
    }
  }
  async getdepartmentById(req, res) {
    try {
      const { id } = req.params;
      const department = await this.departmentService.getdepartmentById(id);
      res.json({
        success: true,
        data: department
      });
    } catch (error) {
      console.error("Error fetching department:", error);
      const status = error.message === "department not found" ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async createdepartment(req, res) {
    try {
      const department = await this.departmentService.createdepartment(req.body);
      res.status(201).json({
        success: true,
        data: department,
        message: "department created successfully"
      });
    } catch (error) {
      console.error("Error creating department:", error);
      const status = error.message.includes("Validation failed") ||
        error.message.includes("already exists") ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async updatedepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await this.departmentService.updatedepartment(id, req.body);
      res.json({
        success: true,
        data: department,
        message: "department updated successfully"
      });
    } catch (error) {
      console.error("Error updating department:", error);
      const status = error.message === "department not found" ? 404 :
        error.message.includes("Validation failed") ||
          error.message.includes("already exists") ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async deletedepartment(req, res) {
    try {
      const { id } = req.params;
      await this.departmentService.deletedepartment(id);
      res.json({
        success: true,
        message: "department deactivated successfully"
      });
    } catch (error) {
      console.error("Error deleting department:", error);
      const status = error.message === "department not found" ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
  async getdepartmentsByType(req, res) {
    try {
      const { type } = req.params;
      const departments = await this.departmentService.getdepartmentsByType(type);
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error("Error fetching departments by type:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch departments"
      });
    }
  }
  async getdepartmentOfficers(req, res) {
    try {
      const { id } = req.params;
      const officers = await this.departmentService.getdepartmentOfficers(id);
      res.json({
        success: true,
        data: officers
      });
    } catch (error) {
      console.error("Error fetching department officers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch department officers"
      });
    }
  }
  /**
   * Get all departments with their subcategory mappings
   */
  async getdepartmentsWithMappings(req, res) {
    try {
      const result = await this.departmentService.getdepartmentsWithMappings();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error fetching departments with mappings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch departments with mappings"
      });
    }
  }
  /**
   * Get departments by subcategory
   */
  async getdepartmentsBySubcategory(req, res) {
    try {
      const { subcategoryId } = req.params;
      const departments = await this.departmentService.getdepartmentsBySubcategory(subcategoryId);
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      console.error("Error fetching departments by subcategory:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch departments by subcategory"
      });
    }
  }
}

module.exports = DepartmentController;
