/**
 * Hierarchical Complaint Form Controller
 * Handles category -> subcategory -> department selection
 */

import { handleComplaintSubmit, resetComplaintForm } from './formSubmission.js';
import { setupRealtimeValidation } from '../../utils/validation.js';
import { createComplaintFileHandler, setupDragAndDrop } from '../../utils/fileHandler.js';
import showMessage from '../toast.js';
import apiClient from '../../config/apiClient.js';
import { getActiveRole, isInCitizenMode, canSwitchToCitizen } from '../../auth/roleToggle.js';

/**
 * Initialize hierarchical complaint form
 */
export async function initializeComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) {
    console.error('[COMPLAINT FORM] Form element not found');
    return;
  }

  // Check if user is citizen or in citizen mode
  const activeRole = getActiveRole();
  const inCitizenMode = isInCitizenMode();

  if (activeRole !== 'citizen' && !inCitizenMode) {
    const canSwitch = await canSwitchToCitizen();
    if (canSwitch) {
      showRoleSwitchRequired(form);
      return;
    } else {
      showMessage('error', 'Only citizens can file complaints');
      form.style.display = 'none';
      return;
    }
  }

  // Get form elements
  const elements = {
    form,
    categorySelect: form.querySelector('#complaintCategory'),
    subcategorySelect: form.querySelector('#complaintSubcategory'),
    departmentCheckboxes: form.querySelector('#departmentCheckboxes'),
    fileDropZone: form.querySelector('#fileDropZone'),
    fileInput: form.querySelector('#evidenceFiles'),
    filePreview: form.querySelector('#filePreview')
  };

  // Validate required elements
  const missingElements = Object.entries(elements)
    .filter(([key, element]) => !element && key !== 'filePreview')
    .map(([key]) => key);

  if (missingElements.length > 0) {
    console.error('[COMPLAINT FORM] Missing required elements:', missingElements);
    return;
  }

  // Initialize file handler
  const fileHandler = createComplaintFileHandler({
    previewContainer: elements.filePreview,
    onFilesChange: (files) => {
      // console.log removed for security
    }
  });

  // Setup form functionality
  setupHierarchicalSelection(elements);
  setupFileHandling(elements.fileDropZone, elements.fileInput, fileHandler);
  setupFormValidation(elements.form);
  setupFormSubmission(elements.form, fileHandler);
  loadCategories();

  // Prevent any auto-focus behavior
  setTimeout(() => {
    if (document.activeElement && document.activeElement.tagName !== 'BODY') {
      document.activeElement.blur();
    }
  }, 50);
}

/**
 * Setup hierarchical category -> subcategory -> department selection
 */
function setupHierarchicalSelection(elements) {
  const { categorySelect, subcategorySelect, departmentCheckboxes } = elements;

  if (!categorySelect || !subcategorySelect || !departmentCheckboxes) return;

  // Category selection handler
  categorySelect.addEventListener('change', async (e) => {
    const categoryId = e.target.value;
    await loadSubcategories(categoryId, subcategorySelect);
    
    // Clear departments when category changes
    departmentCheckboxes.innerHTML = '<div class="loading-placeholder">Select a subcategory to see relevant departments</div>';
  });

  // Subcategory selection handler
  subcategorySelect.addEventListener('change', async (e) => {
    const subcategoryId = e.target.value;
    await loadDepartments(subcategoryId, departmentCheckboxes);
  });
}

/**
 * Load categories from API
 */
async function loadCategories() {
  const categorySelect = document.getElementById('complaintCategory');
  if (!categorySelect) return;

  try {
    categorySelect.innerHTML = '<option value="">Loading categories...</option>';
    
    const { data, error } = await apiClient.get('/api/department-structure/categories');
    if (error) throw error;

    categorySelect.innerHTML = '<option value="">Select a category</option>';
    
    if (data && data.length > 0) {
      data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = `${category.icon} ${category.name}`;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    showMessage('error', 'Failed to load categories');
    categorySelect.innerHTML = '<option value="">Error loading categories</option>';
  }
}

/**
 * Load subcategories for selected category
 */
async function loadSubcategories(categoryId, subcategorySelect) {
  if (!subcategorySelect || !categoryId) return;

  try {
    subcategorySelect.innerHTML = '<option value="">Loading subcategories...</option>';
    subcategorySelect.disabled = true;
    
    const { data, error } = await apiClient.get(`/api/department-structure/categories/${categoryId}/subcategories`);
    if (error) throw error;

    subcategorySelect.innerHTML = '<option value="">Select a subcategory</option>';
    
    if (data && data.length > 0) {
      data.forEach(subcategory => {
        const option = document.createElement('option');
        option.value = subcategory.id;
        option.textContent = subcategory.name;
        subcategorySelect.appendChild(option);
      });
      subcategorySelect.disabled = false;
    } else {
      subcategorySelect.innerHTML = '<option value="">No subcategories available</option>';
    }
  } catch (error) {
    console.error('Error loading subcategories:', error);
    showMessage('error', 'Failed to load subcategories');
    subcategorySelect.innerHTML = '<option value="">Error loading subcategories</option>';
  }
}

/**
 * Load departments for selected subcategory and pre-check relevant ones
 */
async function loadDepartments(subcategoryId, departmentCheckboxes) {
  if (!departmentCheckboxes || !subcategoryId) return;

  try {
    departmentCheckboxes.innerHTML = '<div class="loading-placeholder">Loading departments...</div>';
    
    const { data, error } = await apiClient.get(`/api/department-structure/subcategories/${subcategoryId}/departments`);
    if (error) throw error;

    departmentCheckboxes.innerHTML = '';
    
    if (data && data.length > 0) {
      // Group departments by level
      const lguDepartments = data.filter(dept => dept.level === 'LGU');
      const ngaDepartments = data.filter(dept => dept.level === 'NGA');

      // Create LGU section
      if (lguDepartments.length > 0) {
        const lguSection = document.createElement('div');
        lguSection.className = 'department-section';
        lguSection.innerHTML = '<h4>Local Government Units (LGU)</h4>';
        
        lguDepartments.forEach(dept => {
          const isPrimary = dept.department_subcategory_mapping?.some(mapping => mapping.is_primary);
          const checkbox = createDepartmentCheckbox(dept, isPrimary);
          lguSection.appendChild(checkbox);
        });
        
        departmentCheckboxes.appendChild(lguSection);
      }

      // Create NGA section
      if (ngaDepartments.length > 0) {
        const ngaSection = document.createElement('div');
        ngaSection.className = 'department-section';
        ngaSection.innerHTML = '<h4>National Government Agencies (NGA)</h4>';
        
        ngaDepartments.forEach(dept => {
          const isPrimary = dept.department_subcategory_mapping?.some(mapping => mapping.is_primary);
          const checkbox = createDepartmentCheckbox(dept, isPrimary);
          ngaSection.appendChild(checkbox);
        });
        
        departmentCheckboxes.appendChild(ngaSection);
      }

      // Auto-check primary departments
      const primaryCheckboxes = departmentCheckboxes.querySelectorAll('input[data-is-primary="true"]');
      primaryCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
      });

    } else {
      departmentCheckboxes.innerHTML = '<div class="no-departments">No departments available for this subcategory</div>';
    }
  } catch (error) {
    console.error('Error loading departments:', error);
    showMessage('error', 'Failed to load departments');
    departmentCheckboxes.innerHTML = '<div class="error-message">Error loading departments</div>';
  }
}

/**
 * Create department checkbox element
 */
function createDepartmentCheckbox(department, isPrimary = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'checkbox-wrapper';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `dept-${department.id}`;
  checkbox.name = 'departments';
  checkbox.value = department.id;
  checkbox.setAttribute('data-is-primary', isPrimary);
  checkbox.setAttribute('data-dept-code', department.code);
  
  const label = document.createElement('label');
  label.htmlFor = `dept-${department.id}`;
  label.className = 'checkbox-label';
  
  const labelText = document.createElement('span');
  labelText.textContent = department.name;
  
  const codeSpan = document.createElement('span');
  codeSpan.className = 'dept-code';
  codeSpan.textContent = ` (${department.code})`;
  
  const responseTimeSpan = document.createElement('span');
  responseTimeSpan.className = 'response-time';
  responseTimeSpan.textContent = ` - ${department.response_time_hours}h response`;
  
  if (isPrimary) {
    const primaryBadge = document.createElement('span');
    primaryBadge.className = 'primary-badge';
    primaryBadge.textContent = ' (Primary)';
    labelText.appendChild(primaryBadge);
  }
  
  labelText.appendChild(codeSpan);
  labelText.appendChild(responseTimeSpan);
  label.appendChild(labelText);
  
  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);
  
  return wrapper;
}

/**
 * Setup file handling functionality
 */
function setupFileHandling(dropZone, fileInput, fileHandler) {
  if (!dropZone || !fileHandler) return;

  setupDragAndDrop(dropZone, fileHandler, fileInput);
  window.complaintFileHandler = fileHandler;
}

/**
 * Show role switch required message
 */
function showRoleSwitchRequired(form) {
  const message = document.createElement('div');
  message.className = 'role-switch-required';
  message.innerHTML = `
    <div class="role-switch-content">
      <h3>Switch to Citizen Mode Required</h3>
      <p>You need to switch to citizen mode to file a complaint.</p>
      <button type="button" class="btn btn-primary" onclick="window.location.href='/role-toggle'">
        Switch to Citizen Mode
      </button>
    </div>
  `;
  
  form.innerHTML = '';
  form.appendChild(message);
}

/**
 * Setup form validation
 */
function setupFormValidation(form) {
  if (!form) return;

  setupRealtimeValidation(form, {
    title: { required: true, minLength: 5 },
    description: { required: true, minLength: 10 },
    location: { required: true, minLength: 3 }
  });
}

/**
 * Setup form submission
 */
function setupFormSubmission(form, fileHandler) {
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get selected departments
    const selectedDepartments = Array.from(form.querySelectorAll('input[name="departments"]:checked'))
      .map(checkbox => checkbox.value);
    
    if (selectedDepartments.length === 0) {
      showMessage('warning', 'Please select at least one department');
      return;
    }

    // Prepare form data
    const formData = new FormData(form);
    formData.append('selectedDepartments', JSON.stringify(selectedDepartments));
    
    // Add category and subcategory info
    const categoryId = form.querySelector('#complaintCategory').value;
    const subcategoryId = form.querySelector('#complaintSubcategory').value;
    formData.append('categoryId', categoryId);
    formData.append('subcategoryId', subcategoryId);

    try {
      await handleComplaintSubmit(formData, fileHandler);
    } catch (error) {
      console.error('Error submitting complaint:', error);
      showMessage('error', 'Failed to submit complaint');
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeComplaintForm);
} else {
  initializeComplaintForm();
}
