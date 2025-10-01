// Input validation and sanitization utilities

/**
 * Sanitize string input by removing potentially dangerous characters
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>\"'&]/g, (match) => {
      const entityMap = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entityMap[match];
    });
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate mobile number (Philippine format)
 * @param {string} mobile - Mobile number to validate
 * @returns {boolean} True if valid Philippine mobile number
 */
export const isValidPhilippineMobile = (mobile) => {
  // Remove +63 prefix if present
  const cleanMobile = mobile.replace(/^\+63/, '');
  // Should be 10 digits starting with 9
  const mobileRegex = /^9\d{9}$/;
  return mobileRegex.test(cleanMobile);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validatePassword = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate and sanitize form data
 * @param {Object} formData - Form data object
 * @param {Object} rules - Validation rules for each field
 * @returns {Object} Validation result with sanitized data and errors
 */
export const validateAndSanitizeForm = (formData, rules) => {
  const sanitizedData = {};
  const errors = [];

  for (const [field, value] of Object.entries(formData)) {
    const rule = rules[field];

    if (!rule) {
      // No validation rule, just sanitize
      sanitizedData[field] = sanitizeString(value);
      continue;
    }

    // Check required fields
    if (rule.required && (!value || value.trim() === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip validation if field is empty and not required
    if (!value || value.trim() === '') {
      sanitizedData[field] = '';
      continue;
    }

    // Apply sanitization
    const sanitizedValue = sanitizeString(value);

    // Apply specific validations
    if (rule.type === 'email' && !isValidEmail(sanitizedValue)) {
      errors.push(`Invalid email format for ${field}`);
    }

    if (rule.type === 'mobile' && !isValidPhilippineMobile(sanitizedValue)) {
      errors.push(`Invalid Philippine mobile number for ${field}`);
    }

    if (rule.type === 'password') {
      const passwordValidation = validatePassword(sanitizedValue);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors.map(error => `${field}: ${error}`));
      }
    }

    if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
      errors.push(`${field} must not exceed ${rule.maxLength} characters`);
    }

    if (rule.minLength && sanitizedValue.length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters long`);
    }

    sanitizedData[field] = sanitizedValue;
  }

  return {
    isValid: errors.length === 0,
    sanitizedData,
    errors
  };
};

/**
 * Validate file upload
 * @param {FileList|File[]} files - Files to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateFileUpload = (files, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 5,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']
  } = options;

  const errors = [];

  if (files.length > maxFiles) {
    errors.push(`Maximum ${maxFiles} files allowed`);
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.size > maxSize) {
      errors.push(`File ${file.name} exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    if (!allowedTypes.includes(file.type)) {
      errors.push(`File ${file.name} has unsupported type. Allowed types: ${allowedTypes.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};