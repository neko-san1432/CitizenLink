const validator = require('validator');
const _xss = require('xss');
const DOMPurify = require('isomorphic-dompurify');

// Enhanced input sanitization and validation middleware
class InputSanitizer {
  // Main sanitization middleware
  static sanitize(req, res, next) {
    try {
      // Log sanitization attempt for security monitoring
      // console.log removed for security

      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = InputSanitizer.sanitizeObject(req.body, 'body');
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = InputSanitizer.sanitizeObject(req.query, 'query');
      }

      // Sanitize route parameters
      if (req.params && typeof req.params === 'object') {
        req.params = InputSanitizer.sanitizeObject(req.params, 'params');
      }

      // Sanitize headers that might contain user input
      if (req.headers) {
        InputSanitizer.sanitizeHeaders(req.headers);
      }

      next();
    } catch (error) {
      console.error('[SANITIZER] Input sanitization error:', error);
      res.status(400).json({
        success: false,
        error: 'Invalid input data',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Sanitize entire object recursively
  static sanitizeObject(obj, context = '') {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => InputSanitizer.sanitizeObject(item, `${context}[${index}]`));
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      const safeKey = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const sanitizedKey = InputSanitizer.sanitizeValue(safeKey, `key_${safeKey}`);
      const fieldPath = context ? `${context}.${safeKey}` : safeKey;
      sanitized[sanitizedKey] = InputSanitizer.sanitizeValue(value, fieldPath);
    }

    return sanitized;
  }

  // Sanitize HTTP headers
  static sanitizeHeaders(headers) {
    const sensitiveHeaders = ['user-agent', 'referer', 'origin', 'x-forwarded-for'];

    for (const [key, value] of Object.entries(headers)) {
      const safeKey = String(key || '').toLowerCase();
      if (sensitiveHeaders.includes(safeKey) && typeof value === 'string') {
        // Sanitize sensitive headers but preserve functionality
        headers[key] = InputSanitizer.sanitizeValue(value, `header_${safeKey}`);
      }
    }
  }

  // Sanitize individual values based on their expected type
  static sanitizeValue(value, fieldName = '') {
    if (value === null || value === undefined) {
      return value;
    }

    // Convert to string for processing
    const stringValue = String(value);

    // Check for potential security threats first
    if (InputSanitizer.detectThreats(stringValue, fieldName)) {
      console.warn(`[SANITIZER] Potential threat detected in field: ${fieldName}, value: ${stringValue.substring(0, 50)}...`);
      return ''; // Return empty string for detected threats
    }

    // Skip sanitization for certain field types that shouldn't be modified
    const skipFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword', 'token', 'secret'];
    if (skipFields.some(field => fieldName.toLowerCase().includes(field.toLowerCase()))) {
      return value; // Return original value for sensitive fields
    }

    // Sanitize based on field name patterns
    if (fieldName.toLowerCase().includes('email')) {
      const normalized = validator.normalizeEmail(stringValue);
      return normalized && validator.isEmail(normalized) ? normalized : '';
    }

    if (fieldName.toLowerCase().includes('phone') || fieldName.toLowerCase().includes('mobile')) {
      // Remove all non-digit characters for phone numbers and validate length
      const cleaned = stringValue.replace(/\D/g, '');
      return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : '';
    }

    if (fieldName.toLowerCase().includes('url') || fieldName.toLowerCase().includes('link')) {
      return InputSanitizer.validateAndSanitizeURL(stringValue);
    }

    if (fieldName.toLowerCase().includes('name') || fieldName.toLowerCase().includes('title')) {
      // Allow only alphanumeric, spaces, hyphens, and apostrophes for names
      return stringValue.replace(/[^a-zA-Z0-9\s\-']/g, '').trim();
    }

    if (fieldName.toLowerCase().includes('description') ||
        fieldName.toLowerCase().includes('comment') ||
        fieldName.toLowerCase().includes('message') ||
        fieldName.toLowerCase().includes('content')) {
      // For text content, use XSS sanitization and limit length
      const sanitized = DOMPurify.sanitize(stringValue);
      return sanitized.length > 5000 ? sanitized.substring(0, 5000) : sanitized;
    }

    if (fieldName.toLowerCase().includes('id') || fieldName.toLowerCase().includes('uuid')) {
      // For ID fields, only allow alphanumeric and hyphens
      return stringValue.replace(/[^a-zA-Z0-9-]/g, '');
    }

    // Default sanitization for other fields
    return validator.escape(stringValue);
  }

  // Detect potential security threats
  static detectThreats(value, _fieldName) {
    const threats = [
      // Script injection patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,

      // SQL injection patterns
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /(\bor\b\s+\d+\s*=\s*\d+)/gi,
      /(\band\b\s+\d+\s*=\s*\d+)/gi,

      // Command injection patterns
      /[;&|`$()]/g,
      /\.\.\//g,
      /\.\.\\/g,

      // XSS patterns
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<link[^>]*>.*?<\/link>/gi,
      /<meta[^>]*>.*?<\/meta>/gi,

      // Path traversal
      /\.\.\//g,
      /\.\.\\/g,

      // LDAP injection
      /[()=*!&|]/g,

      // NoSQL injection
      /\$where/gi,
      /\$ne/gi,
      /\$gt/gi,
      /\$lt/gi,
      /\$regex/gi
    ];

    return threats.some(pattern => pattern.test(value));
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
    if (!/^[a-zA-Z\s-'.]+$/.test(trimmed)) {
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

  // Enhanced SQL injection prevention
  static preventSQLInjection(req, res, next) {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /(\bor\b\s+\d+\s*=\s*\d+)/gi,
      /(\band\b\s+\d+\s*=\s*\d+)/gi,
      /('|(\\'')|;|\|)/g,
      /(\b(load_file|into\s+outfile|into\s+dumpfile)\b)/gi,
      /(\b(concat|group_concat|char|ascii|ord|hex|unhex)\b)/gi,
      /(\b(benchmark|sleep|waitfor\s+delay)\b)/gi
    ];

    const checkForSQLInjection = (obj, path = '') => {
      if (typeof obj === 'string') {
        const hasThreat = sqlPatterns.some(pattern => pattern.test(obj));
        if (hasThreat) {
          console.warn(`[SECURITY] SQL injection attempt detected in ${path}: ${obj.substring(0, 100)}...`);
        }
        return hasThreat;
      }

      if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj).some(([key, value]) =>
          checkForSQLInjection(value, path ? `${path}.${key}` : key)
        );
      }

      return false;
    };

    if (checkForSQLInjection(req.body, 'body') ||
        checkForSQLInjection(req.query, 'query') ||
        checkForSQLInjection(req.params, 'params')) {
      return res.status(400).json({
        success: false,
        error: 'Potentially malicious input detected',
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
    }

    next();
  }

  // XSS prevention middleware
  static preventXSS(req, res, next) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /onfocus\s*=/gi,
      /onblur\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi
    ];

    const checkForXSS = (obj, path = '') => {
      if (typeof obj === 'string') {
        const hasThreat = xssPatterns.some(pattern => pattern.test(obj));
        if (hasThreat) {
          console.warn(`[SECURITY] XSS attempt detected in ${path}: ${obj.substring(0, 100)}...`);
        }
        return hasThreat;
      }

      if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj).some(([key, value]) =>
          checkForXSS(value, path ? `${path}.${key}` : key)
        );
      }

      return false;
    };

    if (checkForXSS(req.body, 'body') ||
        checkForXSS(req.query, 'query') ||
        checkForXSS(req.params, 'params')) {
      return res.status(400).json({
        success: false,
        error: 'Potentially malicious input detected',
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
    }

    next();
  }

  // Rate limiting for specific endpoints
  static createEndpointRateLimit(windowMs, maxRequests, message = 'Too many requests') {
    const requests = new Map();

    return (req, res, next) => {
      const key = `${req.ip}-${req.path}`;
      const now = Date.now();
      const _windowStart = now - windowMs;

      // Clean up old entries
      for (const [k, v] of requests.entries()) {
        if (v.resetTime < now) {
          requests.delete(k);
        }
      }

      const userRequests = requests.get(key) || { count: 0, resetTime: now + windowMs };

      if (userRequests.resetTime < now) {
        userRequests.count = 0;
        userRequests.resetTime = now + windowMs;
      }

      if (userRequests.count >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
        });
      }

      userRequests.count++;
      requests.set(key, userRequests);

      next();
    };
  }

  // Security audit logging
  static logSecurityEvent(event, details, req) {
    const _logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      ip: req?.ip,
      userAgent: req?.get('User-Agent'),
      path: req?.path,
      method: req?.method
    };

    // console.log removed for security
  }
}

module.exports = InputSanitizer;

