// Modern Toast Notification System
class ToastManager {
  constructor() {
    this.toasts = [];
    this.container = null;
    this.init();
  }

  init() {
    // Create toast container if it doesn't exist
    this.container = document.getElementById('toast');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(type, message, options = {}) {
    const toast = this.createToast(type, message, options);
    this.container.appendChild(toast);
    this.toasts.push(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Auto remove after duration
    const duration = options.duration || this.getDuration(type);
    setTimeout(() => {
      this.remove(toast);
    }, duration);

    return toast;
  }

  createToast(type, message, options = {}) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = this.getIcon(type);
    const title = this.getTitle(type);
    
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">${icon}</div>
        <div class="toast-body">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="toast-progress"></div>
    `;

    // Add click to dismiss
    toast.addEventListener('click', (e) => {
      if (!e.target.closest('.toast-close')) {
        this.remove(toast);
      }
    });

    return toast;
  }

  getIcon(type) {
    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22,4 12,14.01 9,11.01"></polyline>
      </svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`,
      message: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>`
    };
    return icons[type] || icons.message;
  }

  getTitle(type) {
    const titles = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Information',
      message: 'Message'
    };
    return titles[type] || 'Message';
  }

  getDuration(type) {
    const durations = {
      success: 4000,
      error: 6000,
      warning: 5000,
      info: 4000,
      message: 4000
    };
    return durations[type] || 4000;
  }

  remove(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      const index = this.toasts.indexOf(toast);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    }, 300);
  }

  clear() {
    this.toasts.forEach(toast => this.remove(toast));
  }
}

// Create global instance
const toastManager = new ToastManager();

// Export the showMessage function for backward compatibility
export default function showMessage(type, message, options = {}) {
  return toastManager.show(type, message, options);
}

// Export additional methods
export const Toast = {
  success: (message, options = {}) => toastManager.show('success', message, options),
  error: (message, options = {}) => toastManager.show('error', message, options),
  warning: (message, options = {}) => toastManager.show('warning', message, options),
  info: (message, options = {}) => toastManager.show('info', message, options),
  message: (message, options = {}) => toastManager.show('message', message, options),
  clear: () => toastManager.clear()
};
