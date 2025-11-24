const Database = require('../config/database');

/**
 * Service for managing ID verification records
 * Handles storage, validation, and status management of user ID verifications
 */
class IDVerificationService {
  /**
   * Store ID verification data after OCR processing
   * @param {string} userId - User ID from auth.users
   * @param {object} ocrData - OCR extraction results
   * @param {string} ocrData.idType - Type of ID (PhilID, Driver's License, etc.)
   * @param {object} ocrData.fields - Extracted fields (name, address, etc.)
   * @param {string} ocrData.fields.idNumber - ID number
   * @param {number} ocrData.confidence - OCR confidence score (0-100)
   * @returns {Promise<object>} Created verification record
   */
  async storeVerification(userId, ocrData) {
    try {
      const supabase = Database.getClient();

      // Validate required fields
      if (!userId || !ocrData || !ocrData.fields || !ocrData.fields.idNumber) {
        throw new Error('Missing required fields: userId, idNumber');
      }

      const { idType, fields, confidence } = ocrData;
      const idNumber = fields.idNumber.trim();

      // Check if ID number already exists
      const exists = await this.checkIdNumberExists(idNumber);
      if (exists) {
        throw new Error('ID_NUMBER_ALREADY_REGISTERED');
      }

      // Prepare verification data
      const verificationData = {
        user_id: userId,
        id_number: idNumber,
        id_type: idType || 'Unknown',
        extracted_data: fields,
        verification_status: 'pending',
        confidence_score: confidence || null
      };

      // Insert verification record
      const { data, error } = await supabase
        .from('id_verifications')
        .insert([verificationData])
        .select()
        .single();

      if (error) {
        console.error('[ID_VERIFICATION] Error storing verification:', error);
        throw error;
      }

      console.log('[ID_VERIFICATION] Verification stored successfully:', {
        verificationId: data.id,
        userId,
        idType: data.id_type
      });

      return data;
    } catch (error) {
      console.error('[ID_VERIFICATION] Store verification error:', error);
      throw error;
    }
  }

  /**
   * Check if an ID number is already registered
   * @param {string} idNumber - ID number to check
   * @returns {Promise<boolean>} True if ID number exists
   */
  async checkIdNumberExists(idNumber) {
    try {
      const supabase = Database.getClient();

      if (!idNumber || typeof idNumber !== 'string') {
        return false;
      }

      // Use RPC function for efficient lookup
      const { data, error } = await supabase
        .rpc('check_id_number_exists', { p_id_number: idNumber.trim() });

      if (error) {
        console.error('[ID_VERIFICATION] Error checking ID number:', error);
        throw error;
      }

      return data === true;
    } catch (error) {
      console.error('[ID_VERIFICATION] Check ID number error:', error);
      throw error;
    }
  }

  /**
   * Get verification status for a user
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} Verification record or null
   */
  async getVerificationStatus(userId) {
    try {
      const supabase = Database.getClient();

      if (!userId) {
        throw new Error('User ID is required');
      }

      const { data, error } = await supabase
        .from('id_verifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[ID_VERIFICATION] Error getting verification status:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[ID_VERIFICATION] Get verification status error:', error);
      throw error;
    }
  }

  /**
   * Update verification status (for admin review)
   * @param {string} verificationId - Verification record ID
   * @param {string} status - New status (verified, rejected, flagged)
   * @param {string} adminId - Admin user ID
   * @param {string} rejectionReason - Reason for rejection (optional)
   * @returns {Promise<object>} Updated verification record
   */
  async updateVerificationStatus(verificationId, status, adminId, rejectionReason = null) {
    try {
      const supabase = Database.getClient();

      // Validate status
      const validStatuses = ['pending', 'verified', 'rejected', 'flagged'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const updateData = {
        verification_status: status,
        verified_by: adminId
      };

      // Set verified_at timestamp if status is verified
      if (status === 'verified') {
        updateData.verified_at = new Date().toISOString();
      }

      // Add rejection reason if provided
      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { data, error } = await supabase
        .from('id_verifications')
        .update(updateData)
        .eq('id', verificationId)
        .select()
        .single();

      if (error) {
        console.error('[ID_VERIFICATION] Error updating verification status:', error);
        throw error;
      }

      console.log('[ID_VERIFICATION] Verification status updated:', {
        verificationId,
        status,
        adminId
      });

      return data;
    } catch (error) {
      console.error('[ID_VERIFICATION] Update verification status error:', error);
      throw error;
    }
  }

  /**
   * Flag verification for manual review
   * @param {string} userId - User ID
   * @param {string} reason - Reason for flagging
   * @returns {Promise<object>} Updated verification record
   */
  async flagForReview(userId, reason) {
    try {
      const supabase = Database.getClient();

      const { data, error } = await supabase
        .from('id_verifications')
        .update({
          verification_status: 'flagged',
          rejection_reason: reason
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('[ID_VERIFICATION] Error flagging verification:', error);
        throw error;
      }

      console.log('[ID_VERIFICATION] Verification flagged for review:', {
        userId,
        reason
      });

      return data;
    } catch (error) {
      console.error('[ID_VERIFICATION] Flag for review error:', error);
      throw error;
    }
  }

  /**
   * Get all verifications with a specific status (admin only)
   * @param {string} status - Status to filter by
   * @param {number} limit - Maximum number of records to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<array>} Array of verification records
   */
  async getVerificationsByStatus(status, limit = 50, offset = 0) {
    try {
      const supabase = Database.getClient();

      const query = supabase
        .from('id_verifications')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query.eq('verification_status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ID_VERIFICATION] Error getting verifications by status:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[ID_VERIFICATION] Get verifications by status error:', error);
      throw error;
    }
  }

  /**
   * Delete verification record (for cleanup/testing)
   * @param {string} verificationId - Verification record ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteVerification(verificationId) {
    try {
      const supabase = Database.getClient();

      const { error } = await supabase
        .from('id_verifications')
        .delete()
        .eq('id', verificationId);

      if (error) {
        console.error('[ID_VERIFICATION] Error deleting verification:', error);
        throw error;
      }

      console.log('[ID_VERIFICATION] Verification deleted:', verificationId);
      return true;
    } catch (error) {
      console.error('[ID_VERIFICATION] Delete verification error:', error);
      throw error;
    }
  }
}

module.exports = new IDVerificationService();
