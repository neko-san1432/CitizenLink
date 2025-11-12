const ComplianceService = require('../services/ComplianceService');
const ErrorHandler = require('../middleware/errorHandler');

class ComplianceController {
  constructor() {
    this.complianceService = new ComplianceService();
  }

  /**
   * @route   GET /api/compliance/export
   * @desc    Export user data (GDPR Right to Data Portability)
   * @access  Private (user can only export their own data)
   */
  async exportUserData(req, res) {
    try {
      const userId = req.user.id;
      const requestedUserId = req.query.userId || userId;

      // Users can only export their own data unless they're admin
      const isAdmin = req.user.role === 'super-admin' || req.user.role === 'lgu-admin';
      if (requestedUserId !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'You can only export your own data'
        });
      }

      // Log export request
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');
      
      await this.complianceService.auditLog.log('data_export_requested', userId, {
        targetType: 'user',
        targetId: requestedUserId,
        details: { requestedBy: userId },
        ipAddress,
        userAgent
      });

      // Export data
      const exportData = await this.complianceService.exportUserData(requestedUserId);

      // Log successful export
      await this.complianceService.auditLog.log('data_export_completed', userId, {
        targetType: 'user',
        targetId: requestedUserId,
        details: { exportDate: exportData.exportDate },
        ipAddress,
        userAgent
      });

      // Return as JSON (can also be sent as downloadable file)
      res.json({
        success: true,
        data: exportData,
        message: 'User data exported successfully'
      });
    } catch (error) {
      console.error('[COMPLIANCE] Export error:', error);
      ErrorHandler.handleError(error, req, res);
    }
  }

  /**
   * @route   DELETE /api/compliance/delete
   * @desc    Delete user data (GDPR Right to Deletion/Erasure)
   * @access  Private (user can delete their own data, admin can delete any)
   */
  async deleteUserData(req, res) {
    try {
      const userId = req.user.id;
      const requestedUserId = req.body.userId || userId;
      const reason = req.body.reason || 'User requested data deletion';

      // Users can only delete their own data unless they're admin
      const isAdmin = req.user.role === 'super-admin';
      if (requestedUserId !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own data'
        });
      }

      // Additional confirmation required for self-deletion
      if (requestedUserId === userId && !req.body.confirm) {
        return res.status(400).json({
          success: false,
          error: 'Confirmation required. Set confirm: true in request body'
        });
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Delete user data
      const result = await this.complianceService.deleteUserData(
        requestedUserId,
        userId,
        { ipAddress, userAgent, reason }
      );

      // If user deleted themselves, logout
      if (requestedUserId === userId) {
        res.clearCookie('access_token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        });
      }

      res.json({
        success: true,
        message: 'User data deleted successfully',
        data: result
      });
    } catch (error) {
      console.error('[COMPLIANCE] Delete error:', error);
      ErrorHandler.handleError(error, req, res);
    }
  }

  /**
   * @route   GET /api/compliance/requests
   * @desc    Get user's data requests history
   * @access  Private
   */
  async getUserDataRequests(req, res) {
    try {
      const userId = req.user.id;
      const requests = await this.complianceService.getUserDataRequests(userId);

      res.json({
        success: true,
        data: requests
      });
    } catch (error) {
      console.error('[COMPLIANCE] Get requests error:', error);
      ErrorHandler.handleError(error, req, res);
    }
  }
}

module.exports = new ComplianceController();

