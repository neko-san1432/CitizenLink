/**
 * Common error handling utilities
 * Consolidates duplicate error handling patterns across the application
 */

class ErrorHandler {
  /**
   * Handle service errors with consistent logging and response format
   */
  static handleServiceError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorMessage = error.message || 'Unknown error';

    // Log error with context
    console.error(`[${context}] ${timestamp} Error:`, errorMessage);

    // Return standardized error response
    return {
      success: false,
      error: errorMessage,
      timestamp
    };
  }

  /**
   * Handle API errors with consistent HTTP status codes
   */
  static handleApiError(error, res, context = '') {
    const timestamp = new Date().toISOString();
    const errorMessage = error.message || 'Unknown error';

    // Log error with context
    console.error(`[${context}] ${timestamp} API Error:`, errorMessage);

    // Determine appropriate status code
    let statusCode = 500;
    if (error.message.includes('Validation failed')) {
      statusCode = 400;
    } else if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('Access denied')) {
      statusCode = 403;
    } else if (error.message.includes('Unauthorized')) {
      statusCode = 401;
    }

    // Return standardized error response
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      timestamp
    });
  }

  /**
   * Handle notification errors (non-critical)
   */
  static handleNotificationError(error, context = '') {
    const timestamp = new Date().toISOString();
    console.warn(`[${context}] ${timestamp} Notification error (non-critical):`, error.message);

    // Return success to not break main flow
    return {
      success: true,
      warning: 'Notification failed but operation succeeded'
    };
  }

  /**
   * Handle database errors with consistent logging
   */
  static handleDatabaseError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorMessage = error.message || 'Database error';

    console.error(`[${context}] ${timestamp} Database error:`, errorMessage);

    return {
      success: false,
      error: 'Database operation failed',
      timestamp
    };
  }

  /**
   * Handle validation errors with detailed feedback
   */
  static handleValidationError(validationResult, context = '') {
    const timestamp = new Date().toISOString();

    if (validationResult.errors && validationResult.errors.length > 0) {
      console.warn(`[${context}] ${timestamp} Validation failed:`, validationResult.errors);

      return {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors,
        timestamp
      };
    }

    return { success: true };
  }
}

module.exports = ErrorHandler;
