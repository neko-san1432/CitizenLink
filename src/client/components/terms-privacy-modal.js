/**
 * Terms and Privacy Modal Manager
 * Handles terms and conditions and privacy policy modals with dynamic content
 */
class TermsPrivacyModal {
  constructor() {
    this.settings = null;
    this.init();
  }

  async init() {
    // Load settings for dynamic content
    await this.loadSettings();
    
    // Create modals if they don't exist
    this.createModals();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Load settings from the server
   */
  async loadSettings() {
    try {
      const response = await fetch('/api/settings/public');
      if (response.ok) {
        const responseData = await response.json();
        // console.log removed for security // Debug log
        
        // Handle the API response format: { success: true, data: [...] }
        if (responseData.success && Array.isArray(responseData.data)) {
          // Convert array to object for easy access
          this.settings = responseData.data.reduce((acc, setting) => {
            acc[setting.key] = setting;
            return acc;
          }, {});
        } else if (Array.isArray(responseData)) {
          // Fallback: if response is directly an array
          this.settings = responseData.reduce((acc, setting) => {
            acc[setting.key] = setting;
            return acc;
          }, {});
        } else if (responseData && typeof responseData === 'object' && !responseData.success) {
          // If response is already an object but not the expected format
          this.settings = responseData;
        } else {
          // If response format is unexpected, use fallback
          console.warn('Unexpected response format:', typeof responseData, responseData);
          throw new Error('Unexpected response format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use fallback content
      this.settings = {
        terms_and_conditions: {
          value: this.getDefaultTermsContent()
        },
        privacy_policy: {
          value: this.getDefaultPrivacyContent()
        }
      };
    }
  }

  /**
   * Create the modal elements
   */
  createModals() {
    // console.log removed for security
    
    // Create Terms and Conditions Modal
    if (!document.getElementById('terms-conditions-modal')) {
      // console.log removed for security
      const termsModal = this.createTermsModal();
      document.body.appendChild(termsModal);
      // console.log removed for security
    } else {
      // console.log removed for security
    }

    // Create Privacy Policy Modal
    if (!document.getElementById('privacy-policy-modal')) {
      // console.log removed for security
      const privacyModal = this.createPrivacyModal();
      document.body.appendChild(privacyModal);
      // console.log removed for security
    } else {
      // console.log removed for security
    }
  }

  /**
   * Create Terms and Conditions Modal
   */
  createTermsModal() {
    const modal = document.createElement('div');
    modal.id = 'terms-conditions-modal';
    modal.className = 'modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal-dialog modal-large">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Terms and Conditions</h3>
            <button class="modal-close" data-close-modal aria-label="Close modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="modal-loading">
              <div class="loading-spinner"></div>
              <p>Loading terms and conditions...</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-close-modal>Close</button>
            <button class="btn btn-primary" data-accept-terms>I Accept</button>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Create Privacy Policy Modal
   */
  createPrivacyModal() {
    const modal = document.createElement('div');
    modal.id = 'privacy-policy-modal';
    modal.className = 'modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal-dialog modal-large">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Privacy Policy</h3>
            <button class="modal-close" data-close-modal aria-label="Close modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="modal-loading">
              <div class="loading-spinner"></div>
              <p>Loading privacy policy...</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-close-modal>Close</button>
            <button class="btn btn-primary" data-accept-privacy>I Accept</button>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // console.log removed for security
    
    // Terms and Conditions link
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-open-terms]') || e.target.closest('[data-open-terms]')) {
        // console.log removed for security
        e.preventDefault();
        this.openTermsModal();
      }
    });

    // Privacy Policy link
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-open-privacy]') || e.target.closest('[data-open-privacy]')) {
        // console.log removed for security
        e.preventDefault();
        this.openPrivacyModal();
      }
    });

    // Accept buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-accept-terms]')) {
        this.acceptTerms();
      }
      if (e.target.matches('[data-accept-privacy]')) {
        this.acceptPrivacy();
      }
    });

    // Close buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close-modal]')) {
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.classList.remove('active');
          document.body.classList.remove('modal-open');
        }
      }
    });
  }

  /**
   * Open Terms and Conditions Modal
   */
  async openTermsModal() {
    const modal = document.getElementById('terms-conditions-modal');
    if (!modal) return;

    // Show loading state
    const body = modal.querySelector('.modal-body');
    body.innerHTML = `
      <div class="modal-loading">
        <div class="loading-spinner"></div>
        <p>Loading terms and conditions...</p>
      </div>
    `;

    // Show modal
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Load content
    try {
      const content = this.settings?.terms_and_conditions?.value || this.getDefaultTermsContent();
      body.innerHTML = `<div class="terms-content">${content}</div>`;
    } catch (error) {
      console.error('Failed to load terms content:', error);
      body.innerHTML = `
        <div class="error-message">
          <p>Failed to load terms and conditions. Please try again later.</p>
        </div>
      `;
    }
  }

  /**
   * Open Privacy Policy Modal
   */
  async openPrivacyModal() {
    const modal = document.getElementById('privacy-policy-modal');
    if (!modal) return;

    // Show loading state
    const body = modal.querySelector('.modal-body');
    body.innerHTML = `
      <div class="modal-loading">
        <div class="loading-spinner"></div>
        <p>Loading privacy policy...</p>
      </div>
    `;

    // Show modal
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Load content
    try {
      const content = this.settings?.privacy_policy?.value || this.getDefaultPrivacyContent();
      body.innerHTML = `<div class="privacy-content">${content}</div>`;
    } catch (error) {
      console.error('Failed to load privacy content:', error);
      body.innerHTML = `
        <div class="error-message">
          <p>Failed to load privacy policy. Please try again later.</p>
        </div>
      `;
    }
  }

  /**
   * Handle terms acceptance
   */
  acceptTerms() {
    // Close modal
    const modal = document.getElementById('terms-conditions-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    // Check terms checkbox if it exists
    const termsCheckbox = document.getElementById('terms-checkbox');
    if (termsCheckbox) {
      termsCheckbox.checked = true;
    }

    // Trigger custom event
    document.dispatchEvent(new CustomEvent('termsAccepted', {
      detail: { timestamp: new Date().toISOString() }
    }));

    // Show success message
    this.showSuccessMessage('Terms and conditions accepted');
  }

  /**
   * Handle privacy acceptance
   */
  acceptPrivacy() {
    // Close modal
    const modal = document.getElementById('privacy-policy-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    // Check terms checkbox if it exists (privacy acceptance covers both)
    const termsCheckbox = document.getElementById('terms-checkbox');
    if (termsCheckbox) {
      termsCheckbox.checked = true;
    }

    // Trigger custom event
    document.dispatchEvent(new CustomEvent('privacyAccepted', {
      detail: { timestamp: new Date().toISOString() }
    }));

    // Show success message
    this.showSuccessMessage('Privacy policy accepted');
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    // Use existing toast system if available
    if (window.showToast) {
      window.showToast('success', message);
    } else {
      // Fallback to alert
      alert(message);
    }
  }

  /**
   * Get default terms content
   */
  getDefaultTermsContent() {
    return `
      <h2>Terms and Conditions</h2>
      <p>By using CitizenLink, you agree to the following terms:</p>
      <ul>
        <li>Provide accurate information when filing complaints</li>
        <li>Use the platform responsibly and lawfully</li>
        <li>Respect other users and government officials</li>
        <li>Do not submit false or malicious reports</li>
        <li>Maintain the confidentiality of your account credentials</li>
        <li>Report any security concerns immediately</li>
      </ul>
      <p>These terms may be updated periodically. Continued use constitutes acceptance of changes.</p>
      <p><strong>Last updated:</strong> ${new Date().toLocaleDateString()}</p>
    `;
  }

  /**
   * Get default privacy content
   */
  getDefaultPrivacyContent() {
    return `
      <h2>Privacy Policy</h2>
      <p>We are committed to protecting your privacy and personal information:</p>
      
      <h3>Information We Collect</h3>
      <ul>
        <li>Personal information (name, email, phone number) for account verification</li>
        <li>Complaint details and supporting documents</li>
        <li>Usage data to improve our services</li>
        <li>Location data when relevant to your complaints</li>
      </ul>

      <h3>How We Use Your Information</h3>
      <ul>
        <li>Process and track your complaints</li>
        <li>Communicate with you about your submissions</li>
        <li>Share necessary information with relevant government departments</li>
        <li>Improve our platform and services</li>
        <li>Ensure platform security and prevent abuse</li>
      </ul>

      <h3>Data Protection</h3>
      <ul>
        <li>We use secure encryption for data protection</li>
        <li>Access to your data is restricted to authorized personnel</li>
        <li>We do not sell your personal data to third parties</li>
        <li>You may request access, correction, or deletion of your data</li>
      </ul>

      <p>Contact us for privacy-related concerns or data requests.</p>
      <p><strong>Last updated:</strong> ${new Date().toLocaleDateString()}</p>
    `;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // console.log removed for security
  window.termsPrivacyModal = new TermsPrivacyModal();
  // console.log removed for security
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TermsPrivacyModal;
}
