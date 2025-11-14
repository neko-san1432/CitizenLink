/**
 * Input Validation Utilities
 * Centralized validation functions for consistent input validation
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number format (Philippines format)
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') return false;
  // Remove spaces, dashes, and parentheses
  const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
  // Check for Philippines format: +63XXXXXXXXXX or 09XXXXXXXXX or 9XXXXXXXXX
  const phRegex = /^(\+63|0)?9\d{9}$/;
  return phRegex.test(cleaned);
}

/**
 * Validate postal code format (Philippines: 4 digits)
 * @param {string} postalCode - Postal code to validate
 * @returns {boolean} True if valid
 */
function isValidPostalCode(postalCode) {
  if (!postalCode || typeof postalCode !== 'string') return false;
  const postalCodeRegex = /^\d{4}$/;
  return postalCodeRegex.test(postalCode.trim());
}

/**
 * Validate required fields in request body
 * @param {Object} body - Request body object
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} { isValid: boolean, missingFields: Array<string> }
 */
function validateRequiredFields(body, requiredFields) {
  const missingFields = requiredFields.filter(field => {
    // Validate field is a safe property name
    if (typeof field !== 'string' || field === '__proto__' || field === 'constructor' || field === 'prototype') {
      return true; // Treat invalid field names as missing
    }
    const value = body[field];
    return value === void 0 || value === null || value === '';
  });

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Sanitize string input (trim whitespace)
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return input.trim();
}

/**
 * Validate and sanitize email
 * @param {string} email - Email to validate and sanitize
 * @returns {Object} { isValid: boolean, value: string, error: string|null }
 */
function validateEmail(email) {
  const sanitized = sanitizeString(email);

  if (!sanitized) {
    return {
      isValid: false,
      value: sanitized,
      error: 'Email is required'
    };
  }

  if (!isValidEmail(sanitized)) {
    return {
      isValid: false,
      value: sanitized,
      error: 'Invalid email format'
    };
  }

  return {
    isValid: true,
    value: sanitized.toLowerCase(),
    error: null
  };
}

/**
 * Validate password confirmation match
 * @param {string} password - Password
 * @param {string} confirmPassword - Confirmation password
 * @returns {Object} { isValid: boolean, error: string|null }
 */
function validatePasswordMatch(password, confirmPassword) {
  if (!password || !confirmPassword) {
    return {
      isValid: false,
      error: 'Both password fields are required'
    };
  }

  // Note: This comparison is safe from timing attacks because both values
  // are user-provided inputs, not server secrets. The actual password
  // verification against stored hashes happens elsewhere using secure methods.
  if (password !== confirmPassword) {
    return {
      isValid: false,
      error: 'Passwords do not match'
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Validate address fields
 * Note: City and province are no longer required since all users are from Digos City
 * @param {Object} address - Address object
 * @returns {Object} { isValid: boolean, error: string|null }
 */
function validateAddress(address) {
  if (!address || typeof address !== 'object') {
    return {
      isValid: true, // Address is optional
      error: null
    };
  }

  // Address validation removed - city and province are no longer required
  // Only barangay is needed for Digos City citizens
  return {
    isValid: true,
    error: null
  };
}

module.exports = {
  isValidEmail,
  isValidPhoneNumber,
  isValidPostalCode,
  validateRequiredFields,
  sanitizeString,
  validateEmail,
  validatePasswordMatch,
  validateAddress
};

