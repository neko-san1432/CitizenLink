const Database = require('../config/database');
const Complaint = require('../models/Complaint');

class ComplaintRepository {
  constructor() {
    this.db = Database.getInstance();
    this.supabase = this.db.getClient();
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
    const { data, error } = await this.supabase
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const complaint = new Complaint(data);

    // Get assignment data for progress tracking
    const { data: assignments } = await this.supabase
      .from('complaint_assignments')
      .select('*')
      .eq('complaint_id', id)
      .order('officer_order', { ascending: true });

    // Add assignments to complaint object
    complaint.assignments = assignments || [];

    return complaint;
  }

  async findByUserId(userId, options = {}) {
    try {
      console.log('[COMPLAINT_REPO] findByUserId called:', { userId, options });

      const { page = 1, limit = 10, status, type } = options;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('complaints')
        .select('*')
        .eq('submitted_by', userId)
        .order('submitted_at', { ascending: false });

      if (status) {
        query = query.eq('workflow_status', status);
      }

      if (type) {
        query = query.eq('type', type);
      }

      console.log('[COMPLAINT_REPO] Executing query with:', {
        userId,
        page,
        limit,
        offset,
        status,
        type,
        sql: query.toString()
      });

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[COMPLAINT_REPO] Database query error:', error);
        throw error;
      }

      console.log('[COMPLAINT_REPO] Query result:', {
        dataCount: data?.length || 0,
        count,
        page,
        limit,
        offset
      });

      return {
        complaints: data || [],
        total: count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('[COMPLAINT_REPO] Error in findByUserId:', error);
      console.error('[COMPLAINT_REPO] Error stack:', error.stack);
      throw error;
    }
  }

  async findAll(options = {}) {
    const { page = 1, limit = 20, status, department, search } = options;
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
    const { data, error } = await this.supabase
      .from('complaint_coordinators')
      .select('user_id')
      .eq('department', department)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
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
}

module.exports = ComplaintRepository;
