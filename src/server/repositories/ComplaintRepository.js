const { createClient } = require('@supabase/supabase-js');
const Database = require('../config/database');
const Complaint = require('../models/Complaint');
const crypto = require('crypto');

class ComplaintRepository {

  constructor() {
    this.supabase = Database.getClient();
  }
  async create(complaintData) {
    const { data, error } = await this.supabase
      .from('complaints')
      .insert(complaintData)
      .select()
      .single();
    if (error) throw error;
    return new Complaint(data);
  }
  async findById(id) {
    try {
      const { data, error } = await this.supabase
        .from('complaints')
        .select('*')
        .eq('id', id)
        .maybeSingle(); // Use maybeSingle() instead of single() to return null when no rows found
      
      if (error) {
        // PGRST116 = no rows returned (expected when complaint doesn't exist)
        if (error.code === 'PGRST116') {
          console.log(`[COMPLAINT_REPO] Complaint ${id} not found (PGRST116)`);
          return null;
        }
        // Log other errors for debugging
        console.error(`[COMPLAINT_REPO] Error fetching complaint ${id}:`, error);
        throw error;
      }
      
      if (!data) {
        console.log(`[COMPLAINT_REPO] Complaint ${id} not found (no data)`);
        return null;
      }
      
      const complaint = new Complaint(data);
      // Get assignment data for progress tracking (without accessing auth.users)
      const { data: assignments } = await this.supabase
        .from('complaint_assignments')
        .select('id, complaint_id, assigned_to, assigned_by, status, priority, assignment_type, assignment_group_id, officer_order, created_at, updated_at')
        .eq('complaint_id', id)
        .order('officer_order', { ascending: true });
      // Add assignments to complaint object
      complaint.assignments = assignments || [];
      return complaint;
    } catch (error) {
      console.error(`[COMPLAINT_REPO] Unexpected error in findById for ${id}:`, error);
      throw error;
    }
  }
  async findByIds(ids, fields = '*') {
    if (!ids || ids.length === 0) return [];
    const { data, error } = await this.supabase
      .from('complaints')
      .select(fields)
      .in('id', ids);
    if (error) throw error;
    return data || [];
  }
  async findByUserId(userId, options = {}) {
    try {
      const { page = 1, limit = 10, status, type } = options;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('complaints')
        .select('*', { count: 'exact' })
        .eq('submitted_by', userId)
        .order('submitted_at', { ascending: false });
      if (status) {
        query = query.eq('workflow_status', status);
      }
      if (type) {
        query = query.eq('type', type);
      }
      // First get the count without range, applying same filters
      let countQuery = this.supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('submitted_by', userId);
      if (status) {
        countQuery = countQuery.eq('workflow_status', status);
      }
      if (type) {
        countQuery = countQuery.eq('type', type);
      }
      const { count: totalCount, error: countError } = await countQuery;
      if (countError) {
        console.error('[COMPLAINT_REPO] Count query error:', countError);
      }
      // DIAGNOSTIC: Get ALL complaints for this user without pagination (non-blocking)
      // This runs in parallel and doesn't block the main query
      this.supabase
        .from('complaints')
        .select('id, title, workflow_status, submitted_at, is_duplicate, cancelled_at')
        .eq('submitted_by', userId)
        .order('submitted_at', { ascending: false })
        .then(() => {
          // Diagnostic query removed for cleaner logs
        })
        .catch(() => {
          // Silent catch for diagnostic query
        });
      // Then get the paginated data
      // Use range for pagination (Supabase uses 0-based indexing for range)
      const { data, error } = await query
        .range(offset, offset + limit - 1);
      if (error) {
        console.error('[COMPLAINT_REPO] Database query error:', error);
        throw error;
      }
      return {
        complaints: data || [],
        total: totalCount || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((totalCount || 0) / limit)
      };
    } catch (error) {
      console.error('[COMPLAINT_REPO] Error in findByUserId:', error);
      console.error('[COMPLAINT_REPO] Error stack:', error.stack);
      throw error;
    }
  }
  async findAll(options = {}) {
    // Extract filter parameters
    const { page = 1, limit = 20, status, type, department, search } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('complaints')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (status) {
      query = query.eq('workflow_status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (department) {
      query = query.contains('department_r', [department]);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,descriptive_su.ilike.%${search}%,location_text.ilike.%${search}%`);
    }
    const { data, error, count } = await query
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return {
      complaints: data.map(complaint => new Complaint(complaint)),
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  }
  async update(id, updateData) {
    const { data, error } = await this.supabase
      .from('complaints')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return new Complaint(data);
  }
  async updateStatus(id, status, notes = null) {
    const updateData = { status, updated_at: new Date().toISOString() };
    if (notes) {
      updateData.coordinator_notes = notes;
    }
    const { data, error } = await this.supabase
      .from('complaints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return new Complaint(data);
  }
  async updateEvidence(id, evidence, userId = null) {
    // Store evidence files in the complaint_evidence table
    if (!evidence || evidence.length === 0) {
      return { success: true };
    }
    try {
      const evidenceRecords = evidence.map(file => ({
        complaint_id: id,
        file_name: file.fileName,
        file_path: file.filePath,
        file_size: file.fileSize,
        file_type: file.fileType,
        mime_type: file.fileType,
        uploaded_by: userId,
        is_public: false
        // Removed description, tags, metadata as they don't exist in the table schema
      }));

      const { data, error } = await this.supabase
        .from('complaint_evidence')
        .insert(evidenceRecords)
        .select();
      if (error) {
        console.error('[COMPLAINT_REPO] Evidence storage error:', error);
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      console.error('[COMPLAINT_REPO] Evidence update failed:', error);
      return { success: false, error: error.message };
    }
  }
  async assignCoordinator(id, coordinatorId) {
    const { data, error } = await this.supabase
      .from('complaints')
      .update({
        assigned_coordinator_id: coordinatorId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return new Complaint(data);
  }
  async autoAssignDepartments(id) {
    const { data, error } = await this.supabase
      .rpc('auto_assign_departments', { p_complaint_id: id });
    if (error) throw error;
    return data;
  }
  async findActiveCoordinator(department) {
    // Use admin auth API to find coordinators instead of complaint_coordinators table
    try {
      const { data: authUsers, error: authError } = await this.supabase.auth.admin.listUsers();
      if (authError) {
        console.error('[COMPLAINT_REPO] Error fetching auth users:', authError);
        return null;
      }
      if (!authUsers?.users) {
        console.warn('[COMPLAINT_REPO] No users found in auth system');
        return null;
      }
      // Find users with base_role = complaint-coordinator
      const coordinators = authUsers.users.filter(user => {
        const metadata = user.user_metadata || {};
        const rawMetadata = user.raw_user_meta_data || {};
        const baseRole = metadata.base_role || rawMetadata.base_role;
        const isCoordinator = baseRole === 'complaint-coordinator';
        // Optional: filter by department if specified
        if (department && department !== 'GENERAL') {
          const userDept = metadata.department || rawMetadata.department ||
                          metadata.dpt || rawMetadata.dpt;
          return isCoordinator && userDept === department;
        }
        return isCoordinator;
      });
      if (coordinators.length === 0) {
        console.warn('[COMPLAINT_REPO] No complaint coordinators found');
        return null;
      }
      // Return the first available coordinator
      const coordinator = coordinators[0];
      // console.log removed for security
      return {
        user_id: coordinator.id,
        email: coordinator.email,
        name: coordinator.user_metadata?.name || coordinator.raw_user_meta_data?.name || coordinator.email
      };
    } catch (error) {
      console.error('[COMPLAINT_REPO] Error finding coordinator:', error);
      return null;
    }
  }
  async logAction(complaintId, actionType, details = {}) {
    const { error } = await this.supabase
      .rpc('log_complaint_action', {
        p_complaint_id: complaintId,
        p_action_type: actionType,
        p_reason: details.reason || null,
        p_to_dept: details.to_dept || null,
        p_details: details.details ? JSON.stringify(details.details) : null
      });
    if (error) throw error;
    return true;
  }
  async createAssignments(complaintId, officerIds, assignedBy) {
    try {
      const assignments = [];
      for (let i = 0; i < officerIds.length; i++) {
        const officerId = officerIds[i];
        const assignment = {
          complaint_id: complaintId,
          assigned_to: officerId, // Fixed: was officer_id, should be assigned_to
          assigned_by: assignedBy,
          status: 'assigned',
          priority: 'medium',
          assignment_type: officerIds.length > 1 ? 'multi' : 'single',
          assignment_group_id: crypto.randomUUID(),
          officer_order: i + 1
        };
        const { data, error } = await this.supabase
          .from('complaint_assignments')
          .insert(assignment)
          .select();
        if (error) throw error;
        assignments.push(data[0]);
      }
      return assignments;
    } catch (error) {
      console.error('[COMPLAINT-REPO] Error creating assignments:', error.message);
      throw error;
    }
  }
}

module.exports = ComplaintRepository;
