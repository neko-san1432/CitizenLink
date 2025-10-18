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
        '\'': '&#x27;',
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
  // No validation - accept any password
  return {
    isValid: true,
    errors: []
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
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === '') || value === null || value === undefined)) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip validation if field is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '') || value === null || value === undefined) {
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

/**
 * Validate a batch of new files against constraints and existing selection
 * Returns filtered valid files and a list of human-readable errors
 * @param {FileList|File[]} newFiles
 * @param {File[]} existingFiles
 * @param {Object} options
 * @param {number} options.maxFiles
 * @param {number} options.maxSize
 * @param {string[]} options.allowedTypes
 * @returns {{ validFiles: File[], errors: string[] }}
 */
export const validateFiles = (newFiles, existingFiles = [], options = {}) => {
  const maxSize = options.maxSize ?? 10 * 1024 * 1024;
  const maxFiles = options.maxFiles ?? 5;
  const allowedTypes = options.allowedTypes ?? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];

  const errors = [];
  const validFiles = [];

  if (!newFiles || newFiles.length === 0) {
    return { validFiles, errors };
  }

  // Build a set to detect duplicates (by name+size+type)
  const existingKey = (f) => `${f.name}:${f.size}:${f.type}`;
  const existingSet = new Set((existingFiles || []).map(existingKey));

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];

    // Enforce overall max files
    if (existingFiles.length + validFiles.length >= maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      break;
    }

    // Type check
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File ${file.name} has unsupported type`);
      continue;
    }

    // Size check
    if (file.size > maxSize) {
      const mb = Math.round(maxSize / 1024 / 1024);
      errors.push(`File ${file.name} exceeds maximum size of ${mb}MB`);
      continue;
    }

    // Duplicate check
    const key = existingKey(file);
    if (existingSet.has(key) || validFiles.some((f) => existingKey(f) === key)) {
      errors.push(`File ${file.name} is already selected`);
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
};

/**
 * Attach realtime validation to a form (HTML5 validity + custom rules)
 * @param {HTMLFormElement} form
 */
export const setupRealtimeValidation = (form) => {
  if (!form) return;

  const setError = (input, message) => {
    if (!input) return;
    input.setCustomValidity(message || '');
    // Do not spam reportValidity on each keystroke; only clear silently
    if (!message) return;
    try { input.reportValidity(); } catch {}
  };

  const rules = {
    '#complaintTitle': { required: true, minLength: 3 },
    '#description': { required: true, minLength: 10 },
    '#location': { required: true },
  };

  const validateTarget = (selector) => {
    const input = form.querySelector(selector);
    if (!input) return;
    const value = (input.value || '').trim();
    const rule = rules[selector] || {};

    if (rule.required && !value) {
      return setError(input, 'This field is required');
    }
    if (rule.minLength && value.length < rule.minLength) {
      return setError(input, `Must be at least ${rule.minLength} characters`);
    }
    setError(input, '');
  };

  // Wire inputs
  Object.keys(rules).forEach((selector) => {
    const input = form.querySelector(selector);
    if (!input) return;
    ['input', 'change', 'blur'].forEach((evt) => {
      input.addEventListener(evt, () => validateTarget(selector));
    });
  });

  // Initial pass
  Object.keys(rules).forEach(validateTarget);
};

/**
 * Extract complaint form data from DOM
 * @param {HTMLFormElement} formElement
 * @returns {Object}
 */
export const extractComplaintFormData = (formElement) => {
  if (!formElement) return {};

  const getVal = (selector) => {
    const el = formElement.querySelector(selector);
    return el ? el.value.trim() : '';
  };

  const parseNum = (selector) => {
    const v = getVal(selector);
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Collect selected departments (checkboxes inside #departmentCheckboxes)
  const departments = Array.from(
    formElement.querySelectorAll('#departmentCheckboxes input[type="checkbox"]:checked')
  ).map((cb) => cb.value);

  return {
    title: getVal('#complaintTitle'),
    type: getVal('#complaintType'),
    subtype: getVal('#complaintSubtype'),
    description: getVal('#description'),
    location_text: getVal('#location'),
    latitude: parseNum('#latitude'),
    longitude: parseNum('#longitude'),
    departments
  };
};

/**
 * Validate complaint form data
 * @param {Object} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateComplaintForm = (data) => {
  const errors = [];
  if (!data) {
    return { valid: false, errors: ['Invalid form data'] };
  }

  const title = sanitizeString(data.title || '');
  const description = sanitizeString(data.description || '');
  const locationText = sanitizeString(data.location_text || '');

  if (!title) errors.push('Title is required');
  if (title && title.length < 3) errors.push('Title must be at least 3 characters');

  if (!description) errors.push('Description is required');
  if (description && description.length < 10) errors.push('Description must be at least 10 characters');

  if (!locationText) errors.push('Location is required');

  // If one coordinate is provided, both should be valid numbers
  const hasLat = data.latitude !== null && data.latitude !== undefined;
  const hasLng = data.longitude !== null && data.longitude !== undefined;
  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    errors.push('Both latitude and longitude must be provided');
  }
  if (hasLat && hasLng) {
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      errors.push('Coordinates must be numeric');
    }
  }

  return { valid: errors.length === 0, errors };
};