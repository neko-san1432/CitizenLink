/**
 * Office Selector Component
 * Allows users to select offices/departments for their complaint
 * Auto-selects based on category and subcategory
 */

class OfficeSelectorComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.departments = [];
    this.selectedDepartments = new Set();
    this.autoSelectedDepartments = new Set();
    this.departmentMappings = {};
    this.currentCategory = null;
    this.currentSubcategory = null;
    
    if (!this.container) {
      console.error('[OFFICE-SELECTOR] Container not found:', containerId);
      return;
    }
    
    this.init();
  }

  async init() {
    await this.loadDepartments();
    this.render();
  }

  /**
   * Load all departments with their mappings
   */
  async loadDepartments() {
    try {
      const response = await fetch('/api/departments/with-mappings');
      
      if (!response.ok) {
        throw new Error('Failed to load departments');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load departments');
      }

      this.departments = result.data.departments || [];
      this.departmentMappings = result.data.mappings || {};
      
      console.log('[OFFICE-SELECTOR] Loaded departments:', this.departments.length);
      
    } catch (error) {
      console.error('[OFFICE-SELECTOR] Error loading departments:', error);
      this.showError('Failed to load departments. Please refresh the page.');
    }
  }

  /**
   * Render the office selector
   */
  render() {
    if (!this.container) return;

    const html = `
      <div class="office-selector">
        <div class="office-selector-header">
          <h3>Select Responding Offices</h3>
          <p class="help-text">
            Offices will be automatically selected based on your category and subcategory.
            You can select additional offices if needed.
          </p>
        </div>

        <div class="office-list" id="office-list">
          ${this.departments.length === 0 ? 
            '<p class="loading-message">Loading departments...</p>' : 
            this.renderDepartmentList()
          }
        </div>

        <div class="selected-summary" id="selected-summary">
          <strong>Selected Offices:</strong> <span id="selected-count">0</span>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Render department list with checkboxes
   */
  renderDepartmentList() {
    // Group departments by level (LGU vs NGA)
    const lguDepts = this.departments.filter(d => d.level === 'LGU');
    const ngaDepts = this.departments.filter(d => d.level === 'NGA');

    let html = '';

    if (lguDepts.length > 0) {
      html += '<div class="department-group">';
      html += '<h4 class="group-title">LGU Departments</h4>';
      html += '<div class="department-grid">';
      lguDepts.forEach(dept => {
        html += this.renderDepartmentCheckbox(dept);
      });
      html += '</div></div>';
    }

    if (ngaDepts.length > 0) {
      html += '<div class="department-group">';
      html += '<h4 class="group-title">Partner Agencies (NGA)</h4>';
      html += '<div class="department-grid">';
      ngaDepts.forEach(dept => {
        html += this.renderDepartmentCheckbox(dept);
      });
      html += '</div></div>';
    }

    return html;
  }

  /**
   * Render individual department checkbox
   */
  renderDepartmentCheckbox(department) {
    const isSelected = this.selectedDepartments.has(department.code);
    const isAutoSelected = this.autoSelectedDepartments.has(department.code);
    
    return `
      <div class="department-item ${isAutoSelected ? 'auto-selected' : ''}" data-code="${department.code}">
        <label class="department-label">
          <input 
            type="checkbox" 
            class="department-checkbox" 
            value="${department.code}"
            data-name="${department.name}"
            ${isSelected ? 'checked' : ''}
          />
          <div class="department-info">
            <span class="department-name">${department.name}</span>
            <span class="department-code">${department.code}</span>
            ${isAutoSelected ? '<span class="auto-badge">Auto-selected</span>' : ''}
            ${department.response_time_hours ? 
              `<span class="response-time">Response: ${department.response_time_hours}h</span>` : 
              ''
            }
          </div>
        </label>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const checkboxes = this.container.querySelectorAll('.department-checkbox');
    
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const code = e.target.value;
        
        if (e.target.checked) {
          this.selectedDepartments.add(code);
        } else {
          this.selectedDepartments.delete(code);
          this.autoSelectedDepartments.delete(code);
        }
        
        this.updateSelectedCount();
        this.updateAutoSelectedStyling(code);
      });
    });
  }

  /**
   * Auto-select offices based on category and subcategory
   */
  async autoSelectOffices(categoryCode, subcategoryCode) {
    this.currentCategory = categoryCode;
    this.currentSubcategory = subcategoryCode;

    if (!categoryCode || !subcategoryCode) {
      // Clear auto-selections if no category/subcategory
      this.autoSelectedDepartments.clear();
      this.render();
      return;
    }

    try {
      const response = await fetch(`/api/departments/by-subcategory/${subcategoryCode}`);
      
      if (!response.ok) {
        console.warn('[OFFICE-SELECTOR] No mappings found for subcategory:', subcategoryCode);
        return;
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        return;
      }

      const mappedDepartments = result.data;

      // Clear previous auto-selections
      this.autoSelectedDepartments.clear();

      // Auto-select primary departments
      mappedDepartments.forEach(mapping => {
        if (mapping.is_primary) {
          this.autoSelectedDepartments.add(mapping.department_code);
          this.selectedDepartments.add(mapping.department_code);
        }
      });

      console.log('[OFFICE-SELECTOR] Auto-selected departments:', Array.from(this.autoSelectedDepartments));

      // Re-render to show auto-selections
      this.render();

    } catch (error) {
      console.error('[OFFICE-SELECTOR] Error auto-selecting offices:', error);
    }
  }

  /**
   * Update auto-selected styling for a specific department
   */
  updateAutoSelectedStyling(code) {
    const item = this.container.querySelector(`.department-item[data-code="${code}"]`);
    if (item) {
      if (this.autoSelectedDepartments.has(code)) {
        item.classList.add('auto-selected');
      } else {
        item.classList.remove('auto-selected');
      }
    }
  }

  /**
   * Update selected count display
   */
  updateSelectedCount() {
    const countElement = document.getElementById('selected-count');
    if (countElement) {
      countElement.textContent = this.selectedDepartments.size;
    }
  }

  /**
   * Get selected offices
   * @returns {Array} Array of selected department codes
   */
  getSelectedOffices() {
    return Array.from(this.selectedDepartments);
  }

  /**
   * Get auto-selected offices
   * @returns {Array} Array of auto-selected department codes
   */
  getAutoSelectedOffices() {
    return Array.from(this.autoSelectedDepartments);
  }

  /**
   * Get manually selected offices (not auto-selected)
   * @returns {Array} Array of manually selected department codes
   */
  getManuallySelectedOffices() {
    return this.getSelectedOffices().filter(code => !this.autoSelectedDepartments.has(code));
  }

  /**
   * Validate selection
   * @returns {Object} Validation result
   */
  validate() {
    if (this.selectedDepartments.size === 0) {
      return {
        valid: false,
        error: 'Please select at least one office to handle your complaint'
      };
    }

    return {
      valid: true
    };
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'office-selector-error';
    errorDiv.textContent = message;
    
    if (this.container) {
      this.container.prepend(errorDiv);
      
      setTimeout(() => {
        errorDiv.remove();
      }, 5000);
    }
  }

  /**
   * Reset selections
   */
  reset() {
    this.selectedDepartments.clear();
    this.autoSelectedDepartments.clear();
    this.currentCategory = null;
    this.currentSubcategory = null;
    this.render();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfficeSelectorComponent;
}

