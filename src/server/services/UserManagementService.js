const Database = require('../config/database');
const { USER_ROLES, ROLE_HIERARCHY, SWITCHABLE_ROLES } = require('../../shared/constants');

/**
 * UserManagementService
 * Handles user management operations including banning/unbanning
 */
class UserManagementService {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
  }

  /**
   * Ban a user (temporary or permanent)
   * @param {string} userId - User ID to ban
   * @param {string} performedBy - ID of user making the change
   * @param {object} banData - { type: 'temporary'|'permanent', duration?: number, reason?: string }
   */
  async banUser(userId, performedBy, banData = {}) {
    try {
      const { type = 'temporary', duration, reason } = banData;

      // Get current user data
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      if (!currentUser || !currentUser.user) {
        throw new Error('User not found');
      }

      const { user } = currentUser;
      const rawMetadata = user.raw_user_meta_data || {};
      const userMetadata = user.user_metadata || {};
      const currentMetadata = { ...userMetadata, ...rawMetadata };

      // Calculate ban expiration
      let banExpiresAt = null;
      if (type === 'temporary' && duration) {
        // duration is in hours
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + duration);
        banExpiresAt = expirationDate.toISOString();
      } else if (type === 'permanent') {
        // Permanent ban - set expiration to far future (year 2099)
        banExpiresAt = new Date('2099-12-31T23:59:59Z').toISOString();
      }

      // Update metadata
      const updatedMetadata = {
        ...currentMetadata,
        isBanned: true,
        banType: type,
        banExpiresAt,
        bannedAt: new Date().toISOString(),
        bannedBy: performedBy,
        banReason: reason || null,
        // Increment warning strike
        warningStrike: (currentMetadata.warningStrike || 0) + 1
      };

      // Update user metadata
      const { data: updatedUser, error: updateError } = await this.supabase.auth.admin.updateUserById(
        userId,
        {
          raw_user_meta_data: updatedMetadata,
          user_metadata: updatedMetadata
        }
      );

      if (updateError) {
        console.error('[USER_MGMT] Ban user error:', updateError);
        throw updateError;
      }

      // Log the ban action
      await this.logBanAction(userId, 'ban', performedBy, banData);

      return {
        success: true,
        user: updatedUser.user,
        banType: type,
        banExpiresAt
      };
    } catch (error) {
      console.error('[USER_MGMT] Ban user error:', error);
      throw error;
    }
  }

  /**
   * Unban a user (only Super Admin)
   * @param {string} userId - User ID to unban
   * @param {string} performedBy - ID of user making the change (must be Super Admin)
   */
  async unbanUser(userId, performedBy) {
    try {
      // Verify performer is Super Admin
      const { data: performerUser, error: performerError } = await this.supabase.auth.admin.getUserById(performedBy);
      if (performerError) throw performerError;

      const performerRole = performerUser.user.raw_user_meta_data?.role ||
                           performerUser.user.user_metadata?.role || 'citizen';

      if (performerRole !== 'super-admin') {
        throw new Error('Only Super Admin can unban users');
      }

      // Get current user data
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      if (!currentUser || !currentUser.user) {
        throw new Error('User not found');
      }

      const { user } = currentUser;
      const rawMetadata = user.raw_user_meta_data || {};
      const userMetadata = user.user_metadata || {};
      const currentMetadata = { ...userMetadata, ...rawMetadata };

      // Remove ban fields
      const updatedMetadata = {
        ...currentMetadata,
        isBanned: false,
        banType: null,
        banExpiresAt: null,
        unbannedAt: new Date().toISOString(),
        unbannedBy: performedBy
      };

      // Remove ban-related fields
      delete updatedMetadata.bannedAt;
      delete updatedMetadata.bannedBy;
      delete updatedMetadata.banReason;

      // Update user metadata
      const { data: updatedUser, error: updateError } = await this.supabase.auth.admin.updateUserById(
        userId,
        {
          raw_user_meta_data: updatedMetadata,
          user_metadata: updatedMetadata
        }
      );

      if (updateError) {
        console.error('[USER_MGMT] Unban user error:', updateError);
        throw updateError;
      }

      // Log the unban action
      await this.logBanAction(userId, 'unban', performedBy, {});

      return {
        success: true,
        user: updatedUser.user
      };
    } catch (error) {
      console.error('[USER_MGMT] Unban user error:', error);
      throw error;
    }
  }

  /**
   * Check if user is banned and if ban has expired
   * @param {string} userId - User ID to check
   */
  async checkBanStatus(userId) {
    try {
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      if (!currentUser || !currentUser.user) {
        throw new Error('User not found');
      }

      const { user } = currentUser;
      const rawMetadata = user.raw_user_meta_data || {};
      const userMetadata = user.user_metadata || {};
      const combinedMetadata = { ...userMetadata, ...rawMetadata };

      const isBanned = combinedMetadata.isBanned === true;
      const {banExpiresAt} = combinedMetadata;

      // Check if ban has expired
      if (isBanned && banExpiresAt) {
        const expirationDate = new Date(banExpiresAt);
        const now = new Date();

        if (now > expirationDate) {
          // Ban has expired, automatically unban
          // We need to update the metadata directly since we can't use unbanUser with 'system'
          const updatedMetadata = {
            ...combinedMetadata,
            isBanned: false,
            banType: null,
            banExpiresAt: null,
            unbannedAt: new Date().toISOString(),
            unbannedBy: 'system'
          };

          delete updatedMetadata.bannedAt;
          delete updatedMetadata.bannedBy;
          delete updatedMetadata.banReason;

          // Update user metadata
          await this.supabase.auth.admin.updateUserById(userId, {
            raw_user_meta_data: updatedMetadata,
            user_metadata: updatedMetadata
          });

          return {
            isBanned: false,
            expired: true
          };
        }
      }

      return {
        isBanned,
        banType: combinedMetadata.banType || null,
        banExpiresAt,
        banReason: combinedMetadata.banReason || null,
        warningStrike: combinedMetadata.warningStrike || 0
      };
    } catch (error) {
      console.error('[USER_MGMT] Check ban status error:', error);
      throw error;
    }
  }

  /**
   * Log ban/unban actions for audit trail
   */
  async logBanAction(userId, action, performedBy, banData, ipAddress = null, userAgent = null) {
    try {
      const AuditLogRepository = require('../repositories/AuditLogRepository');
      const auditLog = new AuditLogRepository();

      await auditLog.log(`user_${action}`, performedBy, {
        targetType: 'user',
        targetId: userId,
        details: {
          ...banData,
          timestamp: new Date().toISOString()
        },
        ipAddress,
        userAgent
      });
    } catch (error) {
      console.warn('[USER_MGMT] Log ban action error:', error);
      // Don't throw - logging failure shouldn't break the operation
    }
  }

  /**
   * Get user's warning strike count
   */
  async getWarningStrike(userId) {
    try {
      const { data: currentUser, error: getUserError } = await this.supabase.auth.admin.getUserById(userId);
      if (getUserError) throw getUserError;
      if (!currentUser || !currentUser.user) {
        throw new Error('User not found');
      }

      const { user } = currentUser;
      const rawMetadata = user.raw_user_meta_data || {};
      const userMetadata = user.user_metadata || {};
      const combinedMetadata = { ...userMetadata, ...rawMetadata };

      return combinedMetadata.warningStrike || 0;
    } catch (error) {
      console.error('[USER_MGMT] Get warning strike error:', error);
      throw error;
    }
  }
}

module.exports = UserManagementService;

