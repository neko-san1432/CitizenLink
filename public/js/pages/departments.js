/**
 * Departments Page
 * Displays government departments information for citizens
 */

// Department icons mapping
const departmentIcons = {
  'CEO': '🏗️',
  'GSO': '🔧',
  'CPDC': '📋',
  'CHO': '🏥',
  'CSWDO': '🤝',
  'CDRRMO': '🚨',
  'ENRO': '🌿',
  'CTO': '💰',
  'CEEO': '💼',
  'HRMO': '👥',
  'PNP': '👮',
  'CLO': '⚖️',
  'OCM': '🏛️',
  'PAD': '📞',
  'OCA': '📋',
  'CIO': '📢',
  'CAO': '📊'
};

// Department colors mapping
const departmentColors = {
  'CEO': '#e74c3c',
  'GSO': '#f39c12',
  'CPDC': '#9b59b6',
  'CHO': '#e91e63',
  'CSWDO': '#3498db',
  'CDRRMO': '#e67e22',
  'ENRO': '#27ae60',
  'CTO': '#f1c40f',
  'CEEO': '#34495e',
  'HRMO': '#16a085',
  'PNP': '#2c3e50',
  'CLO': '#8e44ad',
  'OCM': '#c0392b',
  'PAD': '#2980b9',
  'OCA': '#d35400',
  'CIO': '#1abc9c',
  'CAO': '#7f8c8d'
};

async function loadDepartments() {
  try {
    const response = await fetch('/api/departments/active');
    const result = await response.json();

    if (result.success && result.data) {
      renderDepartments(result.data);
    } else {
      showError('Failed to load departments');
    }
  } catch (error) {
    console.error('Error loading departments:', error);
    showError('Error loading departments. Please try again.');
  }
}

function renderDepartments(departments) {
  const content = document.getElementById('departments-content');

  if (!content) return;

  if (departments.length === 0) {
    content.innerHTML = '<div class="error"><p>No departments found.</p></div>';
    return;
  }

  const departmentsHTML = `
        <div class="departments-grid">
            ${departments.map(dept => createDepartmentCard(dept)).join('')}
        </div>
    `;

  content.innerHTML = departmentsHTML;
}

function createDepartmentCard(department) {
  const icon = departmentIcons[department.code] || '🏢';
  const color = departmentColors[department.code] || '#3498db';
  let contactInfo = {};

  // Safely parse contact_info
  try {
    if (department.contact_info) {
      contactInfo = typeof department.contact_info === 'string'
        ? JSON.parse(department.contact_info)
        : department.contact_info;
    }
  } catch (e) {
    console.warn('Failed to parse contact_info for department:', department.code);
  }

  // Escape HTML to prevent XSS
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const name = escapeHtml(department.name || 'Unknown Department');
  const code = escapeHtml(department.code || '');
  const description = escapeHtml(department.description || 'No description available.');
  const level = escapeHtml(department.level || 'N/A');
  const responseTime = department.response_time_hours || 'N/A';
  const email = contactInfo.email ? escapeHtml(contactInfo.email) : null;
  const phone = contactInfo.phone ? escapeHtml(contactInfo.phone) : null;

  return `
        <div class="department-card">
            <div class="department-header">
                <div class="department-icon" style="background-color: ${color}">
                    ${icon}
                </div>
                <div class="department-title">
                    <h3 class="department-name">${name}</h3>
                    <p class="department-code">Code: ${code}</p>
                </div>
            </div>
            
            <div class="department-description">
                ${description}
            </div>
            
            <div class="department-details">
                <div class="detail-item">
                    <span class="detail-label">Level:</span>
                    <span class="detail-value">${level}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Response Time:</span>
                    <span class="detail-value">${responseTime}h</span>
                </div>
            </div>
            
            ${email || phone ? `
                <div class="department-contact">
                    <div class="contact-title">Contact Information</div>
                    <div class="contact-info">
                        ${email ? `
                            <div class="contact-item">
                                <span class="contact-icon">📧</span>
                                <span>${email}</span>
                            </div>
                        ` : ''}
                        ${phone ? `
                            <div class="contact-item">
                                <span class="contact-icon">📞</span>
                                <span>${phone}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function showError(message) {
  const content = document.getElementById('departments-content');
  if (!content) return;

  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  content.innerHTML = `<div class="error"><p>${escapeHtml(message)}</p></div>`;
}

// Load departments when page loads
document.addEventListener('DOMContentLoaded', loadDepartments);

