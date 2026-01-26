const express = require("express");

const router = express.Router();
const Database = require("../config/database");
const { authenticateUser, requireRole } = require("../middleware/auth");
const DepartmentService = require("../services/DepartmentService");

// Get all categories with their subcategories and departments
router.get("/categories", async (req, res) => {
  try {
    const supabase = Database.getClient();

    // 1. Fetch Categories
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (catError) throw catError;

    // 2. Fetch Subcategories
    const { data: subcategories, error: subError } = await supabase
      .from("subcategories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (subError) throw subError;

    // 3. Fetch Departments
    const { data: departments, error: deptError } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true);

    if (deptError) throw deptError;

    // 4. Fetch Mappings (Subcategory <-> Department)
    const { data: mappings, error: mapError } = await supabase
      .from("department_subcategory_mapping")
      .select("subcategory_id, department_id, response_priority");

    if (mapError) {
      console.warn("Error fetching mappings:", mapError.message);
      // Continue, just won't have departments mapped
    }

    // 5. Assemble Hierarchy
    const deptMap = new Map((departments || []).map(d => [d.id, d]));

    // Group departments by subcategory
    const subcategoryDepts = {};
    (mappings || []).forEach(m => {
      if (!subcategoryDepts[m.subcategory_id]) {
        subcategoryDepts[m.subcategory_id] = [];
      }
      const dept = deptMap.get(m.department_id);
      if (dept) {
        subcategoryDepts[m.subcategory_id].push({
          ...dept,
          department_subcategory_mapping: {
            response_priority: m.response_priority
          }
        });
      }
    });

    // Attach departments to subcategories
    const subsWithDepts = (subcategories || []).map(sub => ({
      ...sub,
      departments: (subcategoryDepts[sub.id] || []).sort((a, b) => {
        // Sort by response priority derived from mapping
        return (a.department_subcategory_mapping?.response_priority || 999) -
          (b.department_subcategory_mapping?.response_priority || 999);
      })
    }));

    // Attach subcategories to categories
    const result = (categories || []).map(cat => ({
      ...cat,
      subcategories: subsWithDepts.filter(s => s.category_id === cat.id)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories"
    });
  }
});

// Get subcategories for a specific category
router.get("/categories/:categoryId/subcategories", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { data: subcategories, error } = await Database.getClient()
      .from("subcategories")
      .select(`
        *,
        departments (
          *,
          department_subcategory_mapping (
            response_priority
          )
        )
      `)
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    res.json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subcategories"
    });
  }
});

// Get departments for a specific subcategory
router.get("/subcategories/:subcategoryId/departments", async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    // console.log removed for security
    const supabase = Database.getClient();
    // 1) Get ALL active departments (not just mapped ones)
    const { data: allDepartments, error: deptError } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (deptError) {
      console.error("[DEPT-API] Departments query error:", deptError);
      throw deptError;
    }
    // 2) Get department mappings for this subcategory (for reference)
    const { data: mappings, error: mapError } = await supabase
      .from("department_subcategory_mapping")
      .select("department_id,response_priority")
      .eq("subcategory_id", subcategoryId);
    if (mapError) {
      console.error("[DEPT-API] Mapping query error:", mapError);
      // Don't throw - mappings are optional
    }

    // 3) Attach mapping info to each department result (if mapped)
    const mapByDeptId = new Map((mappings || []).map(m => [m.department_id, m]));
    const enriched = (allDepartments || []).map(d => ({
      ...d,
      department_subcategory_mapping: mapByDeptId.get(d.id) || null
    }));

    // console.log removed for security

    res.json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch departments"
    });
  }
});

// Get ALL departments (for showing all departments regardless of category)
router.get("/departments/all", async (req, res) => {
  try {
    // console.log removed for security
    const supabase = Database.getClient();
    // Get ALL active departments
    const { data: allDepartments, error: deptError } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (deptError) {
      console.error("[DEPT-API] Departments query error:", deptError);
      throw deptError;
    }
    // console.log removed for security
    res.json({
      success: true,
      data: allDepartments
    });
  } catch (error) {
    console.error("Error fetching all departments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch departments"
    });
  }
});

// Get ALL departments (alias for /departments/all)
router.get("/departments", async (req, res) => {
  try {
    const supabase = Database.getClient();
    // Get ALL active departments
    const { data: allDepartments, error: deptError } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (deptError) {
      console.error("[DEPT-API] Departments query error:", deptError);
      throw deptError;
    }
    res.json({
      success: true,
      data: allDepartments
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch departments"
    });
  }
});

// Get department structure for complaint form (simplified)
router.get("/complaint-form", async (req, res) => {
  try {
    const { data: categories, error } = await Database.getClient()
      .from("categories")
      .select(`
        id,
        name,
        code,
        icon,
        subcategories (
          id,
          name,
          code,
          departments (
            id,
            name,
            code,
            level,
            response_time_hours
          )
        )
      `)
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error("Error fetching department structure for complaint form:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch department structure"
    });
  }
});

// Admin: Create new category
router.post(
  "/admin/categories",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      const category = await DepartmentService.createCategory(req.body);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Update category
router.put(
  "/admin/categories/:id",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      const category = await DepartmentService.updateCategory(
        req.params.id,
        req.body
      );
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Delete category (soft delete)
router.delete(
  "/admin/categories/:id",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      await DepartmentService.deleteCategory(req.params.id);
      res.json({ message: "Category deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating category:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Create new subcategory
router.post(
  "/admin/subcategories",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      const subcategory = await DepartmentService.createSubcategory(req.body);
      res.json(subcategory);
    } catch (error) {
      console.error("Error creating subcategory:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Update subcategory
router.put(
  "/admin/subcategories/:id",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      const subcategory = await DepartmentService.updateSubcategory(
        req.params.id,
        req.body
      );
      res.json(subcategory);
    } catch (error) {
      console.error("Error updating subcategory:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Delete subcategory (soft delete)
router.delete(
  "/admin/subcategories/:id",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      await DepartmentService.deleteSubcategory(req.params.id);
      res.json({ message: "Subcategory deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating subcategory:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Create new department
router.post(
  "/admin/departments",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      const department = await DepartmentService.createDepartment(req.body);
      res.json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Map department to subcategory
router.post(
  "/admin/department-mapping",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      // Expecting { department_id, subcategory_id, response_priority }
      const { department_id, subcategory_id, response_priority } = req.body;
      const { data, error } = await Database.getClient()
        .from("department_subcategory_mapping")
        .insert({
          department_id,
          subcategory_id,
          response_priority: response_priority || 1
        })
        .select()
        .single();
      if (error) throw error;
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error("Error creating department mapping:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create department mapping"
      });
    }
  }
);

// Admin: Update department
router.put(
  "/admin/departments/:id",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { data, error } = await Database.getClient()
        .from("departments")
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update department"
      });
    }
  }
);

// Admin: Delete department (soft delete)
router.delete(
  "/admin/departments/:id",
  authenticateUser,
  requireRole(["super-admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await Database.getClient()
        .from("departments")
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw error;
      res.json({
        success: true,
        message: "Department deactivated successfully"
      });
    } catch (error) {
      console.error("Error deactivating department:", error);
      res.status(500).json({
        success: false,
        error: "Failed to deactivate department"
      });
    }
  }
);

module.exports = router;
