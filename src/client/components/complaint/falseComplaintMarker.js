/**
 * False Complaint Marker Component
 * Modal for coordinators to mark complaints as false
 */
class FalseComplaintMarker {

  constructor() {
    this.modal = null;
    this.complaintId = null;
    this.onSuccess = null;
    this.init();
  }
  init() {
    this.createModal();
    this.attachEventListeners();
  }
  createModal() {
    const modalHTML = `
      <div id="falseComplaintModal" class="modal" style="display: none;">
        <div class="modal-overlay"></div>
        <div class="modal-content false-complaint-modal">
          <div class="modal-header">
            <h2>Mark as False Complaint</h2>
            <button class="modal-close" id="closeFalseComplaintModal">&times;</button>
          </div>
          
          <div class="modal-body">
            <div class="warning-message">
              <svg class="warning-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              <p>This action will mark the complaint as false and cannot be easily undone. Please provide a clear reason.</p>
            </div>

            <form id="falseComplaintForm">
              <div class="form-group">
                <label for="falseComplaintReason">Reason <span class="required">*</span></label>
                <select id="falseComplaintReason" name="reason_type" required>
                  <option value="">Select a reason...</option>
                  <option value="duplicate">Duplicate submission</option>
                  <option value="fake">Invalid/fake information</option>
                  <option value="spam">Spam or test complaint</option>
                  <option value="jurisdiction">Outside jurisdiction</option>
                  <option value="other">Other (specify below)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="falseComplaintDetails">Additional Details <span class="required">*</span></label>
                <textarea 
                  id="falseComplaintDetails" 
                  name="details" 
                  rows="4" 
                  placeholder="Provide detailed explanation for marking this complaint as false..."
                  required
                  minlength="20"
                ></textarea>
                <span class="char-count">0 / 20 minimum characters</span>
              </div>

              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelFalseComplaint">
                  Cancel
                </button>
                <button type="submit" class="btn btn-danger" id="submitFalseComplaint">
                  Mark as False Complaint
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    // Append modal to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstElementChild);
    this.modal = document.getElementById('falseComplaintModal');
  }
  attachEventListeners() {
    // Close modal
    const closeBtn = document.getElementById('closeFalseComplaintModal');
    const cancelBtn = document.getElementById('cancelFalseComplaint');
    const overlay = this.modal.querySelector('.modal-overlay');
    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());
    overlay?.addEventListener('click', () => this.close());
    // Character count
    const textarea = document.getElementById('falseComplaintDetails');
    const charCount = this.modal.querySelector('.char-count');
    textarea?.addEventListener('input', (e) => {
      const {length} = e.target.value;
      charCount.textContent = `${length} / 20 minimum characters`;
      charCount.classList.toggle('valid', length >= 20);
    });
    // Form submission
    const form = document.getElementById('falseComplaintForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }
  open(complaintId, onSuccess) {
    this.complaintId = complaintId;
    this.onSuccess = onSuccess;
    // Reset form
    document.getElementById('falseComplaintForm')?.reset();
    const charCount = this.modal.querySelector('.char-count');
    charCount.textContent = '0 / 20 minimum characters';
    charCount.classList.remove('valid');
    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  close() {
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
    this.complaintId = null;
    this.onSuccess = null;
  }
  async handleSubmit() {
    const reasonType = document.getElementById('falseComplaintReason').value;
    const details = document.getElementById('falseComplaintDetails').value;
    if (!reasonType || !details || details.length < 20) {
      this.showError('Please provide a reason and detailed explanation (minimum 20 characters)');
      return;
    }
    // Confirmation dialog
    const confirmed = confirm(
      'Are you sure you want to mark this complaint as false? This action will change the complaint status to "rejected_false".'
    );
    if (!confirmed) return;
    const submitBtn = document.getElementById('submitFalseComplaint');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    try {
      const response = await fetch(`/api/complaints/${this.complaintId}/mark-false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: `${this.getReasonLabel(reasonType)}: ${details}`
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to mark complaint as false');
      }
      // Success
      this.showSuccess('Complaint marked as false successfully');
      if (this.onSuccess) {
        this.onSuccess(result.data);
      }
      setTimeout(() => {
        this.close();
      }, 1500);
    } catch (error) {
      console.error('Error marking complaint as false:', error);
      this.showError(error.message || 'Failed to mark complaint as false');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Mark as False Complaint';
    }
  }
  getReasonLabel(reasonType) {
    const labels = {
      duplicate: 'Duplicate submission',
      fake: 'Invalid/fake information',
      spam: 'Spam or test complaint',
      jurisdiction: 'Outside jurisdiction',
      other: 'Other'
    };
    return labels[reasonType] || reasonType;
  }
  showSuccess(message) {
    const notification = this.createNotification(message, 'success');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
  showError(message) {
    const notification = this.createNotification(message, 'error');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }
  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    return notification;
  }
}
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {

  module.exports = FalseComplaintMarker;
}
// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.falseComplaintMarker = new FalseComplaintMarker();
});
