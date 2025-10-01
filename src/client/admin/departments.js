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
      const response = await apiClient.get('/api/departments');
      if (response.success) {
        this.departments = response.data;
        this.renderDepartments();
        this.updateStats();
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
      showMessage('error', 'Failed to load departments');
    }
  }

  renderDepartments() {
    const grid = document.getElementById('departmentGrid');
    if (!grid) return;

    grid.innerHTML = this.departments.map(dept => `
      <div class="department-card">
        <div class="department-header">
          <span class="department-code">${dept.code}</span>
          <span class="status-badge ${dept.is_active ? 'status-active' : 'status-inactive'}">
            ${dept.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <h3>${dept.name}</h3>
        <p>${dept.description || 'No description provided'}</p>
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
