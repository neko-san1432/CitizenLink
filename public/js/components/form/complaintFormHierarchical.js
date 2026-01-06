/**
 * Hierarchical Complaint Form Controller
 * Handles category -> subcategory -> department selection
 */
import { handleComplaintSubmit, resetComplaintForm } from "./formSubmission.js";
import { setupRealtimeValidation } from "../../utils/validation.js";
import {
  createComplaintFileHandler,
  setupDragAndDrop,
} from "../../utils/fileHandler.js";
import showMessage from "../toast.js";
import apiClient from "../../config/apiClient.js";
import {
  getActiveRole,
  isInCitizenMode,
  canSwitchToCitizen,
} from "../../auth/roleToggle.js";
import { getUserRole } from "../../auth/authChecker.js";

/**
 * Initialize hierarchical complaint form
 */

export async function initializeComplaintForm() {
  const form = document.getElementById("complaintForm");
  if (!form) {
    console.error("[COMPLAINT FORM] Form element not found");
    return;
  }
  // Check if user is citizen or in citizen mode
  // Try to get role from authChecker first (same as sidebar)
  let activeRole = null;
  try {
    activeRole = await getUserRole({ refresh: true });
  } catch (error) {
    console.warn(
      "[COMPLAINT FORM] Failed to get role from authChecker, trying roleToggle:",
      error
    );
    activeRole = getActiveRole();
  }
  const inCitizenMode = isInCitizenMode();
  if (activeRole !== "citizen" && !inCitizenMode) {
    const canSwitch = await canSwitchToCitizen();
    if (canSwitch) {
      showRoleSwitchRequired(form);
      return;
    }
    showMessage("error", "Only citizens can file complaints");
    form.style.display = "none";
    return;
  }
  // Get form elements
  const elements = {
    form,
    categorySelect: form.querySelector("#complaintCategory"),
    subcategorySelect: form.querySelector("#complaintSubcategory"),
    departmentCheckboxes: form.querySelector("#departmentCheckboxes"),
    fileDropZone: form.querySelector("#fileDropZone"),
    fileInput: form.querySelector("#evidenceFiles"),
    filePreview: form.querySelector("#filePreview"),
  };
  // Validate required elements
  const missingElements = Object.entries(elements)
    .filter(([key, element]) => !element && key !== "filePreview")
    .map(([key]) => key);
  if (missingElements.length > 0) {
    console.error(
      "[COMPLAINT FORM] Missing required elements:",
      missingElements
    );
    return;
  }
  // Initialize file handler with upload state callback
  const fileHandler = createComplaintFileHandler({
    previewContainer: elements.filePreview,
    onFilesChange: (_files) => {
      // console.log removed for security
    },
    onUploadStateChange: (isUploading) => {
      // Disable/enable buttons based on upload state
      const submitBtn = elements.form.querySelector(".submit-btn");
      const cancelBtn =
        elements.form.querySelector(".cancel-btn") ||
        document.querySelector(".cancel-btn");
      if (submitBtn) {
        submitBtn.disabled = isUploading;
      }
      if (cancelBtn) {
        cancelBtn.disabled = isUploading;
      }
    },
  });
  // Setup form functionality
  setupHierarchicalSelection(elements);
  setupFileHandling(elements.fileDropZone, elements.fileInput, fileHandler);
  // Load ALL departments immediately (regardless of category selection)
  loadAllDepartments(elements.departmentCheckboxes);
  setupFormValidation(elements.form);
  setupFormSubmission(elements.form, fileHandler);
  loadCategories();
  // Prevent any auto-focus behavior
  setTimeout(() => {
    if (document.activeElement && document.activeElement.tagName !== "BODY") {
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
  categorySelect.addEventListener("change", async (e) => {
    const categoryId = e.target.value;
    await loadSubcategories(categoryId, subcategorySelect);
    // Clear departments when category changes
    departmentCheckboxes.innerHTML =
      '<div class="loading-placeholder">Select a subcategory to see relevant departments</div>';
  });
  // Subcategory selection handler
  subcategorySelect.addEventListener("change", async (e) => {
    const subcategoryId = e.target.value;
    if (subcategoryId) {
      // First load all departments, then auto-select appropriate ones
      await loadAllDepartments(departmentCheckboxes);
      await autoSelectAppropriateDepartments(
        subcategoryId,
        departmentCheckboxes
      );
    } else {
      // If no subcategory selected, just load all departments without auto-selection
      await loadAllDepartments(departmentCheckboxes);
    }
  });
}
/**
 * Load categories from API
 */
async function loadCategories() {
  const categorySelect = document.getElementById("complaintCategory");
  if (!categorySelect) return;
  try {
    categorySelect.innerHTML =
      '<option value="">Loading categories...</option>';
    const { data, error } = await apiClient.get(
      "/api/department-structure/categories"
    );
    if (error) throw error;
    categorySelect.innerHTML = '<option value="">Select a category</option>';
    if (data && data.length > 0) {
      data.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    showMessage("error", "Failed to load categories");
    categorySelect.innerHTML =
      '<option value="">Error loading categories</option>';
  }
}
/**
 * Load subcategories for selected category
 */
async function loadSubcategories(categoryId, subcategorySelect) {
  if (!subcategorySelect || !categoryId) return;
  try {
    subcategorySelect.innerHTML =
      '<option value="">Loading subcategories...</option>';
    subcategorySelect.disabled = true;
    const { data, error } = await apiClient.get(
      `/api/department-structure/categories/${categoryId}/subcategories`
    );
    if (error) throw error;
    subcategorySelect.innerHTML =
      '<option value="">Select a subcategory</option>';
    if (data && data.length > 0) {
      data.forEach((subcategory) => {
        const option = document.createElement("option");
        option.value = subcategory.id;
        option.textContent = subcategory.name;
        subcategorySelect.appendChild(option);
      });
      subcategorySelect.disabled = false;
    } else {
      subcategorySelect.innerHTML =
        '<option value="">No subcategories available</option>';
    }
  } catch (error) {
    console.error("Error loading subcategories:", error);
    showMessage("error", "Failed to load subcategories");
    subcategorySelect.innerHTML =
      '<option value="">Error loading subcategories</option>';
  }
}
/**
 * Auto-select appropriate departments when subcategory is selected
 */
async function autoSelectAppropriateDepartments(
  subcategoryId,
  departmentCheckboxes
) {
  if (!departmentCheckboxes || !subcategoryId) return;
  try {
    // Get departments mapped to this subcategory
    const { data, error } = await apiClient.get(
      `/api/department-structure/subcategories/${subcategoryId}/departments`
    );
    if (error) throw error;
    if (data && data.length > 0) {
      // Find departments that are mapped to this subcategory
      const mappedDepartments = data.filter(
        (dept) =>
          dept.department_subcategory_mapping &&
          dept.department_subcategory_mapping.response_priority
      );
      // Auto-check mapped departments
      mappedDepartments.forEach((dept) => {
        const checkbox = document.querySelector(`input[value="${dept.code}"]`);
        if (checkbox) {
          checkbox.checked = true;
          checkbox.setAttribute("data-auto-selected", "true");
        }
      });
      // console.log removed for security
      // Show helpful message
      if (mappedDepartments.length > 0) {
        const suggestionMessage = document.createElement("div");
        suggestionMessage.className = "suggestion-message";
        suggestionMessage.innerHTML = `
          <div style="background: #e8f5e8; border: 1px solid #28a745; border-radius: 6px; padding: 12px; margin: 10px 0; color: #155724;">
            <strong>💡 Suggested Departments:</strong> We've pre-selected departments that typically handle this type of complaint. You can uncheck any that don't apply to your specific situation.
          </div>
        `;
        // Remove existing suggestion message if any
        const existingMessage = departmentCheckboxes.querySelector(
          ".suggestion-message"
        );
        if (existingMessage) {
          existingMessage.remove();
        }
        departmentCheckboxes.insertBefore(
          suggestionMessage,
          departmentCheckboxes.firstChild
        );
      }
    }
  } catch (error) {
    console.error("Error auto-selecting departments:", error);
  }
}
/**
 * Load ALL departments (always show all, regardless of category/subcategory)
 */
async function loadAllDepartments(departmentCheckboxes) {
  if (!departmentCheckboxes) return;
  try {
    departmentCheckboxes.innerHTML =
      '<div class="loading-placeholder">Loading departments...</div>';
    // Always get ALL departments, regardless of subcategory
    const { data, error } = await apiClient.get(
      `/api/department-structure/departments/all`
    );
    if (error) throw error;
    departmentCheckboxes.innerHTML = "";
    if (data && data.length > 0) {
      // Add search input
      const searchContainer = document.createElement("div");
      searchContainer.className = "department-search-container";
      searchContainer.innerHTML = `
        <div class="search-input-wrapper">
          <input type="text" id="department-search" placeholder="Search departments..." class="premium-input department-search-input" style="margin-bottom: 0.5rem;">
        </div>
        <div class="search-results-info" id="search-results-info" style="display: none; margin-bottom: 0.5rem; font-size: 0.85rem; color: #6b7280;">
          <span id="search-results-count">0</span> departments found
        </div>
      `;
      departmentCheckboxes.appendChild(searchContainer);
      // Group departments by level
      const lguDepartments = data.filter((dept) => dept.level === "LGU");
      const ngaDepartments = data.filter((dept) => dept.level === "NGA");
      // Create LGU section
      if (lguDepartments.length > 0) {
        const lguSection = document.createElement("div");
        lguSection.className = "department-section";
        lguSection.innerHTML = "<h4>Local Government Units (LGU)</h4>";
        lguDepartments.forEach((dept) => {
          const checkbox = createDepartmentCheckbox(dept);
          lguSection.appendChild(checkbox);
        });
        departmentCheckboxes.appendChild(lguSection);
      }
      // Create NGA section
      if (ngaDepartments.length > 0) {
        const ngaSection = document.createElement("div");
        ngaSection.className = "department-section";
        ngaSection.innerHTML = "<h4>National Government Agencies (NGA)</h4>";
        ngaDepartments.forEach((dept) => {
          const checkbox = createDepartmentCheckbox(dept);
          ngaSection.appendChild(checkbox);
        });
        departmentCheckboxes.appendChild(ngaSection);
      }
      // Show all departments but don't auto-select any (make it optional)
      // console.log removed for security

      // Show helpful message to user about optional selection
      const suggestionMessage = document.createElement("div");
      suggestionMessage.className = "suggestion-message";
      suggestionMessage.innerHTML = `
        <div style="background: #e8f5e8; border: 1px solid #28a745; border-radius: 6px; padding: 12px; margin: 10px 0; color: #155724;">
          <strong>💡 Department Selection (Optional):</strong> You can select departments that should handle your complaint. If none are selected, the system will route your complaint to appropriate departments automatically.
        </div>
      `;
      departmentCheckboxes.insertBefore(
        suggestionMessage,
        departmentCheckboxes.firstChild
      );
      // Setup search functionality
      setupDepartmentSearch(data);
      // No "None" option - users can simply leave all departments unchecked
    } else {
      departmentCheckboxes.innerHTML =
        '<div class="no-departments">No departments available for this subcategory</div>';
    }
  } catch (error) {
    console.error("Error loading departments:", error);
    showMessage("error", "Failed to load departments");
    departmentCheckboxes.innerHTML =
      '<div class="error-message">Error loading departments</div>';
  }
}
/**
 * Create department checkbox element
 */
function createDepartmentCheckbox(department) {
  const wrapper = document.createElement("div");
  wrapper.className = "checkbox-wrapper";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `dept-${department.id}`;
  checkbox.name = "departments";
  checkbox.value = department.code;
  checkbox.setAttribute("data-dept-code", department.code);
  const label = document.createElement("label");
  label.htmlFor = `dept-${department.id}`;
  label.className = "checkbox-label";
  const labelText = document.createElement("span");
  labelText.textContent = department.name;
  const codeSpan = document.createElement("span");
  codeSpan.className = "dept-code";
  codeSpan.textContent = ` (${department.code})`;
  const responseTimeSpan = document.createElement("span");
  responseTimeSpan.className = "response-time";
  responseTimeSpan.textContent = ` - ${department.response_time_hours}h response`;
  // All departments are shown equally - no special indicators
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
  const message = document.createElement("div");
  message.className = "role-switch-required";
  message.innerHTML = `
    <div class="role-switch-content">
      <h3>Switch to Citizen Mode Required</h3>
      <p>You need to switch to citizen mode to file a complaint.</p>
      <button type="button" class="btn btn-primary" onclick="window.location.href='/role-toggle'">
        Switch to Citizen Mode
      </button>
    </div>
  `;
  form.innerHTML = "";
  form.appendChild(message);
}
/**
 * Setup form validation
 */
function setupFormValidation(form) {
  if (!form) return;
  setupRealtimeValidation(form);
}
/**
 * Setup form submission
 */
function setupFormSubmission(form, fileHandler) {
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Get selected departments (optional)
    const selectedDepartments = Array.from(
      form.querySelectorAll('input[name="departments"]:checked')
    ).map((checkbox) => checkbox.value);
    // Department selection is now optional - no validation required
    // console.log removed for security
    // Add selected departments as preferred_departments (user's choice)
    if (selectedDepartments.length > 0) {
      // Send array of selected department codes
      selectedDepartments.forEach((deptCode) => {
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "preferred_departments";
        hiddenInput.value = deptCode;
        form.appendChild(hiddenInput);
      });
    } else {
      // Send empty array when no departments are selected
      const emptyInput = document.createElement("input");
      emptyInput.type = "hidden";
      emptyInput.name = "preferred_departments";
      emptyInput.value = "[]";
      form.appendChild(emptyInput);
    }
    // Add category and subcategory info as hidden inputs
    // Note: These are UUIDs that reference the categories and subcategories tables
    const categoryId = form.querySelector("#complaintCategory").value;
    const subcategoryId = form.querySelector("#complaintSubcategory").value;
    if (categoryId) {
      const categoryInput = document.createElement("input");
      categoryInput.type = "hidden";
      categoryInput.name = "category";
      categoryInput.value = categoryId; // UUID from categories table
      form.appendChild(categoryInput);
    }
    if (subcategoryId) {
      const subcategoryInput = document.createElement("input");
      subcategoryInput.type = "hidden";
      subcategoryInput.name = "subcategory";
      subcategoryInput.value = subcategoryId; // UUID from subcategories table
      form.appendChild(subcategoryInput);
    }
    try {
      // Get selected files from file handler
      const selectedFiles = fileHandler.getFiles();
      // Submit the complaint using the correct parameters with fileHandler for progress tracking
      const _result = await handleComplaintSubmit(
        form,
        selectedFiles,
        fileHandler
      );
      // Reset form on success
      resetComplaintForm(form, () => fileHandler.clearAll());
      // Redirect to dashboard after delay
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (error) {
      console.error("Error submitting complaint:", error);
      // Error message is already shown in handleComplaintSubmit
    }
  });
}
/**
 * Setup department search functionality
 */
function setupDepartmentSearch(allDepartments) {
  const searchInput = document.getElementById("department-search");
  const searchResultsInfo = document.getElementById("search-results-info");
  const searchResultsCount = document.getElementById("search-results-count");
  if (!searchInput) return;
  // Debounce search to avoid too many calls
  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();
      filterDepartments(
        query,
        allDepartments,
        searchResultsInfo,
        searchResultsCount
      );
    }, 300);
  });
  // Clear search on escape
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.target.value = "";
      filterDepartments(
        "",
        allDepartments,
        searchResultsInfo,
        searchResultsCount
      );
    }
  });
}
/**
 * Filter departments based on search query
 */
function filterDepartments(
  query,
  allDepartments,
  searchResultsInfo,
  searchResultsCount
) {
  const departmentSections = document.querySelectorAll(".department-section");
  const _departmentCheckboxes = document.querySelectorAll(".checkbox-wrapper");
  let visibleCount = 0;
  if (!query) {
    // Show all departments
    departmentSections.forEach((section) => {
      section.style.display = "block";
      const checkboxes = section.querySelectorAll(".checkbox-wrapper");
      checkboxes.forEach((checkbox) => {
        checkbox.style.display = "block";
        visibleCount++;
      });
    });
    searchResultsInfo.style.display = "none";
    return;
  }
  // Filter departments
  departmentSections.forEach((section) => {
    const checkboxes = section.querySelectorAll(".checkbox-wrapper");
    let sectionHasVisible = false;
    checkboxes.forEach((checkbox) => {
      const label = checkbox.querySelector("label");
      const departmentName = label ? label.textContent.toLowerCase() : "";
      const departmentCode =
        checkbox.querySelector("input")?.value?.toLowerCase() || "";
      const matches =
        departmentName.includes(query) || departmentCode.includes(query);
      if (matches) {
        checkbox.style.display = "block";
        sectionHasVisible = true;
        visibleCount++;
      } else {
        checkbox.style.display = "none";
      }
    });
    // Show/hide section based on whether it has visible items
    section.style.display = sectionHasVisible ? "block" : "none";
  });
  // Update search results info
  if (query) {
    searchResultsCount.textContent = visibleCount;
    searchResultsInfo.style.display = visibleCount > 0 ? "block" : "none";
  } else {
    searchResultsInfo.style.display = "none";
  }
}
// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeComplaintForm);
} else {
  initializeComplaintForm();
}
