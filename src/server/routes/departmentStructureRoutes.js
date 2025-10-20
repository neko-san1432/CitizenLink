const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all categories with their subcategories and departments
router.get('/categories', async (req, res) => {
  try {
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select(`
        *,
        subcategories (
          *,
          departments (
            *,
            department_subcategory_mapping (
              is_primary,
              response_priority
            )
          )
        )
      `)
      .eq('is_active', true)
      .order('sort_order');

    if (categoriesError) throw categoriesError;

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// Get subcategories for a specific category
router.get('/categories/:categoryId/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const { data: subcategories, error } = await supabase
      .from('subcategories')
      .select(`
        *,
        departments (
          *,
          department_subcategory_mapping (
            is_primary,
            response_priority
          )
        )
      `)
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;

    res.json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subcategories'
    });
  }
});

// Get departments for a specific subcategory
router.get('/subcategories/:subcategoryId/departments', async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    
    const { data: departments, error } = await supabase
      .from('departments')
      .select(`
        *,
        department_subcategory_mapping (
          is_primary,
          response_priority
        )
      `)
      .or(`subcategory_id.eq.${subcategoryId},department_subcategory_mapping.subcategory_id.eq.${subcategoryId}`)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

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
});

// Get department structure for complaint form (simplified)
router.get('/complaint-form', async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
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
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching department structure for complaint form:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department structure'
    });
  }
});

// Admin: Create new category
router.post('/admin/categories', authenticateToken, async (req, res) => {
  try {
    const { name, code, description, icon, sort_order } = req.body;

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        code,
        description,
        icon,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category'
    });
  }
});

// Admin: Create new subcategory
router.post('/admin/subcategories', authenticateToken, async (req, res) => {
  try {
    const { category_id, name, code, description, sort_order } = req.body;

    const { data, error } = await supabase
      .from('subcategories')
      .insert({
        category_id,
        name,
        code,
        description,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subcategory'
    });
  }
});

// Admin: Create new department
router.post('/admin/departments', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      code, 
      description, 
      subcategory_id, 
      level, 
      response_time_hours, 
      escalation_time_hours,
      contact_info 
    } = req.body;

    const { data, error } = await supabase
      .from('departments')
      .insert({
        name,
        code,
        description,
        subcategory_id,
        level: level || 'LGU',
        response_time_hours: response_time_hours || 24,
        escalation_time_hours: escalation_time_hours || 72,
        contact_info: contact_info || {}
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create department'
    });
  }
});

// Admin: Map department to subcategory
router.post('/admin/department-mapping', authenticateToken, async (req, res) => {
  try {
    const { department_id, subcategory_id, is_primary, response_priority } = req.body;

    const { data, error } = await supabase
      .from('department_subcategory_mapping')
      .insert({
        department_id,
        subcategory_id,
        is_primary: is_primary || false,
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
    console.error('Error creating department mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create department mapping'
    });
  }
});

// Admin: Update category
router.put('/admin/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category'
    });
  }
});

// Admin: Update subcategory
router.put('/admin/subcategories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('subcategories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subcategory'
    });
  }
});

// Admin: Update department
router.put('/admin/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('departments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update department'
    });
  }
});

// Admin: Delete category (soft delete)
router.delete('/admin/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('categories')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Category deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate category'
    });
  }
});

// Admin: Delete subcategory (soft delete)
router.delete('/admin/subcategories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('subcategories')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Subcategory deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating subcategory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate subcategory'
    });
  }
});

// Admin: Delete department (soft delete)
router.delete('/admin/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('departments')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Department deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating department:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate department'
    });
  }
});

module.exports = router;
