/**
 * False Complaint Marker Component
 * Handles marking complaints as false with reasons and evidence
 */
import { supabase } from '/js/config/config.js';

class FalseComplaintMarker {

  constructor() {
    this.modal = null;
    this.complaintId = null;
    this.callback = null;
  }
  /**
   * Show the false complaint marker modal
   * @param {string} complaintId - The ID of the complaint to mark as false
   * @param {Function} callback - Callback function to execute after marking
   */
  show(complaintId, callback = null) {
    this.complaintId = complaintId;
    this.callback = callback;
    this.createModal();
    this.attachEventListeners();
    document.body.appendChild(this.modal);
    // Trigger animation
    requestAnimationFrame(() => {
      this.modal.style.opacity = '1';
    });
  }
  /**
   * Create the modal HTML structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'false-complaint-modal';
    this.modal.style.opacity = '0';
    this.modal.style.transition = 'opacity 0.3s ease';
    this.modal.innerHTML = `
      <div class="false-complaint-content">
        <div class="false-complaint-header">
          <div class="false-complaint-icon">⚠️</div>
          <div class="false-complaint-title">Mark as False Complaint</div>
        </div>
        
        <div class="warning-message">
          <span class="warning-icon">⚠️</span>
          <strong>Warning:</strong> Marking a complaint as false is a serious action that cannot be undone. 
          Please ensure you have sufficient evidence to support this decision.
        </div>
        
        <form class="false-complaint-form" id="false-complaint-form">
          <div class="form-group">
            <label class="form-label" for="false-reason">Reason for marking as false *</label>
            <select class="form-select" id="false-reason" required>
              <option value="">Select a reason...</option>
              <option value="duplicate">Duplicate complaint</option>
              <option value="spam">Spam or irrelevant content</option>
              <option value="false-information">False or misleading information</option>
              <option value="prank">Prank or hoax</option>
              <option value="malicious">Malicious intent</option>
              <option value="other">Other (specify in notes)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="false-notes">Additional Notes</label>
            <textarea 
              class="form-textarea" 
              id="false-notes" 
              placeholder="Provide additional details about why this complaint is false..."
              rows="4"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Evidence of False Complaint</label>
            <div class="false-complaint-reasons">
              <label class="reason-option">
                <input type="checkbox" class="reason-radio" value="duplicate-check">
                <div>
                  <div class="reason-text">Verified duplicate of existing complaint</div>
                  <div class="reason-description">Same issue reported by same or different user</div>
                </div>
              </label>
              <label class="reason-option">
                <input type="checkbox" class="reason-radio" value="location-false">
                <div>
                  <div class="reason-text">False location information</div>
                  <div class="reason-description">Complaint location does not exist or is incorrect</div>
                </div>
              </label>
              <label class="reason-option">
                <input type="checkbox" class="reason-radio" value="spam-content">
                <div>
                  <div class="reason-text">Spam or inappropriate content</div>
                  <div class="reason-description">Content violates community guidelines</div>
                </div>
              </label>
              <label class="reason-option">
                <input type="checkbox" class="reason-radio" value="verified-false">
                <div>
                  <div class="reason-text">Verified as false by investigation</div>
                  <div class="reason-description">On-site investigation confirmed false information</div>
                </div>
              </label>
            </div>
          </div>
          
          <div class="false-complaint-actions">
            <button type="button" class="btn btn-secondary" id="cancel-false-complaint">Cancel</button>
            <button type="submit" class="btn btn-danger" id="confirm-false-complaint">
              Mark as False Complaint
            </button>
          </div>
        </form>
      </div>
    `;
  }
  /**
   * Attach event listeners to the modal
   */
  attachEventListeners() {
    const form = this.modal.querySelector('#false-complaint-form');
    const cancelBtn = this.modal.querySelector('#cancel-false-complaint');
    const reasonOptions = this.modal.querySelectorAll('.reason-option');
    // Handle form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    // Handle cancel button
    cancelBtn.addEventListener('click', () => {
      this.hide();
    });
    // Handle reason option selection
    reasonOptions.forEach(option => {
      option.addEventListener('click', () => {
        const radio = option.querySelector('.reason-radio');
        radio.checked = !radio.checked;
        option.classList.toggle('selected', radio.checked);
      });
    });
    // Handle clicking outside modal to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.parentNode) {
        this.hide();
      }
    });
  }
  /**
   * Handle form submission
   */
  async handleSubmit() {
    const form = this.modal.querySelector('#false-complaint-form');
    const formData = new FormData(form);
    const reason = formData.get('false-reason');
    const notes = formData.get('false-notes');
    const evidence = Array.from(this.modal.querySelectorAll('.reason-radio:checked'))
      .map(radio => radio.value);
    if (!reason) {
      this.showError('Please select a reason for marking this complaint as false.');
      return;
    }
    try {
      // Show loading state
      this.showLoading();
      // SECURITY: Use Supabase session token, never localStorage
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Submit the false complaint marking
      const response = await fetch(`/api/complaints/${this.complaintId}/mark-false`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason,
          notes,
          evidence,
          marked_at: new Date().toISOString()
        })
      });
      const result = await response.json();
      if (result.success) {
        this.showSuccess('Complaint marked as false successfully.');
        // Execute callback if provided
        if (this.callback && typeof this.callback === 'function') {
          this.callback(result);
        }
        // Close modal after a short delay
        setTimeout(() => {
          this.hide();
        }, 1500);
      } else {
        this.showError(result.error || 'Failed to mark complaint as false.');
      }
    } catch (error) {
      console.error('Error marking complaint as false:', error);
      this.showError('An error occurred while marking the complaint as false.');
    }
  }
  /**
   * Show loading state
   */
  showLoading() {
    const submitBtn = this.modal.querySelector('#confirm-false-complaint');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<div class="spinner"></div> Processing...';
    submitBtn.disabled = true;
  }
  /**
   * Show error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }
  /**
   * Show success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }
  /**
   * Show message in modal
   */
  showMessage(message, type) {
    // Remove existing messages
    const existingMessage = this.modal.querySelector('.modal-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    const messageDiv = document.createElement('div');
    messageDiv.className = `modal-message ${type === 'error' ? 'error-message' : 'success-message'}`;
    messageDiv.textContent = message;
    const form = this.modal.querySelector('#false-complaint-form');
    form.insertBefore(messageDiv, form.firstChild);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }
  /**
   * Hide the modal
   */
  hide() {

    if (this.modal && this.modal.parentNode) {
      this.modal.style.opacity = '0';
      setTimeout(() => {
        if (this.modal && this.modal.parentNode) {
          this.modal.parentNode.removeChild(this.modal);
        }
        this.modal = null;
      }, 300);
    }
  }
}
// Export the class

export default FalseComplaintMarker;
