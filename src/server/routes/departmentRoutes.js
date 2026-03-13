const express = require("express");
const DepartmentController = require("../controllers/DepartmentController");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");

const router = express.Router();
const departmentController = new DepartmentController();

// SEC-16 FIX: CSRF protection on all state-changing routes
router.use(csrfProtection);
router.get("/active",
  authenticateUser,
  (req, res) => departmentController.getActivedepartments(req, res)
);
router.get("/with-mappings",
  authenticateUser,
  (req, res) => departmentController.getdepartmentsWithMappings(req, res)
);
router.get("/by-subcategory/:subcategoryId",
  authenticateUser,
  (req, res) => departmentController.getdepartmentsBySubcategory(req, res)
);
router.get("/type/:type",
  authenticateUser,
  (req, res) => departmentController.getdepartmentsByType(req, res)
);
router.get("/:id/officers",
  authenticateUser,
  (req, res) => departmentController.getdepartmentOfficers(req, res)
);
router.get("/",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => departmentController.getAlldepartments(req, res)
);
router.get("/:id",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => departmentController.getdepartmentById(req, res)
);
router.post("/",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => departmentController.createdepartment(req, res)
);
router.put("/:id",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => departmentController.updatedepartment(req, res)
);
router.delete("/:id",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => departmentController.deletedepartment(req, res)
);

module.exports = router;
