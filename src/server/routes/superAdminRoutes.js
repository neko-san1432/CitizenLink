const express = require('express');
const SuperAdminController = require('../controllers/SuperAdminController');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();
const superAdminController = new SuperAdminController();

// All routes require Super Admin role
const requireSuperAdmin = requireRole(['super-admin']);

/**
 * Dashboard
 */
router.get('/dashboard',
  authenticateUser,
  requireSuperAdmin,
  (req, res) => superAdminController.getDashboard(req, res)
);

/**
 * Role Management
 */
router.post('/role-swap',
  authenticateUser,
  requireSuperAdmin,
  (req, res) => superAdminController.roleSwap(req, res)
);

// User listing and details for Super Admin
router.get('/users',
  authenticateUser,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const UserService = require('../services/UserService');
      const { search, barangay, role, department, status, page, limit } = req.query;
      const filters = { role, department, status, search, includeInactive: true };
      const pagination = { page: page ? parseInt(page) : 1, limit: limit ? parseInt(limit) : 20 };
      const result = await UserService.getUsers(filters, pagination);

      const filteredUsers = barangay
        ? (result.users || []).filter(u => (u.address?.barangay || '').toLowerCase() === String(barangay).toLowerCase())
        : result.users;

      return res.json({ success: true, data: filteredUsers, pagination: result.pagination });
    } catch (error) {
      console.error('[SUPERADMIN_ROUTES] users list error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch users' });
    }
  }
);

router.get('/users/:id',
  authenticateUser,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const UserService = require('../services/UserService');
      const user = await UserService.getUserById(req.params.id);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      return res.json({ success: true, data: user });
    } catch (error) {
      console.error('[SUPERADMIN_ROUTES] user detail error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch user' });
    }
  }
);

router.get('/users/:id/complaints',
  authenticateUser,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const ComplaintService = require('../services/ComplaintService');
      const service = new ComplaintService();
      const options = {
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 10,
        status: req.query.status,
        type: req.query.type
      };
      const result = await service.getUserComplaints(req.params.id, options);
      return res.json({ success: true, data: result.complaints, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (error) {
      console.error('[SUPERADMIN_ROUTES] user complaints error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch complaints' });
    }
  }
);

/**
 * Department Transfers
 */
router.post('/transfer-department',
  authenticateUser,
  requireSuperAdmin,
  (req, res) => superAdminController.transferDepartment(req, res)
);

/**
 * Citizen Assignment
 */
router.post('/assign-citizen',
  authenticateUser,
  requireSuperAdmin,
  (req, res) => superAdminController.assignCitizen(req, res)
);

/**
 * System Logs
 */
router.get('/logs',
  authenticateUser,
  requireSuperAdmin,
  (req, res) => superAdminController.getLogs(req, res)
);

/**
 * System Statistics
 */
router.get('/statistics',
  authenticateUser,
  requireSuperAdmin,
  (req, res) => superAdminController.getStatistics(req, res)
);

module.exports = router;
