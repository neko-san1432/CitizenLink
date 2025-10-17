const Database = require('../config/database');

/**
 * CoordinatorRepository
 * Database operations for coordinator functions
 */
class CoordinatorRepository {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
  }

  /**
   * Get review queue for coordinator
   * Returns complaints pending coordinator review
   */
  async getReviewQueue(coordinatorId, filters = {}) {
    try {
      let query = this.supabase
        .from('complaints')
        .select(`
          *
        `)
        .eq('status', 'pending review')
        .order('submitted_at', { ascending: false });

      // Apply filters
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.hasAlgorithmResults !== undefined) {
        // Filter complaints with/without similarity results
        // This would need a custom function or post-processing
      }

      const { data, error } = await query.limit(filters.limit || 50);

      if (error) throw error;

      // Fetch user information separately for each complaint
      const complaints = data || [];
      
      // Get unique user IDs
      const userIds = [...new Set(complaints.map(c => c.submitted_by).filter(Boolean))];
      
      // Fetch user details from auth.users
      const usersMap = {};
      if (userIds.length > 0) {
        try {
          const { data: authUsers, error: usersError } = await this.supabase.auth.admin.listUsers();
          if (!usersError && authUsers?.users) {
            authUsers.users
              .filter(u => userIds.includes(u.id))
              .forEach(user => {
                usersMap[user.id] = {
                  email: user.email,
                  name: user.user_metadata?.name || user.email,
                  metadata: user.user_metadata
                };
              });
          } else {
            console.warn('[COORDINATOR_REPO] Could not fetch user profiles:', usersError?.message);
          }
        } catch (userFetchError) {
          console.warn('[COORDINATOR_REPO] Error fetching user profiles:', userFetchError.message);
          // Continue without user profiles - complaints will have null submitted_by_profile
        }
      }

      // Attach user info to complaints
      return complaints.map(complaint => ({
        ...complaint,
        submitted_by_profile: usersMap[complaint.submitted_by] || null
      }));
    } catch (error) {
      console.error('[COORDINATOR_REPO] Get review queue error:', error);
      throw error;
    }
  }

  /**
   * Get complaint with full details including algorithm results
   */
  async getComplaintForReview(complaintId) {
    try {
      const { data: complaint, error: complaintError } = await this.supabase
        .from('complaints')
        .select('*')
        .eq('id', complaintId)
        .single();

      if (complaintError) throw complaintError;

      // Fetch submitter info from auth.users
      if (complaint && complaint.submitted_by) {
        const { data: submitter } = await this.supabase.auth.admin.getUserById(complaint.submitted_by);
        if (submitter?.user) {
          complaint.submitted_by_profile = {
            id: submitter.user.id,
            email: submitter.user.email,
            name: submitter.user.user_metadata?.name || submitter.user.email,
            raw_user_meta_data: submitter.user.user_metadata
          };
        }
      }

      // Get similarities
      const { data: similarities, error: simError } = await this.supabase
        .from('complaint_similarities')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('similarity_score', { ascending: false });

      if (simError) throw simError;

      // Fetch similar complaint details separately
      if (similarities && similarities.length > 0) {
        const similarComplaintIds = similarities.map(s => s.similar_complaint_id).filter(Boolean);
        
        if (similarComplaintIds.length > 0) {
          const { data: similarComplaints } = await this.supabase
            .from('complaints')
            .select('id, title, type, status, submitted_at, location_text, latitude, longitude')
            .in('id', similarComplaintIds);

          // Create a map for quick lookup
          const complaintsMap = {};
          (similarComplaints || []).forEach(c => {
            complaintsMap[c.id] = c;
          });

          // Attach complaint details to each similarity
          similarities.forEach(sim => {
            sim.similar_complaint = complaintsMap[sim.similar_complaint_id] || null;
          });
        }
      }

      // Get workflow logs
      const { data: logs, error: logsError } = await this.supabase
        .from('complaint_workflow_logs')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;

      return {
        ...complaint,
        similarities: similarities || [],
        workflow_logs: logs || []
      };
    } catch (error) {
      console.error('[COORDINATOR_REPO] Get complaint for review error:', error);
      throw error;
    }
  }

  /**
   * Mark complaint as duplicate
   */
  async markAsDuplicate(complaintId, masterComplaintId, coordinatorId, reason) {
    try {
      // Update complaint
      const { error: updateError } = await this.supabase
        .from('complaints')
        .update({
          is_duplicate: true,
          master_complaint_id: masterComplaintId,
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);

      if (updateError) throw updateError;

      // Insert duplicate record
      const { error: insertError } = await this.supabase
        .from('complaint_duplicates')
        .insert({
          master_complaint_id: masterComplaintId,
          duplicate_complaint_id: complaintId,
          merged_by: coordinatorId,
          merge_reason: reason,
          merged_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Log action
      await this.logAction(complaintId, 'marked_duplicate', coordinatorId, {
        master_complaint_id: masterComplaintId,
        reason
      });

      return true;
    } catch (error) {
      console.error('[COORDINATOR_REPO] Mark as duplicate error:', error);
      throw error;
    }
  }

  /**
   * Update similarity decision
   */
  async updateSimilarityDecision(similarityId, decision, coordinatorId) {
    try {
      const { error } = await this.supabase
        .from('complaint_similarities')
        .update({
          coordinator_decision: decision,
          reviewed_by: coordinatorId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', similarityId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('[COORDINATOR_REPO] Update similarity decision error:', error);
      throw error;
    }
  }

  /**
   * Assign complaint to department
   */
  async assignToDepartment(complaintId, departmentName, coordinatorId, options = {}) {
    try {
      const updateData = {
        primary_department: departmentName,
        status: 'in progress',
        workflow_status: 'assigned',
        updated_at: new Date().toISOString()
      };

      if (options.priority) {
        updateData.priority = options.priority;
      }

      if (options.deadline) {
        updateData.response_deadline = options.deadline;
      }

      if (options.notes) {
        updateData.coordinator_notes = options.notes;
      }

      const { data, error } = await this.supabase
        .from('complaints')
        .update(updateData)
        .eq('id', complaintId)
        .select()
        .single();

      if (error) throw error;

      // Log action
      await this.logAction(complaintId, 'assigned_to_department', coordinatorId, {
        department: departmentName,
        priority: options.priority,
        deadline: options.deadline
      });

      return data;
    } catch (error) {
      console.error('[COORDINATOR_REPO] Assign to department error:', error);
      throw error;
    }
  }

  /**
   * Bulk assign complaints
   */
  async bulkAssign(complaintIds, departmentName, coordinatorId) {
    try {
      const { data, error } = await this.supabase
        .from('complaints')
        .update({
          primary_department: departmentName,
          status: 'in progress',
          workflow_status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .in('id', complaintIds)
        .select();

      if (error) throw error;

      // Log actions
      for (const complaintId of complaintIds) {
        await this.logAction(complaintId, 'bulk_assigned', coordinatorId, {
          department: departmentName
        });
      }

      return data;
    } catch (error) {
      console.error('[COORDINATOR_REPO] Bulk assign error:', error);
      throw error;
    }
  }

  /**
   * Get coordinator statistics
   */
  async getCoordinatorStats(coordinatorId, dateFrom, dateTo) {
    try {
      // Get review count - return 0 if table doesn't exist or has issues
      let reviewCount = 0;
      try {
        const { count, error } = await this.supabase
          .from('complaint_workflow_logs')
          .select('*', { count: 'exact', head: true })
          .eq('action_by', coordinatorId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo);
        if (!error) reviewCount = count || 0;
      } catch (e) {
        console.warn('[COORDINATOR_REPO] Workflow logs not available:', e.message);
      }

      // Get duplicate merges - return 0 if table doesn't exist
      let mergeCount = 0;
      try {
        const { count, error } = await this.supabase
          .from('complaint_duplicates')
          .select('*', { count: 'exact', head: true })
          .eq('merged_by', coordinatorId)
          .gte('merged_at', dateFrom)
          .lte('merged_at', dateTo);
        if (!error) mergeCount = count || 0;
      } catch (e) {
        console.warn('[COORDINATOR_REPO] Duplicates table not available:', e.message);
      }

      // Get assignments - return 0 if table doesn't exist
      let assignCount = 0;
      try {
        const { count, error } = await this.supabase
          .from('complaint_workflow_logs')
          .select('*', { count: 'exact', head: true })
          .eq('action_by', coordinatorId)
          .eq('action_type', 'assigned_to_department')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo);
        if (!error) assignCount = count || 0;
      } catch (e) {
        console.warn('[COORDINATOR_REPO] Assignment logs not available:', e.message);
      }

      return {
        total_reviews: reviewCount,
        duplicates_merged: mergeCount,
        assignments_made: assignCount
      };
    } catch (error) {
      console.error('[COORDINATOR_REPO] Get stats error:', error);
      throw error;
    }
  }

  /**
   * Get active clusters
   */
  async getActiveClusters(filters = {}) {
    try {
      let query = this.supabase
        .from('complaint_clusters')
        .select('*')
        .eq('status', 'active')
        .order('identified_at', { ascending: false });

      if (filters.patternType) {
        query = query.eq('pattern_type', filters.patternType);
      }

      const { data, error } = await query.limit(filters.limit || 20);

      if (error) {
        // If table doesn't exist, return empty array instead of failing
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.warn('[COORDINATOR_REPO] Clusters table not available');
          return [];
        }
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[COORDINATOR_REPO] Get clusters error:', error);
      // Return empty array instead of crashing the dashboard
      return [];
    }
  }

  /**
   * Log workflow action
   */
  async logAction(complaintId, actionType, actionBy, details = {}) {
    try {
      const { error } = await this.supabase
        .from('complaint_workflow_logs')
        .insert({
          complaint_id: complaintId,
          action_type: actionType,
          action_by: actionBy,
          details,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('[COORDINATOR_REPO] Log action error:', error);
      // Don't throw - logging shouldn't break main flow
      return false;
    }
  }

  /**
   * Check if user is coordinator
   */
  async isCoordinator(userId) {
    try {
      const { data, error } = await this.supabase
        .from('complaint_coordinators')
        .select('id, department')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      return {
        isCoordinator: data && data.length > 0,
        departments: data ? data.map(d => d.department) : []
      };
    } catch (error) {
      console.error('[COORDINATOR_REPO] Check coordinator error:', error);
      throw error;
    }
  }

  /**
   * Get pending reviews count
   */
  async getPendingReviewsCount(coordinatorId) {
    try {
      const { count, error } = await this.supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending review');

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('[COORDINATOR_REPO] Get pending count error:', error);
      throw error;
    }
  }
}

module.exports = CoordinatorRepository;
