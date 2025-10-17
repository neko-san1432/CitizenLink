/**
 * Complaint Management Utilities
 * Helper functions for handling complaints across the application
 */

import apiClient from '../config/apiClient.js';
import showMessage from './toast.js';

// Status color mapping for UI
export const statusColors = {
  'pending review': '#ffa500',  // Orange
  'in progress': '#007bff',     // Blue
  'resolved': '#28a745',        // Green
  'rejected': '#dc3545',        // Red
  'closed': '#6c757d'           // Gray
};

// Priority color mapping
export const priorityColors = {
  'low': '#28a745',      // Green
  'medium': '#ffc107',   // Yellow
  'high': '#fd7e14',     // Orange
  'urgent': '#dc3545'    // Red
};

// Department display names
export const departmentNames = {
  'public-works': 'Public Works',
  'police': 'Police Department',
  'health': 'Health Department',
  'environment': 'Environment Department',
  'traffic': 'Traffic Management',
  'mayor': "Mayor's Office"
};

// Complaint type display names
export const typeNames = {
  'infrastructure': 'Infrastructure',
  'public-safety': 'Public Safety',
  'environmental': 'Environmental',
  'health': 'Health & Sanitation',
  'traffic': 'Traffic & Transportation',
  'noise': 'Noise Pollution',
  'other': 'Other'
};

/**
 * Format complaint data for display
 */
export function formatComplaint(complaint) {
  return {
    ...complaint,
    formattedDate: new Date(complaint.submitted_at).toLocaleDateString(),
    formattedTime: new Date(complaint.submitted_at).toLocaleTimeString(),
    statusColor: statusColors[complaint.status] || '#6c757d',
    priorityColor: priorityColors[complaint.priority] || '#6c757d',
    departmentNames: (complaint.department_r || []).map(dept => departmentNames[dept] || dept),
    typeName: typeNames[complaint.type] || complaint.type || 'Unspecified',
    evidenceCount: (complaint.evidence || []).length
  };
}

/**
 * Create complaint status badge HTML
 */
export function createStatusBadge(status) {
  const color = statusColors[status] || '#6c757d';
  const displayStatus = status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  return `<span class="status-badge" style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
    ${displayStatus}
  </span>`;
}

/**
 * Create priority badge HTML
 */
export function createPriorityBadge(priority) {
  const color = priorityColors[priority] || '#6c757d';
  const displayPriority = priority.charAt(0).toUpperCase() + priority.slice(1);
  
  return `<span class="priority-badge" style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
    ${displayPriority}
  </span>`;
}

/**
 * Create complaint card HTML
 */
export function createComplaintCard(complaint) {
  const formatted = formatComplaint(complaint);
  
  return `
    <div class="complaint-card" data-complaint-id="${complaint.id}" style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: white;">
      <div class="complaint-header" style="display: flex; justify-content: between; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">${complaint.title}</h3>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            ${createStatusBadge(complaint.status)}
            ${createPriorityBadge(complaint.priority)}
            ${formatted.typeName ? `<span class="type-badge" style="background-color: #e9ecef; color: #495057; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${formatted.typeName}</span>` : ''}
          </div>
        </div>
        <div class="complaint-date" style="text-align: right; color: #6c757d; font-size: 14px;">
          <div>${formatted.formattedDate}</div>
          <div>${formatted.formattedTime}</div>
        </div>
      </div>
      
      <div class="complaint-description" style="margin-bottom: 12px; color: #666; line-height: 1.4;">
        ${complaint.descriptive_su.length > 150 ? complaint.descriptive_su.substring(0, 150) + '...' : complaint.descriptive_su}
      </div>
      
      <div class="complaint-details" style="display: flex; flex-wrap: wrap; gap: 16px; color: #6c757d; font-size: 14px; margin-bottom: 12px;">
        ${complaint.location_text ? `<div><strong>Location:</strong> ${complaint.location_text}</div>` : ''}
        ${formatted.departmentNames.length > 0 ? `<div><strong>Departments:</strong> ${formatted.departmentNames.join(', ')}</div>` : ''}
        ${formatted.evidenceCount > 0 ? `<div><strong>Evidence:</strong> ${formatted.evidenceCount} file(s)</div>` : ''}
      </div>
      
      <div class="complaint-actions" style="display: flex; gap: 8px;">
        <button class="btn-view" onclick="viewComplaint('${complaint.id}')" style="padding: 6px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
          View Details
        </button>
        ${canUpdateStatus() ? `
          <button class="btn-update-status" onclick="showStatusUpdate('${complaint.id}', '${complaint.status}')" style="padding: 6px 12px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            Update Status
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Check if current user can update complaint status
 */
export function canUpdateStatus() {
  // This should check user role - placeholder for now
  return window.userRole && (window.userRole === 'super-admin' || window.userRole.startsWith('lgu-'));
}

/**
 * Show complaint details modal
 */
export async function viewComplaint(complaintId) {
  try {
    const response = await apiClient.getComplaint(complaintId);
    if (!response.success) {
      throw new Error(response.error);
    }
    
    const complaint = response.data;
    const formatted = formatComplaint(complaint);
    
    // Create modal HTML
    const modalHTML = `
      <div id="complaintModal" class="modal" style="display: flex; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); align-items: center; justify-content: center;">
        <div class="modal-content" style="background-color: white; padding: 24px; border-radius: 8px; max-width: 600px; max-height: 80vh; overflow-y: auto; margin: 20px;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee;">
            <h2 style="margin: 0; color: #333;">Complaint Details</h2>
            <button onclick="closeComplaintModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
          </div>
          
          <div class="complaint-full-details">
            <div class="detail-row" style="margin-bottom: 16px;">
              <h3 style="margin: 0 0 8px 0; color: #333;">${complaint.title}</h3>
              <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                ${createStatusBadge(complaint.status)}
                ${createPriorityBadge(complaint.priority)}
                ${formatted.typeName ? `<span class="type-badge" style="background-color: #e9ecef; color: #495057; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${formatted.typeName}</span>` : ''}
              </div>
            </div>
            
            <div class="detail-row" style="margin-bottom: 16px;">
              <strong>Description:</strong>
              <p style="margin: 8px 0; line-height: 1.5; color: #666;">${complaint.descriptive_su}</p>
            </div>
            
            <div class="detail-row" style="margin-bottom: 16px;">
              <strong>Location:</strong>
              <p style="margin: 8px 0; color: #666;">${complaint.location_text}</p>
              ${complaint.latitude && complaint.longitude ? `<small style="color: #999;">Coordinates: ${complaint.latitude}, ${complaint.longitude}</small>` : ''}
            </div>
            
            ${formatted.departmentNames.length > 0 ? `
              <div class="detail-row" style="margin-bottom: 16px;">
                <strong>Departments:</strong>
                <p style="margin: 8px 0; color: #666;">${formatted.departmentNames.join(', ')}</p>
              </div>
            ` : ''}
            
            <div class="detail-row" style="margin-bottom: 16px;">
              <strong>Submitted:</strong>
              <p style="margin: 8px 0; color: #666;">${formatted.formattedDate} at ${formatted.formattedTime}</p>
            </div>
            
            ${complaint.evidence && complaint.evidence.length > 0 ? `
              <div class="detail-row" style="margin-bottom: 16px;">
                <strong>Evidence Files:</strong>
                <div class="evidence-list" style="margin-top: 8px;">
                  ${complaint.evidence.map(file => `
                    <div class="evidence-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background-color: #f8f9fa; border-radius: 4px; margin-bottom: 4px;">
                      <span>${file.fileName}</span>
                      <a href="${file.publicUrl}" target="_blank" style="color: #007bff; text-decoration: none;">View</a>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            
            ${complaint.admin_notes ? `
              <div class="detail-row" style="margin-bottom: 16px;">
                <strong>Admin Notes:</strong>
                <p style="margin: 8px 0; color: #666; background-color: #f8f9fa; padding: 12px; border-radius: 4px;">${complaint.admin_notes}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
  } catch (error) {
    console.error('Error viewing complaint:', error);
    showMessage('error', 'Failed to load complaint details');
  }
}

/**
 * Close complaint modal
 */
export function closeComplaintModal() {
  const modal = document.getElementById('complaintModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Show status update modal
 */
export async function showStatusUpdate(complaintId, currentStatus) {
  const statusOptions = ['pending review', 'in progress', 'resolved', 'rejected', 'closed'];
  
  const modalHTML = `
    <div id="statusUpdateModal" class="modal" style="display: flex; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); align-items: center; justify-content: center;">
      <div class="modal-content" style="background-color: white; padding: 24px; border-radius: 8px; max-width: 400px; margin: 20px;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee;">
          <h3 style="margin: 0; color: #333;">Update Status</h3>
          <button onclick="closeStatusModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
        </div>
        
        <form id="statusUpdateForm">
          <div style="margin-bottom: 16px;">
            <label for="newStatus" style="display: block; margin-bottom: 8px; font-weight: bold;">New Status:</label>
            <select id="newStatus" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              ${statusOptions.map(status => `
                <option value="${status}" ${status === currentStatus ? 'selected' : ''}>
                  ${status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              `).join('')}
            </select>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label for="adminNotes" style="display: block; margin-bottom: 8px; font-weight: bold;">Notes (Optional):</label>
            <textarea id="adminNotes" rows="3" placeholder="Add any notes about this status change..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
          </div>
          
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" onclick="closeStatusModal()" style="padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Cancel
            </button>
            <button type="submit" style="padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Update Status
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Handle form submission
  document.getElementById('statusUpdateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newStatus = document.getElementById('newStatus').value;
    const notes = document.getElementById('adminNotes').value;
    
    try {
      const response = await apiClient.updateComplaintStatus(complaintId, newStatus, notes);
      
      if (response.success) {
        showMessage('success', 'Complaint status updated successfully');
        closeStatusModal();
        // Refresh the complaints list if it exists
        if (window.loadComplaints) {
          window.loadComplaints();
        }
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showMessage('error', 'Failed to update complaint status');
    }
  });
}

/**
 * Close status update modal
 */
export function closeStatusModal() {
  const modal = document.getElementById('statusUpdateModal');
  if (modal) {
    modal.remove();
  }
}

// Make functions globally available
window.viewComplaint = viewComplaint;
window.closeComplaintModal = closeComplaintModal;
window.showStatusUpdate = showStatusUpdate;
window.closeStatusModal = closeStatusModal;
