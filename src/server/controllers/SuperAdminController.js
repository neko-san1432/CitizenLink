const SuperAdminService = require("../services/SuperAdminService");
const UserManagementService = require("../services/UserManagementService");

/**
 * SuperAdminController
 * Handles Super Admin operations
 */
class SuperAdminController {
  constructor() {
    this.superAdminService = new SuperAdminService();
    this.userManagementService = new UserManagementService();
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
        ...data,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Get dashboard error:", error);
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message,
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
          error: "User ID is required",
        });
      }
      if (!new_role) {
        return res.status(400).json({
          success: false,
          error: "New role is required",
        });
      }
      console.log("[SUPERADMIN_CONTROLLER] Role swap request:", {
        userId: user_id,
        newRole: new_role,
        performedBy: user.id,
        reason,
      });

      const result = await this.superAdminService.roleSwap(
        user_id,
        new_role,
        user.id,
        reason
      );

      console.log("[SUPERADMIN_CONTROLLER] Role swap result:", result);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Role swap error:", error);
      const status =
        error.message.includes("Only Super Admin") ||
        error.message.includes("Cannot change")
          ? 403
          : 500;
      res.status(status).json({
        success: false,
        error: error.message,
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
          error: "User ID is required",
        });
      }
      if (!to_department) {
        return res.status(400).json({
          success: false,
          error: "Target department is required",
        });
      }
      if (!reason) {
        return res.status(400).json({
          success: false,
          error: "Reason is required for department transfer",
        });
      }
      const result =
        await this.superAdminService.transferUserBetweenDepartments(
          user_id,
          from_department || null,
          to_department,
          user.id,
          reason
        );
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "[SUPERADMIN_CONTROLLER] Transfer department error:",
        error
      );
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message,
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
          error: "User ID is required",
        });
      }
      if (!role) {
        return res.status(400).json({
          success: false,
          error: "Role is required",
        });
      }
      if (!department_id) {
        return res.status(400).json({
          success: false,
          error: "Department ID is required",
        });
      }
      console.log("[SUPERADMIN_CONTROLLER] Assign citizen request:", {
        userId: user_id,
        role,
        departmentId: department_id,
        performedBy: user.id,
        reason,
      });

      const result = await this.superAdminService.assignCitizenToDepartment(
        user_id,
        role,
        department_id,
        user.id,
        reason
      );

      console.log("[SUPERADMIN_CONTROLLER] Assign citizen result:", result);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Assign citizen error:", error);
      const status = error.message.includes("Only Super Admin")
        ? 403
        : error.message.includes("Can only assign")
        ? 400
        : error.message.includes("Invalid department role")
        ? 400
        : 500;
      res.status(status).json({
        success: false,
        error: error.message || "Failed to assign citizen to department",
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
        log_type: req.query.log_type || "all",
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
      };
      const result = await this.superAdminService.getSystemLogs(
        user.id,
        options
      );

      // Also include terminal logs if requested
      const includeTerminal = req.query.include_terminal === "true";
      if (includeTerminal) {
        const consoleLogger = require("../utils/consoleLogger");
        const terminalLogs = consoleLogger.getLogs({
          level: req.query.terminal_level || "all",
          limit: req.query.terminal_limit
            ? parseInt(req.query.terminal_limit)
            : 500,
        });
        result.terminal_logs = terminalLogs;
      }

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Get logs error:", error);
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message,
      });
    }
  }
  /**
   * GET /api/superadmin/role-distribution
   * Get role distribution for pie chart
   */
  async getRoleDistribution(req, res) {
    try {
      const { user } = req;
      const result = await this.superAdminService.getRoleDistribution(user.id);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "[SUPERADMIN_CONTROLLER] Get role distribution error:",
        error
      );
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message,
      });
    }
  }
  /**
   * GET /api/superadmin/terminal-logs
   * Get terminal/console logs
   */
  async getTerminalLogs(req, res) {
    try {
      const { user } = req;
      // Validate super admin
      const adminRole = await this.superAdminService.roleService.getUserRole(
        user.id
      );
      if (adminRole !== "super-admin") {
        return res.status(403).json({
          success: false,
          error: "Only Super Admin can view terminal logs",
        });
      }

      const consoleLogger = require("../utils/consoleLogger");
      const options = {
        level: req.query.level || "all",
        limit: req.query.limit ? parseInt(req.query.limit) : 500,
        since: req.query.since || null,
      };

      const logs = consoleLogger.getLogs(options);

      res.json({
        success: true,
        logs,
        total: consoleLogger.getLogCount(),
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Get terminal logs error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
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
        ...result,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Get statistics error:", error);
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message,
      });
    }
  }
  /**
   * GET /api/superadmin/latest-users
   * Get latest registered users (with confirmed emails or OAuth)
   */
  async getLatestUsers(req, res) {
    try {
      const { user } = req;
      const limit = req.query.limit ? parseInt(req.query.limit) : 5;
      const result = await this.superAdminService.getLatestRegisteredUsers(
        user.id,
        limit
      );
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Get latest users error:", error);
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message,
      });
    }
  }
  /**
   * POST /api/superadmin/ban-user
   * Ban a user (temporary or permanent)
   */
  async banUser(req, res) {
    try {
      const { user } = req;
      const { user_id, type, duration, reason } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      if (!type || !["temporary", "permanent"].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Ban type must be "temporary" or "permanent"',
        });
      }

      if (type === "temporary" && (!duration || duration < 1)) {
        return res.status(400).json({
          success: false,
          error: "Duration (in hours) is required for temporary bans",
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Reason is required for banning",
        });
      }

      const result = await this.userManagementService.banUser(
        user_id,
        user.id,
        {
          type,
          duration: type === "temporary" ? parseInt(duration) : null,
          reason: reason.trim(),
        }
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Ban user error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to ban user",
      });
    }
  }
  /**
   * POST /api/superadmin/unban-user
   * Unban a user (only Super Admin)
   */
  async unbanUser(req, res) {
    try {
      const { user } = req;
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      // Verify user is Super Admin
      const adminRole = await this.superAdminService.roleService.getUserRole(
        user.id
      );
      if (adminRole !== "super-admin") {
        return res.status(403).json({
          success: false,
          error: "Only Super Admin can unban users",
        });
      }

      const result = await this.userManagementService.unbanUser(
        user_id,
        user.id
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Unban user error:", error);
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message || "Failed to unban user",
      });
    }
  }
  /**
   * GET /api/superadmin/growth-trends
   * Get platform growth trends
   */
  async getGrowthTrends(req, res) {
    try {
      const { user } = req;
      const result = await this.superAdminService.getGrowthTrends(user.id);
      res.json(result);
    } catch (error) {
      console.error("[SUPERADMIN_CONTROLLER] Get growth trends error:", error);
      const status = error.message.includes("Only Super Admin") ? 403 : 500;
      res.status(status).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = SuperAdminController;
