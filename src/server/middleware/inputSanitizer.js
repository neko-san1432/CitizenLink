const validator = require('validator');
const xss = require('xss');
const DOMPurify = require('isomorphic-dompurify');

// Input sanitization and validation middleware
class InputSanitizer {
  // Main sanitization middleware
  static sanitize(req, res, next) {
    try {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = InputSanitizer.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = InputSanitizer.sanitizeObject(req.query);
      }

      // Sanitize route parameters
      if (req.params && typeof req.params === 'object') {
        req.params = InputSanitizer.sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      console.error('Input sanitization error:', error);
      res.status(400).json({
        success: false,
        error: 'Invalid input data'
      });
    }
  }

  // Sanitize entire object recursively
  static sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => InputSanitizer.sanitizeObject(item));
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = InputSanitizer.sanitizeValue(value, key);
    }

    return sanitized;
  }

  // Sanitize individual values based on their expected type
  static sanitizeValue(value, fieldName = '') {
    if (value === null || value === undefined) {
      return value;
    }

    // Convert to string for processing
    const stringValue = String(value);

    // Skip sanitization for certain field types that shouldn't be modified
    const skipFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword'];
    if (skipFields.some(field => fieldName.toLowerCase().includes(field.toLowerCase()))) {
      return value; // Return original value for password fields
    }

    // Sanitize based on field name patterns
    if (fieldName.toLowerCase().includes('email')) {
      return validator.normalizeEmail(stringValue) || stringValue;
    }

    if (fieldName.toLowerCase().includes('phone') || fieldName.toLowerCase().includes('mobile')) {
      // Remove all non-digit characters for phone numbers
      return stringValue.replace(/\D/g, '');
    }

    if (fieldName.toLowerCase().includes('url') || fieldName.toLowerCase().includes('link')) {
      return validator.escape(stringValue);
    }

    if (fieldName.toLowerCase().includes('description') ||
        fieldName.toLowerCase().includes('comment') ||
        fieldName.toLowerCase().includes('message') ||
        fieldName.toLowerCase().includes('content')) {
      // For text content, use XSS sanitization
      return DOMPurify.sanitize(stringValue);
    }

    // Default sanitization for other fields
    return validator.escape(stringValue);
  }

  // Validation middleware for specific data types
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email is required' };
    }

    if (!validator.isEmail(email)) {
      return { valid: false, error: 'Invalid email format' };
    }

    if (email.length > 254) {
      return { valid: false, error: 'Email is too long' };
    }

    return { valid: true };
  }

  static validatePhone(phone) {
    if (!phone) {
      return { valid: false, error: 'Phone number is required' };
    }

    const digitsOnly = String(phone).replace(/\D/g, '');

    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return { valid: false, error: 'Phone number must be 10-15 digits' };
    }

    return { valid: true, sanitized: digitsOnly };
  }

  static validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
      return { valid: false, error: 'Password must not exceed 128 characters' };
    }

    return { valid: true };
  }

  static validateName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Name is required' };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }

    if (trimmed.length > 100) {
      return { valid: false, error: 'Name must not exceed 100 characters' };
    }

    // Check for potentially dangerous characters
    if (!/^[a-zA-Z\s\-'\.]+$/.test(trimmed)) {
      return { valid: false, error: 'Name contains invalid characters' };
    }

    return { valid: true, sanitized: trimmed };
  }

  static validateText(text, options = {}) {
    const { minLength = 0, maxLength = 10000, required = false } = options;

    if (required && (!text || typeof text !== 'string')) {
      return { valid: false, error: 'Text is required' };
    }

    if (text && typeof text === 'string') {
      const trimmed = text.trim();

      if (trimmed.length < minLength) {
        return { valid: false, error: `Text must be at least ${minLength} characters` };
      }

      if (trimmed.length > maxLength) {
        return { valid: false, error: `Text must not exceed ${maxLength} characters` };
      }

      return { valid: true, sanitized: trimmed };
    }

    return { valid: true, sanitized: text };
  }

  static validateNumber(number, options = {}) {
    const { min = -Infinity, max = Infinity, integer = false, required = false } = options;

    if (required && (number === null || number === undefined)) {
      return { valid: false, error: 'Number is required' };
    }

    if (number !== null && number !== undefined) {
      const num = Number(number);

      if (isNaN(num)) {
        return { valid: false, error: 'Invalid number format' };
      }

      if (integer && !Number.isInteger(num)) {
        return { valid: false, error: 'Number must be an integer' };
      }

      if (num < min) {
        return { valid: false, error: `Number must be at least ${min}` };
      }

      if (num > max) {
        return { valid: false, error: `Number must not exceed ${max}` };
      }

      return { valid: true, sanitized: num };
    }

    return { valid: true, sanitized: number };
  }

  static validateBoolean(bool, required = false) {
    if (required && bool === null || bool === undefined) {
      return { valid: false, error: 'Boolean value is required' };
    }

    if (bool !== null && bool !== undefined) {
      if (typeof bool === 'boolean') {
        return { valid: true, sanitized: bool };
      }

      if (typeof bool === 'string') {
        if (['true', '1', 'yes', 'on'].includes(bool.toLowerCase())) {
          return { valid: true, sanitized: true };
        }
        if (['false', '0', 'no', 'off'].includes(bool.toLowerCase())) {
          return { valid: true, sanitized: false };
        }
      }

      return { valid: false, error: 'Invalid boolean value' };
    }

    return { valid: true, sanitized: bool };
  }

  // Request size validation middleware
  static validateRequestSize(req, res, next) {
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
      return res.status(413).json({
        success: false,
        error: 'Request too large'
      });
    }

    next();
  }

  // SQL injection prevention
  static preventSQLInjection(req, res, next) {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /(\bor\b\s+\d+\s*=\s*\d+)/gi,
      /(\band\b\s+\d+\s*=\s*\d+)/gi,
      /('|(\\'')|;|\|)/g
    ];

    const checkForSQLInjection = (obj) => {
      if (typeof obj === 'string') {
        return sqlPatterns.some(pattern => pattern.test(obj));
      }

      if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).some(value => checkForSQLInjection(value));
      }

      return false;
    };

    if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query)) {
      return res.status(400).json({
        success: false,
        error: 'Potentially malicious input detected'
      });
    }

    next();
  }
}

module.exports = InputSanitizer;
