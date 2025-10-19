const CoordinatorRepository = require('../repositories/CoordinatorRepository');
const ComplaintAssignmentRepository = require('../repositories/ComplaintAssignmentRepository');
const DepartmentRepository = require('../repositories/DepartmentRepository');
const DuplicationDetectionService = require('./DuplicationDetectionService');
const SimilarityCalculatorService = require('./SimilarityCalculatorService');
const NotificationService = require('./NotificationService');
const RuleBasedSuggestionService = require('./RuleBasedSuggestionService');

/**
 * CoordinatorService
 * Business logic for coordinator operations
 */
class CoordinatorService {
  constructor() {
    this.coordinatorRepo = new CoordinatorRepository();
    this.assignmentRepo = new ComplaintAssignmentRepository();
    this.departmentRepo = new DepartmentRepository();
    this.duplicationService = new DuplicationDetectionService();
    this.similarityService = new SimilarityCalculatorService();
    this.notificationService = new NotificationService();
    this.suggestionService = new RuleBasedSuggestionService();
  }

  /**
   * Get review queue with algorithm results
   */
  async getReviewQueue(coordinatorId, filters = {}) {
    try {
      const complaints = await this.coordinatorRepo.getReviewQueue(coordinatorId, filters);

      // Enhance with algorithm confidence levels
      const enhanced = complaints.map(complaint => {
        const hasSimilarities = complaint.similarities && complaint.similarities.length > 0;
        const highConfidence = hasSimilarities &&
          complaint.similarities.some(s => s.similarity_score >= 0.85);

        return {
          ...complaint,
          algorithm_flags: {
            has_duplicates: hasSimilarities,
            high_confidence_duplicate: highConfidence,
            similarity_count: complaint.similarities?.length || 0,
            needs_review: !complaint.is_duplicate && hasSimilarities
          }
        };
      });

      return enhanced;
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Get review queue error:', error);
      throw error;
    }
  }

  /**
   * Get complaint for review with full analysis
   */
  async getComplaintForReview(complaintId, coordinatorId) {
    try {
      const complaint = await this.coordinatorRepo.getComplaintForReview(complaintId);

      // Run duplication detection if not already done
      if (!complaint.similarities || complaint.similarities.length === 0) {
        try {
          const duplicates = await this.duplicationService.detectDuplicates(complaintId);
          complaint.similarities = duplicates;
        } catch (detectionError) {
          console.warn('[COORDINATOR_SERVICE] Duplication detection failed:', detectionError);
          complaint.similarities = [];
        }
      }

      // Get nearby complaints for geographic context
      let nearbyComplaints = [];
      if (complaint.latitude && complaint.longitude) {
        try {
          nearbyComplaints = await this.similarityService.findSimilarInRadius(
            complaint.latitude,
            complaint.longitude,
            0.5, // 500m radius
            { type: complaint.type }
          );
        } catch (nearbyError) {
          console.warn('[COORDINATOR_SERVICE] Nearby search failed:', nearbyError);
        }
      }

      // Categorize similarities
      const categorized = this.categorizeSimilarities(complaint.similarities);

      // Compute rule-based suggestions (non-ML)
      let suggestions = { departments: [], coordinator: null, disclaimer: '' };
      try {
        suggestions = await this.suggestionService.computeSuggestions(complaint);
      } catch (sugErr) {
        console.warn('[COORDINATOR_SERVICE] Suggestion compute failed:', sugErr.message);
      }

      return {
        complaint,
        analysis: {
          duplicate_candidates: categorized.veryHigh,
          similar_complaints: categorized.high,
          related_complaints: categorized.medium,
          nearby_complaints: nearbyComplaints,
          recommendation: this.generateRecommendation(complaint, categorized)
        },
        suggestions
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Get complaint for review error:', error);
      throw error;
    }
  }

  /**
   * Process coordinator decision
   */
  async processDecision(complaintId, decision, coordinatorId, data = {}) {
    try {
      switch (decision) {
      case 'mark_duplicate':
        if (!data.masterComplaintId) {
          throw new Error('Master complaint ID required');
        }
        return await this.markAsDuplicate(
          complaintId,
          data.masterComplaintId,
          coordinatorId,
          data.reason
        );

      case 'mark_unique':
        return await this.markAsUnique(complaintId, coordinatorId);

      case 'assign_department':
        // Support single or multiple departments
        if (!data.department && (!data.departments || data.departments.length === 0)) {
          throw new Error('Department required');
        }
        if (Array.isArray(data.departments) && data.departments.length > 0) {
          return await this.assignToDepartments(
            complaintId,
            data.departments,
            coordinatorId,
            data.options || {}
          );
        }
        return await this.assignToDepartment(
          complaintId,
          data.department,
          coordinatorId,
          data.options
        );

      case 'link_related':
        if (!data.relatedComplaintIds) {
          throw new Error('Related complaint IDs required');
        }
        return await this.linkRelatedComplaints(
          complaintId,
          data.relatedComplaintIds,
          coordinatorId
        );

      case 'reject':
        if (!data.reason) {
          throw new Error('Rejection reason required');
        }
        return await this.rejectComplaint(
          complaintId,
          coordinatorId,
          data.reason
        );

      default:
        throw new Error('Invalid decision type');
      }
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Process decision error:', error);
      throw error;
    }
  }

  /**
   * Mark complaint as duplicate
   */
  async markAsDuplicate(complaintId, masterComplaintId, coordinatorId, reason) {
    try {
      const complaint = await this.coordinatorRepo.getComplaintForReview(complaintId);

      await this.coordinatorRepo.markAsDuplicate(
        complaintId,
        masterComplaintId,
        coordinatorId,
        reason || 'Duplicate complaint identified by coordinator'
      );

      // Notify citizen that their complaint was marked as duplicate
      try {
        await this.notificationService.notifyComplaintDuplicate(
          complaint.submitted_by,
          complaintId,
          complaint.title,
          masterComplaintId
        );
      } catch (notifError) {
        console.warn('[COORDINATOR] Failed to send duplicate notification:', notifError.message);
      }

      return {
        success: true,
        message: 'Complaint marked as duplicate',
        master_complaint_id: masterComplaintId
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Mark duplicate error:', error);
      throw error;
    }
  }

  /**
   * Mark complaint as unique (not a duplicate)
   */
  async markAsUnique(complaintId, coordinatorId) {
    try {
      // Update all similarities to 'unique' decision
      const complaint = await this.coordinatorRepo.getComplaintForReview(complaintId);

      if (complaint.similarities && complaint.similarities.length > 0) {
        for (const similarity of complaint.similarities) {
          await this.coordinatorRepo.updateSimilarityDecision(
            similarity.id,
            'unique',
            coordinatorId
          );
        }
      }

      // Log action
      await this.coordinatorRepo.logAction(
        complaintId,
        'marked_unique',
        coordinatorId,
        { message: 'Coordinator confirmed this is a unique complaint' }
      );

      return {
        success: true,
        message: 'Complaint marked as unique'
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Mark unique error:', error);
      throw error;
    }
  }

  /**
   * Reject complaint
   */
  async rejectComplaint(complaintId, coordinatorId, reason) {
    try {
      // Update complaint status to rejected
      const { data, error } = await this.coordinatorRepo.supabase
        .from('complaints')
        .update({
          status: 'rejected',
          workflow_status: 'cancelled',
          coordinator_notes: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();

      if (error) throw error;

      // Log action
      await this.coordinatorRepo.logAction(
        complaintId,
        'rejected',
        coordinatorId,
        { reason }
      );

      // Notify submitter
      if (data.submitted_by) {
        await this.notificationService.createNotification(
          data.submitted_by,
          'complaint_rejected',
          'Complaint Rejected',
          `Your complaint "${data.title}" has been rejected. Reason: ${reason}`,
          {
            priority: 'warning',
            link: `/citizen/complaints/${complaintId}`,
            metadata: { complaint_id: complaintId, reason }
          }
        );
      }

      return {
        success: true,
        message: 'Complaint rejected'
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Reject complaint error:', error);
      throw error;
    }
  }

  /**
   * Assign complaint to department
   */
  async assignToDepartment(complaintId, departmentName, coordinatorId, options = {}) {
    try {
      // console.log removed for security

      // Update complaint with department assignment
      const assigned = await this.coordinatorRepo.assignToDepartment(
        complaintId,
        departmentName,
        coordinatorId,
        options
      );

      // Create complaint_assignments record
      try {
        const { data: dept, error: deptError } = await this.coordinatorRepo.supabase
          .from('departments')
          .select('id')
          .eq('code', departmentName)
          .single();

        if (deptError) {
          console.warn('[COORDINATOR_SERVICE] Department not found:', deptError.message);
        } else {
          // Create assignment record
          const { data: assignment, error: assignError } = await this.coordinatorRepo.supabase
            .from('complaint_assignments')
            .insert({
              complaint_id: complaintId,
              department_id: dept.id,
              assigned_by: coordinatorId,
              assigned_to: options.assigned_to || null,
              status: 'pending',
              priority: options.priority || 'medium',
              deadline: options.deadline || null
            })
            .select()
            .single();

          if (assignError) {
            console.warn('[COORDINATOR_SERVICE] Assignment creation failed:', assignError.message);
          } else {
            // console.log removed for security
          }
        }
      } catch (e) {
        console.warn('[COORDINATOR_SERVICE] Assignment creation failed:', e.message);
      }

      // Notify department admins
      try {
        await this.notifyDepartmentAdmins(departmentName, complaintId, assigned.title || 'New Complaint');
      } catch (e) {
        console.warn('[COORDINATOR_SERVICE] Admin notification failed:', e.message);
      }

      // If an officer is immediately assigned, notify them
      if (options && options.assigned_to) {
        try {
          await this.notifyTaskAssigned(
            options.assigned_to,
            complaintId,
            assigned.title || 'New Complaint',
            options.priority || assigned.priority || 'medium',
            options.deadline || assigned.response_deadline || null
          );
        } catch (e) {
          console.warn('[COORDINATOR_SERVICE] Officer notification failed:', e.message);
        }
      }

      return {
        success: true,
        message: `Complaint assigned to ${departmentName}`,
        complaint: assigned
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Assign department error:', error);
      throw error;
    }
  }

  /**
   * Assign complaint to multiple departments
   */
  async assignToDepartments(complaintId, departmentCodes, coordinatorId, options = {}) {
    try {
      const uniqueCodes = Array.from(new Set((departmentCodes || []).filter(Boolean)));
      if (uniqueCodes.length === 0) {
        throw new Error('No departments provided');
      }

      // Set primary to first, others as secondary array
      const primary = uniqueCodes[0];
      const secondary = uniqueCodes.slice(1);

      // Update complaint with arrays
      const { data: updated, error: updErr } = await this.coordinatorRepo.supabase
        .from('complaints')
        .update({
          primary_department: primary,
          secondary_departments: secondary,
          status: 'in progress',
          workflow_status: 'assigned',
          priority: options.priority || undefined,
          response_deadline: options.deadline || undefined,
          coordinator_notes: options.notes || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();

      if (updErr) throw updErr;

      // Create assignment rows for each department
      for (const code of uniqueCodes) {
        try {
          const dept = await this.departmentRepo.findByCode(code);
          if (!dept || !dept.id) continue;
          await this.assignmentRepo.assign(
            complaintId,
            dept.id,
            coordinatorId,
            {
              status: 'pending',
              priority: options.priority || 'medium',
              deadline: options.deadline || null
            }
          );
          await this.notifyDepartmentAdmins(code, complaintId, updated.title || 'New Complaint');
        } catch (e) {
          console.warn('[COORDINATOR_SERVICE] Per-dept assignment failed:', code, e.message);
        }
      }

      // Log action once with all departments
      await this.coordinatorRepo.logAction(
        complaintId,
        'assigned_to_departments',
        coordinatorId,
        { departments: uniqueCodes }
      );

      return {
        success: true,
        message: `Complaint assigned to ${uniqueCodes.length} department(s)` ,
        complaint: updated
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Assign to departments error:', error);
      throw error;
    }
  }

  /**
   * Link related complaints
   */
  async linkRelatedComplaints(complaintId, relatedIds, coordinatorId) {
    try {
      // Update similarities to 'related' decision
      const complaint = await this.coordinatorRepo.getComplaintForReview(complaintId);

      for (const relatedId of relatedIds) {
        const similarity = complaint.similarities.find(
          s => s.similar_complaint_id === relatedId
        );

        if (similarity) {
          await this.coordinatorRepo.updateSimilarityDecision(
            similarity.id,
            'related',
            coordinatorId
          );
        }
      }

      // Log action
      await this.coordinatorRepo.logAction(
        complaintId,
        'linked_related',
        coordinatorId,
        { related_complaint_ids: relatedIds }
      );

      return {
        success: true,
        message: 'Complaints linked as related'
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Link related error:', error);
      throw error;
    }
  }

  /**
   * Bulk assign complaints
   */
  async bulkAssign(complaintIds, departmentName, coordinatorId) {
    try {
      const assigned = await this.coordinatorRepo.bulkAssign(
        complaintIds,
        departmentName,
        coordinatorId
      );

      // Create assignment records and notify admins for each complaint
      try {
        const dept = await this.departmentRepo.findByCode(departmentName);
        if (dept && dept.id) {
          for (const c of assigned) {
            await this.assignmentRepo.assign(
              c.id,
              dept.id,
              coordinatorId,
              { status: 'pending' }
            );
          }
          await this.notificationService.notifyDepartmentAdminsByCode(
            departmentName,
            assigned[0]?.id,
            assigned[0]?.title || 'New Complaints'
          );
        }
      } catch (e) {
        console.warn('[COORDINATOR_SERVICE] Bulk assignment/notification post-step failed:', e.message);
      }

      return {
        success: true,
        message: `${assigned.length} complaints assigned to ${departmentName}`,
        count: assigned.length
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Bulk assign error:', error);
      throw error;
    }
  }

  /**
   * Get coordinator dashboard data
   */
  async getDashboardData(coordinatorId) {
    try {
      // console.log removed for security
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // console.log removed for security
      const pendingCount = await this.coordinatorRepo.getPendingReviewsCount(coordinatorId);
      // console.log removed for security

      // console.log removed for security
      const stats = await this.coordinatorRepo.getCoordinatorStats(
        coordinatorId,
        weekAgo.toISOString(),
        today.toISOString()
      );
      // console.log removed for security

      // console.log removed for security
      const recentQueue = await this.coordinatorRepo.getReviewQueue(coordinatorId, { limit: 10 });
      // console.log removed for security

      // console.log removed for security
      const clusters = await this.coordinatorRepo.getActiveClusters({ limit: 5 });
      // console.log removed for security

      const result = {
        pending_reviews: pendingCount,
        stats: {
          ...stats,
          period: 'last_7_days'
        },
        recent_queue: recentQueue,
        active_clusters: clusters
      };

      // console.log removed for security
      return result;
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Get dashboard error:', error);
      console.error('[COORDINATOR_SERVICE] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Detect clusters in area
   */
  async detectClusters(options = {}) {
    try {
      const clusters = await this.similarityService.detectClusters(options);

      return {
        success: true,
        clusters,
        count: clusters.length
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Detect clusters error:', error);
      throw error;
    }
  }

  /**
   * Helper: Categorize similarities by confidence
   */
  categorizeSimilarities(similarities) {
    return {
      veryHigh: similarities.filter(s => s.similarity_score >= 0.85),
      high: similarities.filter(s => s.similarity_score >= 0.70 && s.similarity_score < 0.85),
      medium: similarities.filter(s => s.similarity_score >= 0.50 && s.similarity_score < 0.70),
      low: similarities.filter(s => s.similarity_score < 0.50)
    };
  }

  /**
   * Helper: Generate recommendation based on analysis
   */
  generateRecommendation(complaint, categorized) {
    if (categorized.veryHigh.length > 0) {
      return {
        action: 'review_duplicates',
        confidence: 'high',
        message: `High confidence duplicate detected. Review ${categorized.veryHigh.length} potential duplicate(s).`,
        priority: 'urgent'
      };
    }

    if (categorized.high.length > 0) {
      return {
        action: 'review_similar',
        confidence: 'medium',
        message: `${categorized.high.length} similar complaint(s) found. Consider linking or merging.`,
        priority: 'high'
      };
    }

    if (categorized.medium.length > 0) {
      return {
        action: 'review_related',
        confidence: 'low',
        message: `${categorized.medium.length} potentially related complaint(s). Review for patterns.`,
        priority: 'medium'
      };
    }

    return {
      action: 'assign_department',
      confidence: 'high',
      message: 'No duplicates detected. Proceed with department assignment.',
      priority: 'normal'
    };
  }

  /**
   * Check if user is coordinator
   */
  async checkCoordinatorStatus(userId) {
    try {
      return await this.coordinatorRepo.isCoordinator(userId);
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Check status error:', error);
      throw error;
    }
  }

  /**
   * Notify department admins about new assignment
   */
  async notifyDepartmentAdmins(departmentCode, complaintId, complaintTitle) {
    try {
      // Get all users with lgu-admin-{department_code} role
      const { data: users, error } = await this.coordinatorRepo.supabase.auth.admin.listUsers();

      if (error) {
        console.warn('[COORDINATOR_SERVICE] Failed to get users for notification:', error.message);
        return;
      }

      const adminRole = `lgu-admin-${departmentCode}`;
      const admins = users.users.filter(user =>
        user.user_metadata?.role === adminRole ||
        user.raw_user_meta_data?.role === adminRole
      );

      // Create notifications for each admin
      for (const admin of admins) {
        try {
          await this.notificationService.createNotification(
            admin.id,
            'approval_required',
            'New Complaint Assigned to Your Department',
            `"${complaintTitle}" has been assigned to ${departmentCode}.`,
            {
              priority: 'info',
              link: '/lgu-admin/assignments',
              metadata: { complaint_id: complaintId, department: departmentCode }
            }
          );
          // console.log removed for security
        } catch (notifError) {
          console.warn(`[COORDINATOR_SERVICE] Failed to notify admin ${admin.email}:`, notifError.message);
        }
      }
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Notify department admins error:', error);
    }
  }

  /**
   * Notify officer about task assignment
   */
  async notifyTaskAssigned(officerId, complaintId, complaintTitle, priority, deadline) {
    try {
      const notifPriority = priority === 'urgent' ? 'urgent' :
        priority === 'high' ? 'warning' : 'info';

      await this.notificationService.createNotification(
        officerId,
        'task_assigned',
        'New Task Assigned',
        `You've been assigned: "${complaintTitle}" - Priority: ${priority}`,
        {
          priority: notifPriority,
          link: `/lgu/tasks/${complaintId}`,
          metadata: {
            complaint_id: complaintId,
            priority,
            deadline: deadline || null
          }
        }
      );
      // console.log removed for security
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Notify task assigned error:', error);
      throw error;
    }
  }
}

module.exports = CoordinatorService;
