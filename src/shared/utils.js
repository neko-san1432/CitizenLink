// Shared utility functions

/**
 * Sanitize string input
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate slug from string
 */
function generateSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate random ID
 */
function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Parse query parameters
 */
function parseQueryParams(queryString) {
  const params = {};
  const urlParams = new URLSearchParams(queryString);
  
  for (const [key, value] of urlParams.entries()) {
    // Handle arrays (key[])
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!params[arrayKey]) params[arrayKey] = [];
      params[arrayKey].push(value);
    } else {
      params[key] = value;
    }
  }
  
  return params;
}

/**
 * Format date for display
 */
function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  return new Intl.DateTimeFormat('en-US', formatOptions).format(new Date(date));
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert camelCase to Title Case
 */
function camelToTitle(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, function(str) { return str.toUpperCase(); });
}

/**
 * Generate pagination metadata
 */
function getPaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages,
    hasNext,
    hasPrev,
    startIndex: (page - 1) * limit + 1,
    endIndex: Math.min(page * limit, total)
  };
}

// Browser-specific utilities (for client-side)
const BrowserUtils = {
  /**
   * Check if code is running in browser
   */
  isBrowser() {
    return typeof window !== 'undefined';
  },

  /**
   * Get query parameter from URL
   */
  getUrlParam(param) {
    if (!this.isBrowser()) return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  },

  /**
   * Set page title
   */
  setTitle(title) {
    if (!this.isBrowser()) return;
    document.title = title;
  },

  /**
   * Scroll to top of page
   */
  scrollToTop() {
    if (!this.isBrowser()) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    if (!this.isBrowser()) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
};

// Node.js specific utilities (for server-side)
const NodeUtils = {
  /**
   * Check if code is running in Node.js
   */
  isNode() {
    return typeof process !== 'undefined' && process.versions?.node;
  },

  /**
   * Get environment variable with default
   */
  getEnv(key, defaultValue = null) {
    if (!this.isNode()) return defaultValue;
    return process.env[key] || defaultValue;
  }
};

module.exports = {
  sanitizeString,
  isValidEmail,
  generateSlug,
  formatFileSize,
  deepClone,
  debounce,
  throttle,
  generateId,
  parseQueryParams,
  formatDate,
  capitalize,
  camelToTitle,
  getPaginationMeta,
  BrowserUtils,
  NodeUtils
};
