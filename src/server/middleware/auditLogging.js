const AuditLogRepository = require("../repositories/AuditLogRepository");

const auditLog = new AuditLogRepository();

/**
 * Middleware to log sensitive operations for GDPR compliance
 * @param {string} actionType - Type of action to log
 * @param {Function} getTargetInfo - Optional function to extract target info from request
 */
function auditMiddleware(actionType, getTargetInfo = null) {
  return async (req, res, next) => {
    // Don't log if no user is authenticated
    if (!req.user || !req.user.id) {
      return next();
    }

    // Extract target information if provided
    let targetType = null;
    let targetId = null;
    if (getTargetInfo) {
      const target = getTargetInfo(req);
      if (target) {
        targetType = target.type;
        targetId = target.id;
      }
    } else {
      // Default: try to extract from params
      if (req.params.id) {
        targetId = req.params.id;
        // Try to infer target type from route
        if (req.path.includes("/complaints")) targetType = "complaint";
        else if (req.path.includes("/users")) targetType = "user";
        else if (req.path.includes("/departments")) targetType = "department";
      }
    }

    // Extract request details
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const userAgent = req.get("user-agent") || null;
    const details = {
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    };

    // Log the action (non-blocking)
    auditLog.log(actionType, req.user.id, {
      targetType,
      targetId,
      details,
      ipAddress,
      userAgent
    }).catch(error => {
      // Log error but don't break the request
      console.error("[AUDIT_MIDDLEWARE] Failed to log action:", error);
    });

    next();
  };
}

/**
 * Specific audit middleware for data access (GDPR compliance)
 */
function auditDataAccess(req, res, next) {
  return auditMiddleware("data_access", (req) => {
    // Extract target from request
    if (req.params.id) {
      return {
        id: req.params.id,
        type: req.path.includes("/complaints") ? "complaint" :
          req.path.includes("/users") ? "user" :
            req.path.includes("/departments") ? "department" : null
      };
    }
    return null;
  })(req, res, next);
}

/**
 * Specific audit middleware for data modification
 */
function auditDataModification(req, res, next) {
  return auditMiddleware("data_modification", (req) => {
    if (req.params.id) {
      return {
        id: req.params.id,
        type: req.path.includes("/complaints") ? "complaint" :
          req.path.includes("/users") ? "user" :
            req.path.includes("/departments") ? "department" : null
      };
    }
    return null;
  })(req, res, next);
}

/**
 * Specific audit middleware for data deletion
 */
function auditDataDeletion(req, res, next) {
  return auditMiddleware("data_deletion", (req) => {
    if (req.params.id) {
      return {
        id: req.params.id,
        type: req.path.includes("/complaints") ? "complaint" :
          req.path.includes("/users") ? "user" :
            req.path.includes("/departments") ? "department" : null
      };
    }
    return null;
  })(req, res, next);
}

/**
 * Audit middleware for authentication events
 */
function auditAuthEvent(eventType) {
  return async (req, res, next) => {
    const userId = req.user?.id || null;
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const userAgent = req.get("user-agent") || null;

    auditLog.log(eventType, userId, {
      targetType: "user",
      targetId: userId,
      details: {
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
      },
      ipAddress,
      userAgent
    }).catch(error => {
      console.error("[AUDIT_MIDDLEWARE] Failed to log auth event:", error);
    });

    next();
  };
}

module.exports = {
  auditMiddleware,
  auditDataAccess,
  auditDataModification,
  auditDataDeletion,
  auditAuthEvent
};

