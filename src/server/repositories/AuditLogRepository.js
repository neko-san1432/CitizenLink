const Database = require("../config/database");

class AuditLogRepository {

  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
    this.table = "audit_logs";
  }

  /**
   * Log an audit event
   * @param {string} actionType - Type of action (e.g., 'user_login', 'data_access', 'data_deletion')
   * @param {string} performedBy - UUID of user performing the action
   * @param {Object} options - Additional options
   * @param {string} options.targetType - Type of target (e.g., 'user', 'complaint', 'department')
   * @param {string} options.targetId - UUID of target entity
   * @param {Object} options.details - Additional details as JSONB
   * @param {string} options.ipAddress - IP address of requester
   * @param {string} options.userAgent - User agent string
   * @returns {Promise<boolean>}
   */
  async log(actionType, performedBy, options = {}) {
    try {
      // Skip logging if performedBy is not provided
      if (!performedBy) {
        return false;
      }

      // Check if the user exists before logging (to avoid foreign key constraint errors)
      // This can happen when users are deleted but audit logs are still being created
      try {
        const { data: user, error: userError } = await this.supabase.auth.admin.getUserById(performedBy);
        if (userError || !user?.user) {
          // User doesn't exist (likely deleted), skip audit log
          console.warn(`[AUDIT_LOG] Skipping audit log for deleted user: ${performedBy} (action: ${actionType})`);
          return false;
        }
      } catch (checkError) {
        // If we can't check the user, log a warning but don't fail
        console.warn(`[AUDIT_LOG] Could not verify user existence for ${performedBy}:`, checkError.message);
        // Continue with logging attempt - if it fails due to FK constraint, we'll catch it below
      }

      const {
        targetType = null,
        targetId = null,
        details = {},
        ipAddress = null,
        userAgent = null
      } = options;

      const { error } = await this.supabase
        .from(this.table)
        .insert({
          action_type: actionType,
          performed_by: performedBy,
          target_type: targetType,
          target_id: targetId,
          details,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: new Date().toISOString()
        });

      if (error) {
        // Check if it's a foreign key constraint error
        if (error.code === "23503" && error.message.includes("performed_by")) {
          // User was deleted between check and insert, skip silently
          console.warn(`[AUDIT_LOG] Skipping audit log - user ${performedBy} was deleted (action: ${actionType})`);
          return false;
        }
        console.error("[AUDIT_LOG] Failed to log action:", error);
        // Don't throw - audit logging failure shouldn't break operations
        return false;
      }
      return true;
    } catch (error) {
      // Handle foreign key constraint errors gracefully
      if (error.code === "23503" && error.message && error.message.includes("performed_by")) {
        console.warn(`[AUDIT_LOG] Skipping audit log - user was deleted (action: ${actionType})`);
        return false;
      }
      console.error("[AUDIT_LOG] Log error:", error);
      return false;
    }
  }

  /**
   * List audit logs with filtering
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of records to return
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.actionType - Filter by action type
   * @param {string} options.performedBy - Filter by performer
   * @param {string} options.targetType - Filter by target type
   * @param {string} options.targetId - Filter by target ID
   * @param {Date} options.startDate - Start date filter
   * @param {Date} options.endDate - End date filter
   * @returns {Promise<Array>}
   */
  async list(options = {}) {
    const {
      limit = 50,
      offset = 0,
      actionType = null,
      performedBy = null,
      targetType = null,
      targetId = null,
      startDate = null,
      endDate = null
    } = options;

    let query = this.supabase
      .from(this.table)
      .select("*")
      .order("created_at", { ascending: false });

    if (actionType) query = query.eq("action_type", actionType);
    if (performedBy) query = query.eq("performed_by", performedBy);
    if (targetType) query = query.eq("target_type", targetType);
    if (targetId) query = query.eq("target_id", targetId);
    if (startDate) query = query.gte("created_at", startDate.toISOString());
    if (endDate) query = query.lte("created_at", endDate.toISOString());

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  /**
   * Get audit logs for a specific user (for GDPR compliance)
   * @param {string} userId - User ID to get logs for
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getUserLogs(userId, options = {}) {
    return this.list({
      ...options,
      performedBy: userId
    });
  }

  /**
   * Get audit logs for actions performed on a specific target
   * @param {string} targetType - Type of target
   * @param {string} targetId - ID of target
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getTargetLogs(targetType, targetId, options = {}) {
    return this.list({
      ...options,
      targetType,
      targetId
    });
  }
}

module.exports = AuditLogRepository;
