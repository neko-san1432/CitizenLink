/**
 * HR Controller
 * Handles HR-specific operations including signup link generation
 */
const HRService = require('../services/HRService');
const UserService = require('../services/UserService');
const ComplaintService = require('../services/ComplaintService');

class HRController {

  constructor() {
    this.hrService = new HRService();
    this.userService = UserService;
    this.complaintService = new ComplaintService();
  }
  /**
   * Generate signup link
   */
  async generateSignupLink(req, res) {
    try {
      const { role, department_code, expires_in_hours } = req.body;
      const hrId = req.user.id;
      if (!role) {
        return res.status(400).json({
          success: false,
          error: 'Role is required'
        });
      }
      const result = await this.hrService.generateSignupLink(
        hrId,
        role,
        department_code,
        expires_in_hours || 24
      );
      res.json(result);
    } catch (error) {
      console.error('Generate signup link error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate signup link'
      });
    }
  }
  /**
   * Get signup links
   */
  async getSignupLinks(req, res) {
    try {
      const hrId = req.user.id;
      const filters = {
        role: req.query.role,
        department_code: req.query.department_code,
        is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined
      };
      const result = await this.hrService.getSignupLinks(hrId, filters);
      res.json(result);
    } catch (error) {
      console.error('Get signup links error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get signup links'
      });
    }
  }
  /**
   * Deactivate signup link
   */
  async deactivateSignupLink(req, res) {
    try {
      // console.log removed for security
      const { linkId } = req.params;
      const hrId = req.user.id;
      // console.log removed for security
      const result = await this.hrService.deactivateSignupLink(hrId, linkId);
      // console.log removed for security
      res.json(result);
    } catch (error) {
      console.error('[HR-CONTROLLER] Deactivate signup link error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to deactivate signup link'
      });
    }
  }
  /**
   * Validate signup code (public endpoint)
   */
  async validateSignupCode(req, res) {
    try {
      // console.log removed for security
      const { code } = req.params;
      if (!code) {
        // console.log removed for security
        return res.status(400).json({
          success: false,
          error: 'Code is required'
        });
      }
      // console.log removed for security
      const result = await this.hrService.validateSignupCode(code);
      // console.log removed for security
      res.json(result);
    } catch (error) {
      console.error('[HR] Validate signup code error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to validate signup code'
      });
    }
  }
  /**
   * Get HR dashboard
   */
  async getDashboard(req, res) {
    try {
      const hrId = req.user.id;
      const result = await this.hrService.getHRDashboard(hrId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get HR dashboard error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get HR dashboard'
      });
    }
  }
  /**
   * POST /api/hr/promote-to-officer
   */
  async promoteToOfficer(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, department, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: 'user_id is required' });
      }
      const result = await this.hrService.promoteToOfficer(user_id, hrId, { department, reason });
      return res.json(result);
    } catch (error) {
      console.error('[HR] promoteToOfficer error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to promote user' });
    }
  }
  /**
   * POST /api/hr/promote-to-admin
   */
  async promoteToAdmin(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, department, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: 'user_id is required' });
      }
      const result = await this.hrService.promoteToAdmin(user_id, hrId, { department, reason });
      return res.json(result);
    } catch (error) {
      console.error('[HR] promoteToAdmin error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to promote user' });
    }
  }
  /**
   * POST /api/hr/demote-to-officer
   */
  async demoteToOfficer(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: 'user_id is required' });
      }
      const result = await this.hrService.demoteAdminToOfficer(user_id, hrId, { reason });
      return res.json(result);
    } catch (error) {
      console.error('[HR] demoteToOfficer error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to demote user' });
    }
  }
  /**
   * POST /api/hr/strip-titles -> revert to citizen
   */
  async stripTitles(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, reason } = req.body;
      if (!user_id) {
        return res.status(400).json({ success: false, error: 'user_id is required' });
      }
      if (!reason) {
        return res.status(400).json({ success: false, error: 'reason is required' });
      }
      const result = await this.hrService.stripTitles(user_id, hrId, reason);
      return res.json(result);
    } catch (error) {
      console.error('[HR] stripTitles error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to strip titles' });
    }
  }
  /**
   * POST /api/hr/assign-department
   */
  async assignDepartment(req, res) {
    try {
      const hrId = req.user.id;
      const { user_id, department_id } = req.body;
      if (!user_id || !department_id) {
        return res.status(400).json({ success: false, error: 'user_id and department_id are required' });
      }
      const result = await this.hrService.assignOfficerToDepartment(user_id, department_id, hrId);
      return res.json(result);
    } catch (error) {
      console.error('[HR] assignDepartment error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to assign department' });
    }
  }
  /**
   * GET /api/hr/users
   * Supports search and barangay filter
   */
  async getUsers(req, res) {
    try {
      const { search, barangay, role, department, status, page, limit } = req.query;
      const filters = { role, department, status, search, includeInactive: true };
      const pagination = { page: page ? parseInt(page) : 1, limit: limit ? parseInt(limit) : 20 };
      const result = await this.userService.getUsers(filters, pagination);
      // Apply barangay filter client-side since admin.listUsers lacks server filters
      const filteredUsers = barangay
        ? (result.users || []).filter(u => (u.address?.barangay || '').toLowerCase() === String(barangay).toLowerCase())
        : result.users;
      return res.json({
        success: true,
        data: filteredUsers,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('[HR] getUsers error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch users' });
    }
  }
  /**
   * GET /api/hr/users/:id
   */
  async getUserDetails(req, res) {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      return res.json({ success: true, data: user });
    } catch (error) {
      console.error('[HR] getUserDetails error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch user' });
    }
  }
  /**
   * GET /api/hr/users/:id/complaints
   */
  async getUserComplaints(req, res) {
    try {
      const { id } = req.params;
      const options = {
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 10,
        status: req.query.status,
        type: req.query.type
      };
      const result = await this.complaintService.getUserComplaints(id, options);
      return res.json({
        success: true,
        data: result.complaints,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('[HR] getUserComplaints error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch complaints' });
    }
  }
}

module.exports = HRController;
