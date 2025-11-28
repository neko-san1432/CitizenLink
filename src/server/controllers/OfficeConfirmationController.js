const OfficeConfirmationService = require('../services/OfficeConfirmationService');

class OfficeConfirmationController {
  constructor() {
    this.confirmationService = new OfficeConfirmationService();
  }

  /**
   * GET /api/office-confirmation/pending
   * Get pending confirmations for the current officer
   */
  async getPending(req, res) {
    try {
      const { user } = req;
      const pending = await this.confirmationService.getPendingConfirmations(user.id);
      res.json({
        success: true,
        data: pending,
        count: pending.length
      });
    } catch (error) {
      console.error('[OFFICE_CONFIRMATION_CONTROLLER] Get pending error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending confirmations'
      });
    }
  }

  /**
   * POST /api/office-confirmation/:id/confirm
   * Confirm or decline a task force assignment
   */
  async confirm(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be "accepted" or "declined".'
        });
      }

      const result = await this.confirmationService.confirmAssignment(
        id,
        user.id,
        status,
        notes
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[OFFICE_CONFIRMATION_CONTROLLER] Confirm error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process confirmation'
      });
    }
  }

  /**
   * GET /api/office-confirmation/:id
   * Get details of a specific assignment
   */
  async getDetails(req, res) {
    try {
      const { id } = req.params;
      const details = await this.confirmationService.getTaskForceDetails(id);
      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      console.error('[OFFICE_CONFIRMATION_CONTROLLER] Get details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assignment details'
      });
    }
  }
}

module.exports = OfficeConfirmationController;
