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
        userId: userId,
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
        const user = authUser.user;
        exportData.personalInformation = {
          id: user.id,
          email: user.email,
          emailConfirmed: user.email_confirmed_at ? true : false,
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
      // Log deletion request
      await this.auditLog.log('data_deletion_requested', performedBy, {
        targetType: 'user',
        targetId: userId,
        details: { reason },
        ipAddress,
        userAgent
      });

      // Delete from related tables (maintain referential integrity)
      // Note: Some data may need to be anonymized rather than deleted for legal/compliance reasons

      // Delete notifications
      const { error: notifError } = await this.supabase
        .from('app_notifications')
        .delete()
        .eq('user_id', userId);
      if (!notifError) deletionLog.deletedData.push('notifications');

      // Delete user sessions
      const { error: sessionsError } = await this.supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId);
      if (!sessionsError) deletionLog.deletedData.push('sessions');

      // Delete complaint assignments (where user is assigned)
      const { error: assignmentsError } = await this.supabase
        .from('complaint_assignments')
        .delete()
        .eq('assigned_to', userId);
      if (!assignmentsError) deletionLog.deletedData.push('complaint_assignments');

      // Anonymize complaints (keep for system integrity but remove personal data)
      const { data: userComplaints } = await this.supabase
        .from('complaints')
        .select('id')
        .eq('submitted_by', userId);

      if (userComplaints && userComplaints.length > 0) {
        // Anonymize complaints by setting submitted_by to null
        const { error: complaintsError } = await this.supabase
          .from('complaints')
          .update({ submitted_by: null })
          .eq('submitted_by', userId);
        if (!complaintsError) deletionLog.deletedData.push('complaints_anonymized');
      }

      // Delete role changes
      const { error: roleChangesError } = await this.supabase
        .from('role_changes')
        .delete()
        .eq('user_id', userId);
      if (!roleChangesError) deletionLog.deletedData.push('role_changes');

      // Delete coordinator assignments
      const { error: coordinatorError } = await this.supabase
        .from('complaint_coordinators')
        .delete()
        .eq('user_id', userId);
      if (!coordinatorError) deletionLog.deletedData.push('coordinator_assignments');

      // Delete audit logs (keep anonymized version for compliance)
      // Note: We keep audit logs but anonymize the user reference
      const { error: auditError } = await this.supabase
        .from('audit_logs')
        .update({ performed_by: null })
        .eq('performed_by', userId);
      if (!auditError) deletionLog.deletedData.push('audit_logs_anonymized');

      // Finally, delete the user from auth.users (Supabase Admin API)
      const { error: deleteUserError } = await this.supabase.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        throw new Error(`Failed to delete user: ${deleteUserError.message}`);
      }
      deletionLog.deletedData.push('auth_user');

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


