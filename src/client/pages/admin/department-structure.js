/**
 * Department Structure Management
 * Admin interface for managing categories, subcategories, and departments
 */
import showMessage from "../../components/toast.js";
import { apiClient } from "../../config/apiClient.js";

let categories = [];
const subcategories = [];
const departments = [];
// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  await loadAllData();
  setupEventListeners();
});
/**
 * Load all department structure data
 */
async function loadAllData() {
  try {
    // Load categories with their subcategories and departments
    const { data, error } = await apiClient.get("/api/department-structure/categories");
    if (error) throw error;
    categories = data || [];
    renderCategories();
    updateStats();
  } catch (error) {
    console.error("Error loading department structure:", error);
    showMessage("error", "Failed to load department structure");
  }
}
/**
 * Render categories with their subcategories and departments
 */
function renderCategories() {
  const container = document.getElementById("categories-container");
  if (!container) return;
  if (categories.length === 0) {
    container.innerHTML = '<div class="loading">No categories found</div>';
    return;
  }
  container.innerHTML = categories.map(category => `
        <div class="category-item">
            <div class="category-header" onclick="toggleCategory('${category.id}')">
                <h3 class="category-title">${category.icon} ${category.name}</h3>
                <div class="category-actions">
                    <button class="btn-sm btn-edit" onclick="editCategory('${category.id}')">Edit</button>
                    <button class="btn-sm btn-delete" onclick="deleteCategory('${category.id}')">Delete</button>
                </div>
            </div>
            <div class="subcategories-container" id="subcategories-${category.id}">
                ${category.subcategories ? category.subcategories.map(subcategory => `
                    <div class="subcategory-item">
                        <div class="subcategory-header" onclick="toggleSubcategory('${subcategory.id}')">
                            <h4 class="subcategory-title">${subcategory.name}</h4>
                            <div class="category-actions">
                                <button class="btn-sm btn-edit" onclick="editSubcategory('${subcategory.id}')">Edit</button>
                                <button class="btn-sm btn-delete" onclick="deleteSubcategory('${subcategory.id}')">Delete</button>
                            </div>
                        </div>
                        <div class="departments-container" id="departments-${subcategory.id}">
                            ${subcategory.departments ? subcategory.departments.map(department => `
                                <div class="department-item">
                                    <div class="department-info">
                                        <div class="department-name">${department.name}</div>
                                        <div class="department-details">
                                            ${department.code} | ${department.level} | ${department.response_time_hours}h response
                                        </div>
                                    </div>
                                    <div class="category-actions">
                                        <button class="btn-sm btn-edit" onclick="editDepartment('${department.id}')">Edit</button>
                                        <button class="btn-sm btn-delete" onclick="deleteDepartment('${department.id}')">Delete</button>
                                    </div>
                                </div>
                            `).join("") : '<div class="loading">No departments</div>'}
                        </div>
                    </div>
                `).join("") : '<div class="loading">No subcategories</div>'}
            </div>
        </div>
    `).join("");
}
/**
 * Update statistics
 */
function updateStats() {
  let totalSubcategories = 0;
  let totalDepartments = 0;
  let activeDepartments = 0;
  categories.forEach(category => {
    if (category.subcategories) {
      totalSubcategories += category.subcategories.length;
      category.subcategories.forEach(subcategory => {
        if (subcategory.departments) {
          totalDepartments += subcategory.departments.length;
          activeDepartments += subcategory.departments.filter(dept => dept.is_active).length;
        }
      });
    }
  });
  document.getElementById("total-categories").textContent = categories.length;
  document.getElementById("total-subcategories").textContent = totalSubcategories;
  document.getElementById("total-departments").textContent = totalDepartments;
  document.getElementById("active-departments").textContent = activeDepartments;
}
/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Category form
  document.getElementById("category-form").addEventListener("submit", handleCategorySubmit);
  // Subcategory form
  document.getElementById("subcategory-form").addEventListener("submit", handleSubcategorySubmit);
  // Department form
  document.getElementById("department-form").addEventListener("submit", handleDepartmentSubmit);
}
/**
 * Toggle category expansion
 */
window.toggleCategory = function(categoryId) {
  const container = document.getElementById(`subcategories-${categoryId}`);
  if (container) {
    container.classList.toggle("expanded");
  }
};
/**
 * Toggle subcategory expansion
 */
window.toggleSubcategory = function(subcategoryId) {
  const container = document.getElementById(`departments-${subcategoryId}`);
  if (container) {
    container.classList.toggle("expanded");
  }
};
/**
 * Open modal for adding/editing
 */
window.openModal = function(type, editId = null) {
  const modal = document.getElementById(`${type}-modal`);
  if (!modal) return;
  // Reset form
  const form = document.getElementById(`${type}-form`);
  if (form) {
    form.reset();
  }
  // Set modal title
  const title = document.getElementById(`${type}-modal-title`);
  if (title) {
    title.textContent = editId ? `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}` : `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }
  // Populate dropdowns
  if (type === "subcategory") {
    populateCategoryDropdown();
  } else if (type === "department") {
    populateSubcategoryDropdown();
  }
  // If editing, populate form with existing data
  if (editId) {
    populateFormForEdit(type, editId);
  }
  modal.classList.add("show");
};
/**
 * Close modal
 */
window.closeModal = function(type) {
  const modal = document.getElementById(`${type}-modal`);
  if (modal) {
    modal.classList.remove("show");
  }
};
/**
 * Populate category dropdown
 */
function populateCategoryDropdown() {
  const select = document.getElementById("subcategory-category");
  if (!select) return;
  select.innerHTML = '<option value="">Select a category</option>';
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.icon} ${category.name}`;
    select.appendChild(option);
  });
}
/**
 * Populate subcategory dropdown
 */
function populateSubcategoryDropdown() {
  const select = document.getElementById("department-subcategory");
  if (!select) return;
  select.innerHTML = '<option value="">Select a subcategory</option>';
  categories.forEach(category => {
    if (category.subcategories) {
      category.subcategories.forEach(subcategory => {
        const option = document.createElement("option");
        option.value = subcategory.id;
        option.textContent = `${category.name} - ${subcategory.name}`;
        select.appendChild(option);
      });
    }
  });
}
/**
 * Handle category form submission
 */
async function handleCategorySubmit(e) {
  e.preventDefault();
  const formData = {
    name: document.getElementById("category-name").value,
    code: document.getElementById("category-code").value,
    description: document.getElementById("category-description").value,
    icon: document.getElementById("category-icon").value,
    sort_order: parseInt(document.getElementById("category-sort-order").value) || 0
  };
  try {
    const { data, error } = await apiClient.post("/api/department-structure/admin/categories", formData);
    if (error) throw error;
    showMessage("success", "Category created successfully");
    closeModal("category");
    await loadAllData();
  } catch (error) {
    console.error("Error creating category:", error);
    showMessage("error", "Failed to create category");
  }
}
/**
 * Handle subcategory form submission
 */
async function handleSubcategorySubmit(e) {
  e.preventDefault();
  const formData = {
    category_id: document.getElementById("subcategory-category").value,
    name: document.getElementById("subcategory-name").value,
    code: document.getElementById("subcategory-code").value,
    description: document.getElementById("subcategory-description").value,
    sort_order: parseInt(document.getElementById("subcategory-sort-order").value) || 0
  };
  try {
    const { data, error } = await apiClient.post("/api/department-structure/admin/subcategories", formData);
    if (error) throw error;
    showMessage("success", "Subcategory created successfully");
    closeModal("subcategory");
    await loadAllData();
  } catch (error) {
    console.error("Error creating subcategory:", error);
    showMessage("error", "Failed to create subcategory");
  }
}
/**
 * Handle department form submission
 */
async function handleDepartmentSubmit(e) {
  e.preventDefault();
  const formData = {
    subcategory_id: document.getElementById("department-subcategory").value,
    name: document.getElementById("department-name").value,
    code: document.getElementById("department-code").value,
    description: document.getElementById("department-description").value,
    level: document.getElementById("department-level").value,
    response_time_hours: parseInt(document.getElementById("department-response-time").value) || 24,
    escalation_time_hours: parseInt(document.getElementById("department-escalation-time").value) || 72
  };
  try {
    const { data, error } = await apiClient.post("/api/department-structure/admin/departments", formData);
    if (error) throw error;
    showMessage("success", "Department created successfully");
    closeModal("department");
    await loadAllData();
  } catch (error) {
    console.error("Error creating department:", error);
    showMessage("error", "Failed to create department");
  }
}
/**
 * Edit functions (placeholder - would need to implement edit functionality)
 */
window.editCategory = function(id) {
  showMessage("info", "Edit functionality coming soon");
};
window.editSubcategory = function(id) {
  showMessage("info", "Edit functionality coming soon");
};
window.editDepartment = function(id) {
  showMessage("info", "Edit functionality coming soon");
};
/**
 * Delete functions
 */
window.deleteCategory = async function(id) {
  if (!confirm("Are you sure you want to delete this category? This will also delete all subcategories and departments under it.")) {
    return;
  }
  try {
    const { error } = await apiClient.delete(`/api/department-structure/admin/categories/${id}`);
    if (error) throw error;
    showMessage("success", "Category deleted successfully");
    await loadAllData();
  } catch (error) {
    console.error("Error deleting category:", error);
    showMessage("error", "Failed to delete category");
  }
};
window.deleteSubcategory = async function(id) {
  if (!confirm("Are you sure you want to delete this subcategory? This will also delete all departments under it.")) {
    return;
  }
  try {
    const { error } = await apiClient.delete(`/api/department-structure/admin/subcategories/${id}`);
    if (error) throw error;
    showMessage("success", "Subcategory deleted successfully");
    await loadAllData();
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    showMessage("error", "Failed to delete subcategory");
  }
};
window.deleteDepartment = async function(id) {
  if (!confirm("Are you sure you want to delete this department?")) {
    return;
  }
  try {
    const { error } = await apiClient.delete(`/api/department-structure/admin/departments/${id}`);
    if (error) throw error;
    showMessage("success", "Department deleted successfully");
    await loadAllData();
  } catch (error) {
    console.error("Error deleting department:", error);
    showMessage("error", "Failed to delete department");
  }
};
