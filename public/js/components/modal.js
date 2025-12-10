/**
 * Reusable Modal Component
 * Handles modal display, content loading, and user interactions
 */
class ModalManager {

  constructor() {
    this.activeModal = null;
    this.modalOverlay = null;
    this.init();
  }
  init() {
    this.createModalOverlay();
    this.setupEventListeners();
  }
  createModalOverlay() {
    // Create modal overlay if it doesn't exist
    if (!document.getElementById('modal-overlay')) {
      this.modalOverlay = document.createElement('div');
      this.modalOverlay.id = 'modal-overlay';
      this.modalOverlay.className = 'modal-overlay';
      document.body.appendChild(this.modalOverlay);
    } else {
      this.modalOverlay = document.getElementById('modal-overlay');
    }
  }
  setupEventListeners() {
    // Close modal when clicking overlay
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeModal();
      }
    });
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.closeModal();
      }
    });
  }
  /**
   * Open a modal by ID
   * @param {string} modalId - ID of the modal to open
   * @param {Object} options - Modal options
   */
  openModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.error(`Modal with ID '${modalId}' not found`);
      return;
    }
    // Close any active modal first
    if (this.activeModal) {
      this.closeModal();
    }
    this.activeModal = modal;
    // Show modal and overlay
    modal.classList.add('active');
    this.modalOverlay.classList.add('active');
    document.body.classList.add('modal-open');
    // Focus management
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
    // Call onOpen callback if provided
    if (options.onOpen && typeof options.onOpen === 'function') {
      options.onOpen(modal);
    }
  }
  /**
   * Close the currently active modal
   */
  closeModal() {
    if (!this.activeModal) {
      // If no active modal but overlay is active, clean it up
      if (this.modalOverlay && this.modalOverlay.classList.contains('active')) {
        this.modalOverlay.classList.remove('active');
        document.body.classList.remove('modal-open');
      }
      return;
    }
    const modal = this.activeModal;
    // Hide modal and overlay
    modal.classList.remove('active');
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
    document.body.classList.remove('modal-open');
    // Call onClose callback if provided
    const {onClose} = modal.dataset;
    if (onClose && typeof window[onClose] === 'function') {
      window[onClose]();
    }
    this.activeModal = null;
  }

  /**
   * Force cleanup of all modals (for stuck overlays)
   */
  cleanupAllModals() {
    // Close active modal
    if (this.activeModal) {
      this.closeModal();
    }
    // Remove active class from overlay
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
    // Remove body class
    document.body.classList.remove('modal-open');
    // Reset state
    this.activeModal = null;
  }
  /**
   * Create a modal dynamically
   * @param {Object} config - Modal configuration
   */
  createModal(config) {
    const {
      id,
      title,
      content,
      footer,
      className = '',
      size = 'medium' // small, medium, large, fullscreen
    } = config;
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = `modal ${className}`;
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const sizeClass = `modal-${size}`;
    modal.innerHTML = `
      <div class="modal-dialog ${sizeClass}">
        <div class="modal-content">
          ${title ? `
            <div class="modal-header">
              <h3 class="modal-title">${title}</h3>
              <button class="modal-close" data-close-modal aria-label="Close modal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          ` : ''}
          <div class="modal-body">
            ${content}
          </div>
          ${footer ? `
            <div class="modal-footer">
              ${footer}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Add close event listeners
    const closeButtons = modal.querySelectorAll('[data-close-modal]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    return modal;
  }

  /**
   * Load content dynamically into a modal
   * @param {string} modalId - ID of the modal
   * @param {string} content - HTML content to load
   */
  loadContent(modalId, content) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const body = modal.querySelector('.modal-body');
    if (body) {
      body.innerHTML = content;
    }
  }

  /**
   * Show loading state in modal
   * @param {string} modalId - ID of the modal
   */
  showLoading(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const body = modal.querySelector('.modal-body');
    if (body) {
      body.innerHTML = `
        <div class="modal-loading">
          <div class="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      `;
    }
  }
}

// Create global instance
window.modalManager = new ModalManager();

// Global cleanup function for stuck overlays
window.cleanupStuckModals = function() {
  // Use ModalManager cleanup if available
  if (window.modalManager) {
    window.modalManager.cleanupAllModals();
  }

  // Fallback: manually clean up any stuck overlays
  const stuckModals = document.querySelectorAll('.modal.active, .modal-overlay.active');
  stuckModals.forEach(modal => {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
  });

  // Remove body class
  document.body.classList.remove('modal-open');

  // Remove any dynamically created modals that might be stuck
  const dynamicModals = document.querySelectorAll('[id^="map-modal"], [id^="modal-"]:not(#modal-overlay)');
  dynamicModals.forEach(modal => {
    if (modal.style.position === 'fixed' && modal.style.zIndex >= 1000) {
      modal.remove();
    }
  });
};

// Run cleanup on page load to catch any stuck overlays from previous navigation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.cleanupStuckModals);
} else {
  // DOM already loaded, run immediately
  window.cleanupStuckModals();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModalManager;
}
