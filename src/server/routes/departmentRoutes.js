const express = require('express');
const DepartmentController = require('../controllers/DepartmentController');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();
const departmentController = new DepartmentController();
router.get('/active',
  authenticateUser,
  (req, res) => departmentController.getActiveDepartments(req, res)
);
router.get('/with-mappings',
  authenticateUser,
  (req, res) => departmentController.getDepartmentsWithMappings(req, res)
);
router.get('/by-subcategory/:subcategoryId',
  authenticateUser,
  (req, res) => departmentController.getDepartmentsBySubcategory(req, res)
);
router.get('/type/:type',
  authenticateUser,
  (req, res) => departmentController.getDepartmentsByType(req, res)
);
router.get('/:id/officers',
  authenticateUser,
  (req, res) => departmentController.getDepartmentOfficers(req, res)
);
router.get('/',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => departmentController.getAllDepartments(req, res)
);
router.get('/:id',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => departmentController.getDepartmentById(req, res)
);
router.post('/',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => departmentController.createDepartment(req, res)
);
router.put('/:id',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => departmentController.updateDepartment(req, res)
);
router.delete('/:id',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => departmentController.deleteDepartment(req, res)
);

module.exports = router;
