const SuperAdminService = require('../services/SuperAdminService');

/**
 * SuperAdminController
 * Handles Super Admin operations
 */
class SuperAdminController {
  constructor() {
    this.superAdminService = new SuperAdminService();
  }

  /**
   * GET /api/superadmin/dashboard
   * Get Super Admin dashboard data
   */
  async getDashboard(req, res) {
    try {
      const { user } = req;
      const data = await this.superAdminService.getDashboard(user.id);

      res.json({
        success: true,
        ...data
      });
    } catch (error) {
      console.error('[SUPERADMIN_CONTROLLER] Get dashboard error:', error);
      const status = error.message.includes('Only Super Admin') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/superadmin/role-swap
   * Swap user role (any to any)
   */
  async roleSwap(req, res) {
    try {
      const { user } = req;
      const { user_id, new_role, reason } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      if (!new_role) {
        return res.status(400).json({
          success: false,
          error: 'New role is required'
        });
      }

      const result = await this.superAdminService.roleSwap(
        user_id,
        new_role,
        user.id,
        reason
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[SUPERADMIN_CONTROLLER] Role swap error:', error);
      const status = error.message.includes('Only Super Admin') || error.message.includes('Cannot change') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/superadmin/transfer-department
   * Transfer user between departments
   */
  async transferDepartment(req, res) {
    try {
      const { user } = req;
      const { user_id, from_department, to_department, reason } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      if (!from_department || !to_department) {
        return res.status(400).json({
          success: false,
          error: 'From and to departments are required'
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Reason is required for department transfer'
        });
      }

      const result = await this.superAdminService.transferUserBetweenDepartments(
        user_id,
        from_department,
        to_department,
        user.id,
        reason
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[SUPERADMIN_CONTROLLER] Transfer department error:', error);
      const status = error.message.includes('Only Super Admin') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/superadmin/assign-citizen
   * Assign citizen to department with role
   */
  async assignCitizen(req, res) {
    try {
      const { user } = req;
      const { user_id, role, department_id, reason } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      if (!role) {
        return res.status(400).json({
          success: false,
          error: 'Role is required'
        });
      }

      if (!department_id) {
        return res.status(400).json({
          success: false,
          error: 'Department ID is required'
        });
      }

      const result = await this.superAdminService.assignCitizenToDepartment(
        user_id,
        role,
        department_id,
        user.id,
        reason
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[SUPERADMIN_CONTROLLER] Assign citizen error:', error);
      const status = error.message.includes('Only Super Admin') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/superadmin/logs
   * Get system logs
   */
  async getLogs(req, res) {
    try {
      const { user } = req;
      const options = {
        log_type: req.query.log_type || 'all',
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
        date_from: req.query.date_from,
        date_to: req.query.date_to
      };

      const result = await this.superAdminService.getSystemLogs(user.id, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[SUPERADMIN_CONTROLLER] Get logs error:', error);
      const status = error.message.includes('Only Super Admin') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/superadmin/statistics
   * Get system statistics
   */
  async getStatistics(req, res) {
    try {
      const { user } = req;
      const result = await this.superAdminService.getSystemStatistics(user.id);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[SUPERADMIN_CONTROLLER] Get statistics error:', error);
      const status = error.message.includes('Only Super Admin') ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = SuperAdminController;
