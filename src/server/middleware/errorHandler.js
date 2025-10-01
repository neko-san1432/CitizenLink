const config = require('../../../config/app');
const path = require('path');

class ErrorHandler {
  static handle(err, req, res, next) {
    console.error('Application error:', err);
    
    // API error response
    if (req.path.startsWith('/api/')) {
      return this.handleApiError(err, req, res);
    }
    
    // Page error response
    return this.handlePageError(err, req, res);
  }

  static handleApiError(err, req, res) {
    const errorResponse = {
      success: false,
      error: config.isProduction ? 'Internal server error' : err.message,
      timestamp: new Date().toISOString()
    };

    // Add request context in development
    if (config.isDevelopment) {
      errorResponse.path = req.path;
      errorResponse.method = req.method;
      errorResponse.stack = err.stack;
    }

    const statusCode = this.getStatusCode(err);
    res.status(statusCode).json(errorResponse);
  }

  static handlePageError(err, req, res) {
    const statusCode = this.getStatusCode(err);
    
    if (statusCode === 404) {
      return res.status(404).sendFile(path.join(config.rootDir, 'views', 'pages', '404.html'));
    }

    // For other errors, send a generic error page or redirect
    return res.status(500).sendFile(path.join(config.rootDir, 'views', 'pages', '500.html'));
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
