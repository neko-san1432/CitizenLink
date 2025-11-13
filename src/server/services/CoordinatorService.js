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
      // console.log removed for security
      // console.log removed for security
      const complaints = await this.coordinatorRepo.getReviewQueue(coordinatorId, filters);
      // console.log removed for security
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
            { category: complaint.category }
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
        case 'approve':
          // New workflow: approve with department assignment
          if (!data.departments || data.departments.length === 0) {
            throw new Error('Departments required for approval');
          }
          return await this.approveComplaint(
            complaintId,
            data.departments,
            coordinatorId,
            data.options || {}
          );
        case 'reject':
          // New workflow: reject complaint
          if (!data.reason) {
            throw new Error('Rejection reason required');
          }
          return await this.rejectComplaint(
            complaintId,
            coordinatorId,
            data.reason
          );
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
        case 'mark_false':
          if (!data.reason) {
            throw new Error('Please select a reason for marking this complaint as false.');
          }
          return await this.markAsFalse(complaintId, coordinatorId, data.reason);
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
        default:
          throw new Error('Invalid decision type');
      }
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Process decision error:', error);
      throw error;
    }
  }
  /**
  * Approve complaint with department assignment
  */
  async approveComplaint(complaintId, departments, coordinatorId, options = {}) {
    try {
      // console.log removed for security
      // Update complaint status to approved
      const { data: updated, error: updateError } = await this.coordinatorRepo.supabase
        .from('complaints')
        .update({
          status: 'approved',
          workflow_status: 'assigned',
          department_r: departments, // CRITICAL: Set department_r array so LGU admins can see assigned complaints
          coordinator_notes: options.notes || null,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();
      if (updateError) throw updateError;
      // Assign to departments using existing method
      const assignResult = await this.assignToDepartments(
        complaintId,
        departments,
        coordinatorId,
        options
      );
      // Log action
      await this.coordinatorRepo.logAction(
        complaintId,
        'approved',
        coordinatorId,
        {
          departments,
          notes: options.notes,
          message: 'Complaint approved and assigned to departments'
        }
      );
      // Notify citizen about approval and assignment
      if (updated.submitted_by) {
        await this.notificationService.notifyComplaintAssignedToOfficer(
          updated.submitted_by,
          complaintId,
          updated.title,
          { departments }
        );
      }
      return {
        success: true,
        message: `Complaint approved and assigned to ${departments.length} department(s)`,
        complaint: updated,
        ...assignResult
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Approve complaint error:', error);
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
   * Mark complaint as false
   */
  async markAsFalse(complaintId, coordinatorId, reason) {
    try {
      // console.log removed for security
      // Update complaint status to false
      const { data, error } = await this.coordinatorRepo.supabase
        .from('complaints')
        .update({
          status: 'false',
          workflow_status: 'cancelled',
          coordinator_notes: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId)
        .select()
        .single();
      if (error) {
        console.error('[COORDINATOR_SERVICE] Mark false error:', error);
        throw error;
      }
      // Log action
      await this.coordinatorRepo.logAction(
        complaintId,
        'marked_false',
        coordinatorId,
        {
          message: 'Complaint marked as false',
          reason
        }
      );
      // Send notification to complainant
      try {
        await this.notificationService.notifyComplaintStatusChange(
          data.submitted_by,
          complaintId,
          'false',
          'Your complaint has been marked as false by the coordinator.',
          { reason }
        );
      } catch (notifError) {
        console.warn('[COORDINATOR_SERVICE] Failed to send notification:', notifError.message);
      }
      return {
        success: true,
        message: 'Complaint marked as false'
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Mark false error:', error);
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
      // Update department_r field in complaints table (critical for LGU admin visibility)
      const { error: updateError } = await this.coordinatorRepo.supabase
        .from('complaints')
        .update({
          department_r: [departmentName], // CRITICAL: Set department_r array so LGU admins can see assigned complaints
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);
      if (updateError) {
        console.warn('[COORDINATOR_SERVICE] Failed to update department_r field:', updateError.message);
      }
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
          await this.notificationService.notifyTaskAssigned(
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
      // Validate department codes against dynamic directory
      try {
        const { validateDepartmentCodes } = require('../utils/departmentMapping');

        const { validCodes, invalidCodes } = await validateDepartmentCodes(uniqueCodes);
        if (invalidCodes.length > 0) {
          const list = invalidCodes.join(', ');
          const err = new Error(`Invalid department code(s): ${list}`);
          err.code = 'INVALID_DEPARTMENT_CODES';
          err.details = { invalidCodes };
          throw err;
        }
      } catch (vErr) {
        if (vErr.code === 'INVALID_DEPARTMENT_CODES') throw vErr;
        // On validator failure (e.g., DB down), proceed with a safe fallback: reject to avoid bad data
        throw new Error('Unable to validate department codes at this time');
      }
      // Set primary to first, others as secondary array
      const primary = uniqueCodes[0];
      const secondary = uniqueCodes.slice(1);
      // Update complaint with arrays
      const { data: updated, error: updErr } = await this.coordinatorRepo.supabase
        .from('complaints')
        .update({
          // primary_department: primary, // Removed - derived from department_r
          // secondary_departments: secondary, // Removed - derived from department_r
          // status: 'in progress', // Removed - derived from workflow_status
          workflow_status: 'assigned',
          department_r: uniqueCodes, // CRITICAL: Set department_r array so LGU admins can see assigned complaints
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
          // Notify department admins using the working method
          await this.notifyDepartmentAdmins(departmentName, assigned[0]?.id, assigned[0]?.title || 'New Complaints');
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
   * Get rejected complaints
   */
  async getRejectedComplaints(coordinatorId, filters = {}) {
    try {
      return await this.coordinatorRepo.getRejectedComplaints(coordinatorId, filters);
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Get rejected complaints error:', error);
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
      const stats = await this.coordinatorRepo.getCoordinatorStats(
        coordinatorId,
        weekAgo.toISOString(),
        today.toISOString()
      );
      // console.log removed for security
      const recentQueue = await this.coordinatorRepo.getReviewQueue(coordinatorId, { limit: 10 });
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
      // console.log removed for security
      // Use the NotificationService method that properly handles auth.users queries
      await this.notificationService.notifyDepartmentAdminsByCode(
        departmentCode,
        complaintId,
        complaintTitle
      );
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
      await this.notificationService.notifyTaskAssigned(
        officerId,
        complaintId,
        complaintTitle,
        notifPriority,
        deadline
      );
    } catch (error) {
      console.warn('[COORDINATOR_SERVICE] Task assignment notification failed:', error.message);
    }
  }
  /**
   * LGU Admin sends reminder to officer about pending task
   */
  async sendOfficerReminder(adminId, officerId, complaintId, reminderType, customMessage = null) {
    try {
      // Get complaint details
      const complaint = await this.coordinatorRepo.getComplaintForReview(complaintId);
      if (!complaint) {
        throw new Error('Complaint not found');
      }
      // Get officer details
      const { data: officer } = await this.coordinatorRepo.supabase
        .from('auth.users')
        .select('raw_user_meta_data')
        .eq('id', officerId)
        .single();
      const officerName = officer?.raw_user_meta_data?.name || 'Officer';
      // Determine reminder message based on type
      let reminderMessage;
      switch (reminderType) {
        case 'pending_task':
          reminderMessage = customMessage || 'Please complete your assigned task';
          break;
        case 'complete_assignment':
          reminderMessage = customMessage || 'Please mark your assignment as complete';
          break;
        case 'overdue_task':
          reminderMessage = customMessage || 'Your task is overdue, please take immediate action';
          break;
        default:
          reminderMessage = customMessage || 'Please check your assigned task';
      }
      // Send notification to officer
      await this.notificationService.notifyPendingTaskReminder(
        officerId,
        complaintId,
        complaint.title,
        `${reminderMessage} (from LGU Admin)`
      );
      // Notify admin that reminder was sent
      await this.notificationService.createNotification(
        adminId,
        'officer_reminder_sent',
        'Reminder Sent',
        `Reminder sent to ${officerName} for complaint: "${complaint.title}"`,
        {
          priority: 'info',
          link: `/lgu-admin/assignments`,
          metadata: {
            complaint_id: complaintId,
            officer_id: officerId,
            reminder_type: reminderType
          }
        }
      );
      // Log the reminder action
      await this.coordinatorRepo.logAction(
        complaintId,
        'admin_reminder_sent',
        adminId,
        {
          reminder_type: reminderType,
          target_officer: officerId,
          message: reminderMessage
        }
      );
      return {
        success: true,
        message: `Reminder sent to officer successfully`
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Send officer reminder error:', error);
      throw error;
    }
  }
  /**
   * Check pending assignments that need attention
   */
  async getPendingAssignmentsSummary() {
    try {
      const { data: assignments, error } = await this.coordinatorRepo.supabase
        .from('complaint_assignments')
        .select(`
          *,
          complaints!inner(id, title, workflow_status, submitted_at, priority),
          departments(id, code, name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Group by officer and check for overdue items
      const officerSummary = {};
      const overdueItems = [];
      for (const assignment of assignments) {
        const officerId = assignment.assigned_to;
        if (!officerId) continue;
        // Initialize officer summary
        if (!officerSummary[officerId]) {
          officerSummary[officerId] = {
            officer_id: officerId,
            assignments_count: 0,
            overdue_count: 0,
            recent_complaints: []
          };
        }
        officerSummary[officerId].assignments_count++;
        // Check if overdue (no activity for 7 days)
        const complaint = assignment.complaints;
        const daysSinceAssignment = Math.floor(
          (Date.now() - new Date(assignment.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceAssignment > 7) {
          officerSummary[officerId].overdue_count++;
          overdueItems.push({
            assignment_id: assignment.id,
            complaint_id: complaint.id,
            complaint_title: complaint.title,
            officer_id: officerId,
            days_overdue: daysSinceAssignment
          });
        }
        officerSummary[officerId].recent_complaints.push({
          id: complaint.id,
          title: complaint.title,
          priority: complaint.priority,
          assigned_days_ago: daysSinceAssignment
        });
      }
      return {
        success: true,
        data: {
          total_pending: assignments.length,
          officers_needing_attention: Object.keys(officerSummary).length,
          overdue_assignments: overdueItems.length,
          officer_summary: officerSummary,
          overdue_items: overdueItems
        }
      };
    } catch (error) {
      console.error('[COORDINATOR_SERVICE] Get pending assignments summary error:', error);
      throw error;
    }
  }
}

module.exports = CoordinatorService;
