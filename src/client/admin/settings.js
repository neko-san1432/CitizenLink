import apiClient from '../config/apiClient.js';
import showMessage from '../components/toast.js';

class SettingsManager {
  constructor() {
    this.settings = [];
    this.currentSetting = null;
    this.currentCategory = 'all';
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = document.getElementById('settingForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Auto-format setting key
    const keyInput = document.getElementById('settingKey');
    if (keyInput) {
      keyInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      });
    }
  }

  async loadSettings() {
    try {
      const response = await apiClient.get('/api/settings');
      if (response.success) {
        this.settings = response.data;
        this.renderCategories();
        this.renderSettings();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showMessage('error', 'Failed to load settings');
    }
  }

  renderCategories() {
    const categoryList = document.getElementById('categoryList');
    if (!categoryList) return;

    const categories = ['all', ...new Set(this.settings.map(s => s.category))];
    const allItem = categoryList.querySelector('[data-category="all"]');

    // Remove existing category items except "All"
    const existingItems = categoryList.querySelectorAll('[data-category]:not([data-category="all"])');
    existingItems.forEach(item => item.remove());

    // Add category items
    categories.slice(1).forEach(category => {
      const item = document.createElement('li');
      item.className = 'category-item';
      item.dataset.category = category;
      item.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      item.addEventListener('click', () => this.selectCategory(category));
      categoryList.appendChild(item);
    });

    // Setup click handler for "All" if not already done
    if (allItem && !allItem.hasAttribute('data-setup')) {
      allItem.addEventListener('click', () => this.selectCategory('all'));
      allItem.setAttribute('data-setup', 'true');
    }
  }

  selectCategory(category) {
    this.currentCategory = category;

    // Update active state
    document.querySelectorAll('.category-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    this.renderSettings();
  }

  renderSettings() {
    const content = document.getElementById('settingsContent');
    if (!content) return;

    const filteredSettings = this.currentCategory === 'all'
      ? this.settings
      : this.settings.filter(s => s.category === this.currentCategory);

    if (filteredSettings.length === 0) {
      content.innerHTML = '';
      const noSettingsDiv = document.createElement('div');
      noSettingsDiv.style.textAlign = 'center';
      noSettingsDiv.style.padding = '2rem';
      noSettingsDiv.style.color = '#6b7280';

      const message = document.createElement('p');
      message.textContent = 'No settings found in this category.';

      const button = document.createElement('button');
      button.className = 'btn btn-primary';
      button.textContent = 'Add First Setting';
      button.onclick = () => openModal('add');

      noSettingsDiv.appendChild(message);
      noSettingsDiv.appendChild(button);
      content.appendChild(noSettingsDiv);
      return;
    }

    // Create safe HTML content
    const safeHtml = filteredSettings.map(setting => `
      <div class="setting-item">
        <div class="setting-header">
          <div>
            <span class="setting-key">${setting.key}</span>
            <span class="type-badge">${setting.type}</span>
            ${setting.is_public ? '<span class="public-badge">Public</span>' : ''}
          </div>
          <div class="setting-actions">
            <button class="btn btn-sm btn-primary" onclick="settingsManager.editSetting('${setting.key}')">
              Edit
            </button>
            <button class="btn btn-sm btn-danger" onclick="settingsManager.deleteSetting('${setting.key}')">
              Delete
            </button>
          </div>
        </div>
        ${setting.description ? `<div class="setting-description">${setting.description}</div>` : ''}
        <div class="setting-value ${setting.type === 'html' ? 'html' : ''}">
          ${this.formatValue(setting)}
        </div>
      </div>
    `).join('');

    // Use safer DOM manipulation instead of innerHTML
    content.innerHTML = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.sanitizeHtml(safeHtml);
    while (tempDiv.firstChild) {
      content.appendChild(tempDiv.firstChild);
    }
  }

  // Simple HTML sanitization function
  sanitizeHtml(html) {
    // Basic sanitization - remove script tags and dangerous attributes
    return html
      .replace(/<script\b[^<]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
  }

  formatValue(setting) {
    switch (setting.type) {
      case 'html':
        return setting.value; // Show raw HTML for editing purposes
      case 'boolean':
        return setting.parsed_value ? 'true' : 'false';
      case 'json':
        return JSON.stringify(setting.parsed_value, null, 2);
      default:
        return setting.value;
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
      key: formData.get('key'),
      value: formData.get('value'),
      type: formData.get('type'),
      category: formData.get('category'),
      description: formData.get('description'),
      is_public: formData.has('is_public')
    };

    // Validate JSON if type is json
    if (data.type === 'json') {
      try {
        JSON.parse(data.value);
      } catch (e) {
        showMessage('error', 'Invalid JSON format');
        return;
      }
    }

    try {
      let response;
      if (this.currentSetting) {
        response = await apiClient.put(`/api/settings/${this.currentSetting.key}`, data);
      } else {
        response = await apiClient.post('/api/settings', data);
      }

      if (response.success) {
        showMessage('success', response.message);
        this.closeModal();
        await this.loadSettings();
      }
    } catch (error) {
      console.error('Setting operation failed:', error);
      showMessage('error', error.message || 'Operation failed');
    }
  }

  openModal(mode = 'add', setting = null) {
    this.currentSetting = setting;
    const modal = document.getElementById('settingModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('settingForm');

    if (mode === 'edit' && setting) {
      title.textContent = 'Edit Setting';
      document.getElementById('settingKey').value = setting.key;
      document.getElementById('settingKey').disabled = true; // Can't change key
      document.getElementById('settingType').value = setting.type;
      document.getElementById('settingValue').value = setting.value;
      document.getElementById('settingCategory').value = setting.category;
      document.getElementById('settingDescription').value = setting.description || '';
      document.getElementById('settingPublic').checked = setting.is_public;
      this.handleTypeChange(); // Update help text
    } else {
      title.textContent = 'Add Setting';
      form.reset();
      document.getElementById('settingKey').disabled = false;
      document.getElementById('settingCategory').value = this.currentCategory === 'all' ? 'general' : this.currentCategory;
      this.handleTypeChange();
    }

    modal.style.display = 'block';
  }

  closeModal() {
    const modal = document.getElementById('settingModal');
    modal.style.display = 'none';
    this.currentSetting = null;
  }

  editSetting(key) {
    const setting = this.settings.find(s => s.key === key);
    if (setting) {
      this.openModal('edit', setting);
    }
  }

  async deleteSetting(key) {
    const setting = this.settings.find(s => s.key === key);
    if (!setting) return;

    if (!confirm(`Are you sure you want to delete the setting "${key}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiClient.delete(`/api/settings/${key}`);
      if (response.success) {
        showMessage('success', 'Setting deleted successfully');
        await this.loadSettings();
      }
    } catch (error) {
      console.error('Delete failed:', error);
      showMessage('error', error.message || 'Delete operation failed');
    }
  }

  async initializeDefaults() {
    if (!confirm('This will create default settings. Existing settings will not be modified. Continue?')) {
      return;
    }

    try {
      const response = await apiClient.post('/api/settings/initialize');
      if (response.success) {
        showMessage('success', 'Default settings initialized successfully');
        await this.loadSettings();
      }
    } catch (error) {
      console.error('Initialize failed:', error);
      showMessage('error', error.message || 'Initialization failed');
    }
  }

  handleTypeChange() {
    const type = document.getElementById('settingType').value;
    const helpElement = document.getElementById('valueHelp');
    const valueInput = document.getElementById('settingValue');

    const helpTexts = {
      text: 'Enter a simple text value',
      textarea: 'Enter multi-line text content',
      html: 'Enter HTML content (be careful with security)',
      boolean: 'Enter "true" or "false"',
      number: 'Enter a numeric value',
      json: 'Enter valid JSON format'
    };

    if (helpElement) {
      const safeType = String(type || '').toLowerCase();
      helpElement.textContent = helpTexts[safeType] || 'Enter the setting value';
    }

    // Adjust textarea size based on type
    if (valueInput) {
      if (type === 'html' || type === 'json') {
        valueInput.rows = 8;
      } else if (type === 'textarea') {
        valueInput.rows = 4;
      } else {
        valueInput.rows = 2;
      }
    }
  }
}

// Global functions for onclick handlers
window.openModal = (mode) => {
  if (window.settingsManager) {
    window.settingsManager.openModal(mode);
  }
};

window.closeModal = () => {
  if (window.settingsManager) {
    window.settingsManager.closeModal();
  }
};

window.initializeDefaults = () => {
  if (window.settingsManager) {
    window.settingsManager.initializeDefaults();
  }
};

window.handleTypeChange = () => {
  if (window.settingsManager) {
    window.settingsManager.handleTypeChange();
  }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.settingsManager = new SettingsManager();
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  const modal = document.getElementById('settingModal');
  if (e.target === modal) {
    window.settingsManager?.closeModal();
  }
});

