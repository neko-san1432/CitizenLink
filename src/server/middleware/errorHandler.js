const config = require('../../../config/app');
const path = require('path');

class ErrorHandler {
  static handle(err, req, res, next) {
    console.error('Application error:', {
      message: err.message,
      stack: config.isDevelopment ? err.stack : 'Stack trace hidden in production',
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // API error response
    if (req.path.startsWith('/api/')) {
      return this.handleApiError(err, req, res);
    }

    // Page error response
    return ErrorHandler.handlePageError(err, req, res);
  }

  static handleApiError(err, req, res) {
    // Sanitize error message to prevent information leakage
    const sanitizedMessage = this.sanitizeErrorMessage(err.message);

    const errorResponse = {
      success: false,
      error: config.isProduction ? this.getGenericErrorMessage(err) : sanitizedMessage,
      timestamp: new Date().toISOString(),
      code: this.getErrorCode(err)
    };

    // Add request context in development only
    if (config.isDevelopment) {
      errorResponse.path = req.path;
      errorResponse.method = req.method;
      errorResponse.debug = {
        originalMessage: err.message,
        stack: err.stack?.split('\n').slice(0, 5) // Limit stack trace
      };
    }

    const statusCode = this.getStatusCode(err);
    res.status(statusCode).json(errorResponse);
  }

  static handlePageError(err, req, res) {
    const statusCode = this.getStatusCode(err);

    if (statusCode === 404) {
      return res.status(404).sendFile(path.join(__dirname, '../views/pages/404.html'));
    }

    // For other errors, send a generic error page or redirect
    return res.status(500).sendFile(path.join(__dirname, '../views/pages/500.html'));
  }

  static sanitizeErrorMessage(message) {
    if (!message || typeof message !== 'string') {
      return 'An error occurred';
    }

    // Remove potential sensitive information patterns
    let sanitized = message;

    // Remove file paths
    sanitized = sanitized.replace(/\/[^\s]+/g, '[PATH]');

    // Remove database connection strings or URLs with credentials
    sanitized = sanitized.replace(/([a-zA-Z]+:\/\/)[^@\s]+@[^\/\s]+/g, '$1[REDACTED]@[REDACTED]');

    // Remove potential API keys or tokens
    sanitized = sanitized.replace(/\b[A-Za-z0-9_\-]{20,}\b/g, '[TOKEN]');

    // Remove email addresses if they appear in error messages
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

    // Remove IP addresses
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');

    return sanitized;
  }

  static getGenericErrorMessage(err) {
    const statusCode = this.getStatusCode(err);

    switch (statusCode) {
    case 400:
      return 'Invalid request data';
    case 401:
      return 'Authentication required';
    case 403:
      return 'Access forbidden';
    case 404:
      return 'Resource not found';
    case 409:
      return 'Resource conflict';
    case 413:
      return 'Request too large';
    case 429:
      return 'Too many requests';
    default:
      return 'Internal server error';
    }
  }

  static getErrorCode(err) {
    // Generate a unique error code for tracking without exposing internal details
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ERR_${timestamp}_${random}`;
  }

  static getStatusCode(err) {
    // Custom error with status
    if (err.statusCode) return err.statusCode;
    if (err.status) return err.status;

    // Common error types
    if (err.name === 'ValidationError') return 400;
    if (err.name === 'UnauthorizedError') return 401;
    if (err.name === 'ForbiddenError') return 403;
    if (err.name === 'NotFoundError') return 404;
    if (err.name === 'ConflictError') return 409;

    // Database errors
    if (err.code === '23505') return 409; // Unique constraint violation
    if (err.code === '23503') return 400; // Foreign key constraint violation
    if (err.code === '23502') return 400; // Not null constraint violation

    // Default to 500
    return 500;
  }

  static notFound(req, res, next) {
    const error = new Error(`Route not found: ${req.method} ${req.path}`);
    error.statusCode = 404;
    next(error);
  }

  static asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// Custom error classes
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

module.exports = {
  ErrorHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError
};
