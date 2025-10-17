/**
 * HR Link Generator
 * Handles signup link generation and management
 */

import apiClient from '../config/apiClient.js';
import showMessage from '../components/toast.js';

class LinkGenerator {
  constructor() {
    this.links = [];
    this.departments = [];
    this.init();
  }

  async init() {
    await this.loadDepartments();
    await this.loadLinks();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = document.getElementById('linkForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  async loadDepartments() {
    try {
      const response = await apiClient.getActiveDepartments();
      if (response.success) {
        this.departments = response.data;
        
        // Get user role to determine department restrictions
        const userRole = await this.getUserRole();
        this.filterDepartmentsByRole(userRole);
        
        this.populateDepartmentSelect();
        this.setupRoleRestrictions(userRole);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }

  async getUserRole() {
    try {
      const response = await apiClient.get('/api/user/role-info');
      return response.data?.role || 'citizen';
    } catch (error) {
      console.error('Failed to get user role:', error);
      return 'citizen';
    }
  }

  getHRDepartment(userRole) {
    if (userRole && userRole.startsWith('lgu-hr-')) {
      return userRole.split('-')[2]?.toUpperCase() || 'WST';
    }
    return null;
  }

  filterDepartmentsByRole(userRole) {
    // If user is LGU-HR, filter to only their department
    if (userRole.startsWith('lgu-hr-')) {
      const userDepartment = userRole.split('-')[2]; // Extract department from lgu-hr-DEPT
      this.departments = this.departments.filter(dept => 
        dept.code === userDepartment.toUpperCase()
      );
    }
    // Coordinators and super-admin can see all departments
  }

  setupRoleRestrictions(userRole) {
    console.log('[LINK-GENERATOR] Setting up role restrictions for:', userRole);
    
    const roleSelect = document.getElementById('role');
    const roleInfo = document.getElementById('role-info');
    const roleDescription = document.getElementById('role-description');
    
    if (userRole.startsWith('lgu-hr-')) {
      // LGU-HR can only create officer or admin roles
      const options = roleSelect.querySelectorAll('option');
      options.forEach(option => {
        if (!['lgu-officer', 'lgu-admin'].includes(option.value)) {
          option.style.display = 'none';
        }
      });
      
      // Get HR user's department
      const hrDepartment = userRole.split('-')[2]?.toUpperCase() || 'WST';
      console.log(`[LINK-GENERATOR] HR Department: ${hrDepartment}`);
      
      // Hide the department field completely for LGU-HR
      const departmentField = document.querySelector('.form-group:has(#department)');
      if (departmentField) {
        departmentField.style.display = 'none';
      }
      
      // Show role info
      if (roleInfo && roleDescription) {
        roleDescription.textContent = `As an LGU-HR, you can only create signup links for ${hrDepartment} department with officer or admin roles.`;
        roleInfo.style.display = 'block';
      }
    } else if (userRole === 'complaint-coordinator') {
      // Show coordinator info
      if (roleInfo && roleDescription) {
        roleDescription.textContent = 'As a Complaint Coordinator, you can create signup links for any department and any position.';
        roleInfo.style.display = 'block';
      }
    } else if (userRole === 'super-admin') {
      // Show super admin info
      if (roleInfo && roleDescription) {
        roleDescription.textContent = 'As a Super Admin, you have full access to create signup links for any department and any position.';
        roleInfo.style.display = 'block';
      }
    }
  }

  populateDepartmentSelect() {
    const select = document.getElementById('department');
    if (!select) return;

    select.innerHTML = '<option value="">Select Department (Optional)</option>';
    this.departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.code;
      option.textContent = `${dept.name} (${dept.code})`;
      select.appendChild(option);
    });
  }

  async loadLinks() {
    try {
      const response = await apiClient.getSignupLinks();
      if (response.success) {
        console.log('[LINK-GENERATOR] Loaded links:', response.data);
        this.links = response.data;
        this.renderLinks();
        this.updateStats();
      }
    } catch (error) {
      console.error('Failed to load links:', error);
      showMessage('error', 'Failed to load signup links');
    }
  }

  renderLinks() {
    const container = document.getElementById('linksList');
    if (!container) return;

    if (this.links.length === 0) {
      container.innerHTML = '<div class="no-links">No signup links generated yet</div>';
      return;
    }

    container.innerHTML = this.links.map(link => {
      console.log('[LINK-GENERATOR] Rendering link:', { 
        code: link.code, 
        role: link.role, 
        department_code: link.department_code 
      });
      
      return `
      <div class="link-item ${link.is_expired ? 'expired' : ''} ${link.is_used ? 'used' : ''}">
        <div class="link-item-header">
          <span class="link-role">${this.getRoleDisplayName(link.role)}</span>
          <span class="link-status ${this.getStatusClass(link)}">${this.getStatusText(link)}</span>
        </div>
        <div class="link-details">
          <div><strong>Department:</strong> ${link.department_code || 'Any'}</div>
          <div><strong>Created:</strong> ${this.formatDate(link.created_at)}</div>
          <div><strong>Expires:</strong> ${link.expires_at ? this.formatDate(link.expires_at) : 'Never'}</div>
        </div>
        <div class="link-details">
          <div><strong>Code:</strong> ${link.code}</div>
          <div><strong>Used:</strong> ${link.used_at ? this.formatDate(link.used_at) : 'Not used'}</div>
          <div><strong>URL:</strong> <a href="${link.url}" target="_blank">Open Link</a></div>
        </div>
        <div class="link-actions">
          <button class="btn btn-sm btn-primary" onclick="linkGenerator.copyLinkUrl('${link.url}')">
            Copy URL
          </button>
          ${!link.is_used && !link.is_expired ? `
            <button class="btn btn-sm btn-warning" onclick="linkGenerator.deactivateLink('${link.id}')">
              Deactivate
            </button>
          ` : ''}
        </div>
      </div>
    `;
    }).join('');
  }

  updateStats() {
    const totalElement = document.getElementById('totalLinks');
    const activeElement = document.getElementById('activeLinks');
    const usedElement = document.getElementById('usedLinks');

    if (totalElement) totalElement.textContent = this.links.length;
    if (activeElement) activeElement.textContent = this.links.filter(l => !l.is_used && !l.is_expired).length;
    if (usedElement) usedElement.textContent = this.links.filter(l => l.is_used).length;
  }

  getRoleDisplayName(role) {
    const roleMap = {
      'lgu-officer': 'LGU Officer',
      'lgu-admin': 'LGU Admin',
      'lgu-hr': 'LGU HR'
    };
    return roleMap[role] || role;
  }

  getStatusClass(link) {
    if (link.is_used) return 'status-used';
    if (link.is_expired) return 'status-expired';
    return 'status-active';
  }

  getStatusText(link) {
    if (link.is_used) return 'Used';
    if (link.is_expired) return 'Expired';
    return 'Active';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  generateLink() {
    const form = document.getElementById('generatorForm');
    if (form) {
      form.style.display = 'block';
      form.scrollIntoView({ behavior: 'smooth' });
    }
  }

  cancelGenerate() {
    const form = document.getElementById('generatorForm');
    const generatedLink = document.getElementById('generatedLink');
    if (form) form.style.display = 'none';
    if (generatedLink) generatedLink.style.display = 'none';
    document.getElementById('linkForm').reset();
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userRole = await this.getUserRole();
    
    // Automatically get department based on user role
    let departmentCode = null;
    if (userRole.startsWith('lgu-hr-')) {
      departmentCode = this.getHRDepartment(userRole);
      console.log(`[LINK-GENERATOR] Auto-setting department for HR: ${departmentCode}`);
    } else {
      // For coordinators and super-admin, use form data
      departmentCode = formData.get('department_code') || null;
    }
    
    const data = {
      role: formData.get('role'),
      department_code: departmentCode,
      expires_in_hours: parseInt(formData.get('expires_in_hours')) || 1
    };
    
    console.log('[LINK-GENERATOR] Form data being submitted:', data);

    try {
      const response = await apiClient.generateSignupLink(data);
      if (response.success) {
        this.showGeneratedLink(response.data);
        await this.loadLinks(); // Refresh the list
        this.cancelGenerate();
        showMessage('success', 'Signup link generated successfully');
      }
    } catch (error) {
      console.error('Failed to generate link:', error);
      showMessage('error', error.message || 'Failed to generate signup link');
    }
  }

  showGeneratedLink(linkData) {
    const generatedLink = document.getElementById('generatedLink');
    const linkInput = document.getElementById('linkInput');
    const expiryTime = document.getElementById('expiryTime');

    if (linkInput) linkInput.value = linkData.url;
    if (expiryTime) {
      const expiryDate = new Date(linkData.expires_at);
      expiryTime.textContent = expiryDate.toLocaleString();
    }
    if (generatedLink) generatedLink.style.display = 'block';
  }

  copyLink() {
    const linkInput = document.getElementById('linkInput');
    if (linkInput) {
      linkInput.select();
      document.execCommand('copy');
      showMessage('success', 'Link copied to clipboard');
    }
  }

  copyLinkUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      showMessage('success', 'URL copied to clipboard');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showMessage('success', 'URL copied to clipboard');
    });
  }

  async deactivateLink(linkId) {
    console.log('[LINK-GENERATOR] Deactivating link:', linkId);
    
    if (!confirm('Are you sure you want to deactivate this link?')) {
      return;
    }

    try {
      console.log('[LINK-GENERATOR] Calling API to deactivate link...');
      const response = await apiClient.deactivateSignupLink(linkId);
      console.log('[LINK-GENERATOR] Deactivation response:', response);
      
      if (response.success) {
        showMessage('success', 'Link deactivated successfully');
        await this.loadLinks();
      } else {
        showMessage('error', response.error || 'Failed to deactivate link');
      }
    } catch (error) {
      console.error('[LINK-GENERATOR] Failed to deactivate link:', error);
      showMessage('error', error.message || 'Failed to deactivate link');
    }
  }

  filterLinks() {
    const roleFilter = document.getElementById('roleFilter')?.value;
    const statusFilter = document.getElementById('statusFilter')?.value;

    let filteredLinks = this.links;

    if (roleFilter) {
      filteredLinks = filteredLinks.filter(link => link.role === roleFilter);
    }

    if (statusFilter) {
      if (statusFilter === 'active') {
        filteredLinks = filteredLinks.filter(link => !link.is_used && !link.is_expired);
      } else if (statusFilter === 'expired') {
        filteredLinks = filteredLinks.filter(link => link.is_expired);
      } else if (statusFilter === 'used') {
        filteredLinks = filteredLinks.filter(link => link.is_used);
      }
    }

    // Temporarily replace links array for rendering
    const originalLinks = this.links;
    this.links = filteredLinks;
    this.renderLinks();
    this.links = originalLinks;
  }
}

// Global functions for onclick handlers
window.generateLink = () => {
  if (window.linkGenerator) {
    window.linkGenerator.generateLink();
  }
};

window.copyLink = () => {
  if (window.linkGenerator) {
    window.linkGenerator.copyLink();
  }
};

window.copyLinkUrl = (url) => {
  if (window.linkGenerator) {
    window.linkGenerator.copyLinkUrl(url);
  }
};

window.deactivateLink = (linkId) => {
  if (window.linkGenerator) {
    window.linkGenerator.deactivateLink(linkId);
  }
};

window.filterLinks = () => {
  if (window.linkGenerator) {
    window.linkGenerator.filterLinks();
  }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.linkGenerator = new LinkGenerator();
});
