const Database = require('../config/database');
const AuditLogRepository = require('../repositories/AuditLogRepository');

class ComplianceService {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
    this.auditLog = new AuditLogRepository();
  }

  /**
   * Export all user data for GDPR compliance (Right to Data Portability)
   * @param {string} userId - User ID to export data for
   * @returns {Promise<Object>} Complete user data export
   */
  async exportUserData(userId) {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        personalInformation: {},
        complaints: [],
        assignments: [],
        notifications: [],
        auditLogs: [],
        sessions: [],
        roleChanges: []
      };

      // Get user personal information
      const { data: authUser, error: userError } = await this.supabase.auth.admin.getUserById(userId);
      if (userError) throw userError;

      if (authUser && authUser.user) {
        const {user} = authUser;
        exportData.personalInformation = {
          id: user.id,
          email: user.email,
          emailConfirmed: Boolean(user.email_confirmed_at),
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          metadata: user.user_metadata,
          rawMetadata: user.raw_user_meta_data
        };
      }

      // Get user's complaints
      const { data: complaints, error: complaintsError } = await this.supabase
        .from('complaints')
        .select('*')
        .eq('submitted_by', userId);

      if (!complaintsError && complaints) {
        exportData.complaints = complaints;
      }

      // Get complaint assignments (where user is assigned)
      const { data: assignments, error: assignmentsError } = await this.supabase
        .from('complaint_assignments')
        .select('*')
        .eq('assigned_to', userId);

      if (!assignmentsError && assignments) {
        exportData.assignments = assignments;
      }

      // Get notifications
      const { data: notifications, error: notificationsError } = await this.supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', userId);

      if (!notificationsError && notifications) {
        exportData.notifications = notifications;
      }

      // Get audit logs for this user
      const auditLogs = await this.auditLog.getUserLogs(userId, { limit: 1000 });
      exportData.auditLogs = auditLogs;

      // Get user sessions
      const { data: sessions, error: sessionsError } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId);

      if (!sessionsError && sessions) {
        exportData.sessions = sessions;
      }

      // Get role changes
      const { data: roleChanges, error: roleChangesError } = await this.supabase
        .from('role_changes')
        .select('*')
        .eq('user_id', userId);

      if (!roleChangesError && roleChanges) {
        exportData.roleChanges = roleChanges;
      }

      return exportData;
    } catch (error) {
      console.error('[COMPLIANCE] Export user data error:', error);
      throw error;
    }
  }

  /**
   * Delete user data for GDPR compliance (Right to Deletion/Erasure)
   * @param {string} userId - User ID to delete
   * @param {string} performedBy - User ID performing the deletion (admin or self)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteUserData(userId, performedBy, options = {}) {
    const { ipAddress = null, userAgent = null, reason = null } = options;
    const deletionLog = {
      deletedAt: new Date().toISOString(),
      deletedBy: performedBy,
      reason: reason || 'GDPR Right to Deletion',
      deletedData: []
    };

    try {
      const safeDelete = async (table, column, label = `${table}.${column}`) => {
        try {
          const { error } = await this.supabase
            .from(table)
            .delete()
            .eq(column, userId);
          if (!error) {
            deletionLog.deletedData.push(`deleted_${label}`);
          }
        } catch (err) {
          console.warn(`[COMPLIANCE] Skipped delete for ${table}.${column}:`, err.message || err);
        }
      };

      const safeUpdateNull = async (table, column, label = `${table}.${column}`) => {
        try {
          const payload = {};
          payload[column] = null;
          const { error } = await this.supabase
            .from(table)
            .update(payload)
            .eq(column, userId);
          if (!error) {
            deletionLog.deletedData.push(`nulled_${label}`);
          }
        } catch (err) {
          console.warn(`[COMPLIANCE] Skipped nulling for ${table}.${column}:`, err.message || err);
        }
      };

      // Log deletion request
      await this.auditLog.log('data_deletion_requested', performedBy, {
        targetType: 'user',
        targetId: userId,
        details: { reason },
        ipAddress,
        userAgent
      });

      // Delete related data (respect FK order)
      await safeDelete('notification', 'user_id');
      await safeDelete('notification', 'owner');
      await safeDelete('user_sessions', 'user_id');

      await safeDelete('complaint_assignments', 'assigned_to', 'complaint_assignments.assigned_to');
      await safeDelete('complaint_assignments', 'assigned_by', 'complaint_assignments.assigned_by');

      await safeDelete('complaint_coordinators', 'user_id');
      await safeDelete('complaint_coordinators', 'created_by');

      await safeDelete('complaint_duplicates', 'merged_by');
      await safeDelete('complaint_evidence', 'uploaded_by');
      await safeDelete('complaint_history', 'performed_by');
      await safeDelete('complaint_reminders', 'reminded_by');
      await safeDelete('complaint_similarities', 'reviewed_by');
      await safeDelete('complaint_workflow_logs', 'action_by');

      await safeDelete('department_transfers', 'user_id');
      await safeDelete('department_transfers', 'performed_by');

      await safeDelete('events', 'created_by');
      await safeDelete('invitation_tokens', 'created_by');

      await safeDelete('news', 'author_id');
      await safeDelete('notices', 'created_by');

      await safeDelete('role_changes', 'user_id', 'role_changes.user_id');
      await safeDelete('role_changes', 'performed_by', 'role_changes.performed_by');

      await safeDelete('signup_links', 'created_by');

      await safeDelete('task_forces', 'coordinator_id', 'task_forces.coordinator_id');
      await safeDelete('task_forces', 'created_by', 'task_forces.created_by');
      await safeDelete('task_forces', 'ended_by', 'task_forces.ended_by');

      await safeDelete('user_role_history', 'user_id', 'user_role_history.user_id');
      await safeDelete('user_role_history', 'changed_by', 'user_role_history.changed_by');

      await safeDelete('audit_logs', 'performed_by');

      await safeDelete('complaints', 'submitted_by', 'complaints.submitted_by');
      await safeUpdateNull('complaints', 'cancelled_by', 'complaints.cancelled_by');
      await safeUpdateNull('complaints', 'resolved_by', 'complaints.resolved_by');
      await safeUpdateNull('complaints', 'assigned_coordinator_id', 'complaints.assigned_coordinator_id');
      await safeUpdateNull('complaints', 'master_complaint_id', 'complaints.master_complaint_id');
      await safeUpdateNull('complaints', 'task_force_id', 'complaints.task_force_id');

      // Optional profile-style cleanup (tables may or may not exist)
      await safeDelete('user_settings', 'user_id');
      await safeDelete('user_preferences', 'user_id');
      await safeDelete('user_devices', 'user_id');
      await safeDelete('profiles', 'id');

      // Finally, delete the user from auth.users (Supabase Admin API)
      let authUserExists = true;
      try {
        const { data: existingAuthUser, error: fetchAuthUserError } = await this.supabase.auth.admin.getUserById(userId);
        if (fetchAuthUserError) {
          if (fetchAuthUserError.status === 404) {
            authUserExists = false;
          } else {
            console.warn('[COMPLIANCE] Unable to verify auth user before deletion:', fetchAuthUserError.message || fetchAuthUserError);
          }
        } else if (!existingAuthUser?.user) {
          authUserExists = false;
        }
      } catch (lookupError) {
        console.warn('[COMPLIANCE] Auth user lookup failed prior to deletion:', lookupError.message || lookupError);
      }

      if (authUserExists) {
        const { error: deleteUserError } = await this.supabase.auth.admin.deleteUser(userId);
        if (deleteUserError) {
          const isAlreadyMissing = /not\s+found/i.test(deleteUserError.message || '');
          if (!isAlreadyMissing) {
            throw new Error(`Failed to delete user: ${deleteUserError.message}`);
          }
          authUserExists = false;
        } else {
          deletionLog.deletedData.push('auth_user');
        }
      }

      if (!authUserExists) {
        deletionLog.deletedData.push('auth_user_missing');
      }

      // Log successful deletion
      await this.auditLog.log('data_deletion_completed', performedBy, {
        targetType: 'user',
        targetId: userId,
        details: deletionLog,
        ipAddress,
        userAgent
      });

      return {
        success: true,
        message: 'User data deleted successfully',
        deletionLog
      };
    } catch (error) {
      console.error('[COMPLIANCE] Delete user data error:', error);

      // Log deletion failure
      await this.auditLog.log('data_deletion_failed', performedBy, {
        targetType: 'user',
        targetId: userId,
        details: { error: error.message },
        ipAddress,
        userAgent
      });

      throw error;
    }
  }

  /**
   * Check if user has pending data requests
   * @param {string} userId - User ID to check
   * @returns {Promise<Object>}
   */
  async getUserDataRequests(userId) {
    try {
      // Get recent data export/deletion requests from audit logs
      const exportRequests = await this.auditLog.list({
        performedBy: userId,
        actionType: 'data_export_requested',
        limit: 10
      });

      const deletionRequests = await this.auditLog.list({
        performedBy: userId,
        actionType: 'data_deletion_requested',
        limit: 10
      });

      return {
        exportRequests: exportRequests || [],
        deletionRequests: deletionRequests || []
      };
    } catch (error) {
      console.error('[COMPLIANCE] Get user data requests error:', error);
      throw error;
    }
  }
}

module.exports = ComplianceService;

