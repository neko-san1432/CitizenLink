import apiClient from '../config/apiClient.js';
import showMessage from '../components/toast.js';

class DepartmentManager {

  constructor() {
    this.departments = [];
    this.currentDepartment = null;
    this.init();
  }
  async init() {
    await this.loadDepartments();
    this.setupEventListeners();
    this.startStatusRefresh();
  }
  setupEventListeners() {
    const form = document.getElementById('departmentForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    // Auto-format department code
    const codeInput = document.getElementById('departmentCode');
    if (codeInput) {
      codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
      });
    }
  }
  async loadDepartments() {
    try {
      const response = await apiClient.get('/api/departments/active');
      if (response.success) {
        this.departments = response.data;
        // Load officers for each department
        await this.loadOfficersForAllDepartments();
        this.renderDepartments();
        this.updateStats();
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
      showMessage('error', 'Failed to load departments');
    }
  }
  async loadOfficersForAllDepartments() {
    const promises = this.departments.map(async (dept) => {
      try {
        const response = await apiClient.getDepartmentOfficers(dept.id);
        if (response.success) {
          dept.officers = response.data.map(officer => ({
            ...officer,
            lastSeenText: this.getLastSeenText(officer.last_sign_in_at),
            statusClass: this.getStatusClass(officer.is_online, officer.last_sign_in_at)
          }));
          dept.officersVisible = false; // Initially hidden
        } else {
          dept.officers = [];
          dept.officersVisible = false;
        }
      } catch (error) {
        console.error(`Failed to load officers for department ${dept.name}:`, error);
        dept.officers = [];
        dept.officersVisible = false;
      }
    });
    await Promise.all(promises);
  }
  renderDepartments() {
    const grid = document.getElementById('departmentGrid');
    if (!grid) return;
    // Use safer DOM manipulation instead of innerHTML
    grid.innerHTML = '';
    const safeHtml = this.departments.map(dept => `
      <div class="department-card">
        <div class="department-header">
          <span class="department-code">${dept.code}</span>
          <span class="status-badge ${dept.is_active ? 'status-active' : 'status-inactive'}">
            ${dept.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <h3>${dept.name}</h3>
        <p>${dept.description || 'No description provided'}</p>

        <div class="officers-section" id="officers-${dept.id}">
          <div class="officers-header">
            <h4>Officers (${dept.officers ? dept.officers.length : 0})</h4>
            <button class="toggle-officers" onclick="departmentManager.toggleOfficers(${dept.id})">
              ${dept.officersVisible ? 'Hide' : 'Show'} Officers
            </button>
          </div>
          <div class="officers-list" style="display: ${dept.officersVisible ? 'grid' : 'none'}">
            ${dept.officers && dept.officers.length > 0 ?
    dept.officers.map(officer => `
                <div class="officer-item">
                  <div class="officer-status">
                    <div class="officer-avatar">${officer.name.charAt(0).toUpperCase()}</div>
                    <div class="status-indicator ${officer.statusClass}"></div>
                  </div>
                  <div class="officer-info">
                    <p class="officer-name">${officer.name}</p>
                    <p class="officer-role">${officer.role || 'Officer'}</p>
                    <p class="officer-status-text ${officer.statusClass}-text">
                      ${officer.is_online ? 'Online' : 'Offline'}
                    </p>
                    <p class="officer-last-seen">${officer.lastSeenText}</p>
                  </div>
                </div>
              `).join('') :
    '<div class="no-officers">No officers assigned to this department</div>'
}
          </div>
        </div>
        <div class="department-actions">
          <button class="btn btn-sm btn-primary" onclick="departmentManager.editDepartment(${dept.id})">
            Edit
          </button>
          <button class="btn btn-sm ${dept.is_active ? 'btn-warning' : 'btn-success'}"
                  onclick="departmentManager.toggleStatus(${dept.id})">
            ${dept.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    `).join('');

    // Use safer approach - create elements directly
    const parser = new DOMParser();
    const doc = parser.parseFromString(this.sanitizeHtml(safeHtml), 'text/html');
    const fragment = document.createDocumentFragment();
    Array.from(doc.body.children).forEach(child => fragment.appendChild(child.cloneNode(true)));
    grid.appendChild(fragment);
  }
  // Enhanced HTML sanitization function
  sanitizeHtml(html) {
    if (!html || typeof html !== 'string') return '';
    // Use DOMPurify for comprehensive sanitization
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 'br', 'hr', 'ul', 'ol', 'li', 'a', 'img'],
        ALLOWED_ATTR: ['class', 'id', 'style', 'href', 'src', 'alt', 'title', 'data-*'],
        ALLOW_DATA_ATTR: true,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SANITIZE_DOM: true,
        KEEP_CONTENT: true
      });
    }
    // Fallback sanitization if DOMPurify is not available
    return html
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: URLs
      .replace(/javascript\s*:/gi, '')
      // Remove vbscript: URLs
      .replace(/vbscript\s*:/gi, '')
      // Remove data: URLs (except safe image types)
      .replace(/data\s*:(?!image\/(png|jpg|jpeg|gif|svg|webp))/gi, '')
      // Remove iframe tags
      .replace(/<iframe\b[^<]*>.*?<\/iframe>/gi, '')
      // Remove object tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      // Remove embed tags
      .replace(/<embed\b[^<]*>/gi, '')
      // Remove form tags
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      // Remove input tags
      .replace(/<input\b[^<]*>/gi, '')
      // Remove button tags with onclick
      .replace(/<button\b[^<]*onclick[^<]*>/gi, '<button>')
      // Remove style attributes with javascript
      .replace(/style\s*=\s*["'][^"']*javascript[^"']*["']/gi, '')
      // Remove href with javascript
      .replace(/href\s*=\s*["']javascript[^"']*["']/gi, 'href="#"')
      // Remove src with javascript
      .replace(/src\s*=\s*["']javascript[^"']*["']/gi, '');
  }
  updateStats() {
    const totalElement = document.getElementById('totalCount');
    const activeElement = document.getElementById('activeCount');
    if (totalElement) totalElement.textContent = this.departments.length;
    if (activeElement) {
      activeElement.textContent = this.departments.filter(d => d.is_active).length;
    }
  }
  async handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      code: formData.get('code'),
      description: formData.get('description'),
      is_active: formData.has('is_active')
    };
    try {
      let response;
      if (this.currentDepartment) {
        response = await apiClient.put(`/api/departments/${this.currentDepartment.id}`, data);
      } else {
        response = await apiClient.post('/api/departments', data);
      }
      if (response.success) {
        showMessage('success', response.message);
        this.closeModal();
        await this.loadDepartments();
      }
    } catch (error) {
      console.error('Department operation failed:', error);
      showMessage('error', error.message || 'Operation failed');
    }
  }
  openModal(mode = 'add', department = null) {
    this.currentDepartment = department;
    const modal = document.getElementById('departmentModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('departmentForm');
    if (mode === 'edit' && department) {
      title.textContent = 'Edit Department';
      document.getElementById('departmentName').value = department.name;
      document.getElementById('departmentCode').value = department.code;
      document.getElementById('departmentDescription').value = department.description || '';
      document.getElementById('departmentActive').checked = department.is_active;
    } else {
      title.textContent = 'Add Department';
      form.reset();
    }
    modal.style.display = 'block';
  }
  closeModal() {
    const modal = document.getElementById('departmentModal');
    modal.style.display = 'none';
    this.currentDepartment = null;
  }
  editDepartment(id) {
    const department = this.departments.find(d => d.id === id);
    if (department) {
      this.openModal('edit', department);
    }
  }
  async toggleStatus(id) {
    const department = this.departments.find(d => d.id === id);
    if (!department) return;
    const newStatus = !department.is_active;
    const action = newStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} "${department.name}"?`)) {
      return;
    }
    try {
      const response = await apiClient.put(`/api/departments/${id}`, {
        is_active: newStatus
      });
      if (response.success) {
        showMessage('success', `Department ${action}d successfully`);
        await this.loadDepartments();
      }
    } catch (error) {
      console.error('Status toggle failed:', error);
      showMessage('error', error.message || 'Operation failed');
    }
  }
  toggleOfficers(departmentId) {
    const department = this.departments.find(d => d.id === departmentId);
    if (!department) return;
    department.officersVisible = !department.officersVisible;
    this.renderDepartments();
  }
  getLastSeenText(lastSignInAt) {
    if (!lastSignInAt) return 'Never';
    const lastSignIn = new Date(lastSignInAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now - lastSignIn) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return lastSignIn.toLocaleDateString();
  }
  getStatusClass(isOnline, lastSignInAt) {
    if (isOnline) return 'status-online';
    if (!lastSignInAt) return 'status-offline';
    const lastSignIn = new Date(lastSignInAt);
    const now = new Date();
    const diffInMinutes = (now - lastSignIn) / (1000 * 60);

    // Consider "away" if last seen within 1 hour but not online
    if (diffInMinutes < 60) return 'status-away';
    return 'status-offline';
  }
  startStatusRefresh() {
    // Refresh status every 2 minutes
    setInterval(() => {
      this.refreshOfficerStatus();
    }, 2 * 60 * 1000);
  }
  async refreshOfficerStatus() {
    // Only refresh if officers are visible
    const hasVisibleOfficers = this.departments.some(dept => dept.officersVisible);
    if (!hasVisibleOfficers) return;
    try {
      // Reload officers for all departments
      await this.loadOfficersForAllDepartments();
      this.renderDepartments();
    } catch (error) {
      console.error('Failed to refresh officer status:', error);
    }
  }
}
// Global functions for onclick handlers
window.openModal = (mode) => {
  if (window.departmentManager) {
    window.departmentManager.openModal(mode);
  }
};
window.closeModal = () => {
  if (window.departmentManager) {
    window.departmentManager.closeModal();
  }
};
window.toggleOfficers = (departmentId) => {
  if (window.departmentManager) {
    window.departmentManager.toggleOfficers(departmentId);
  }
};
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.departmentManager = new DepartmentManager();
});
// Close modal when clicking outside
window.addEventListener('click', (e) => {
  const modal = document.getElementById('departmentModal');
  if (e.target === modal) {
    window.departmentManager?.closeModal();
  }
});
