const Database = require('../config/database');
const Complaint = require('../models/Complaint');

class ComplaintRepository {
  constructor() {
    this.db = new Database();
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
    return new Complaint(data);
  }

  async findByUserId(userId, options = {}) {
    const { page = 1, limit = 10, status, type } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('complaints')
      .select('*')
      .eq('submitted_by', userId)
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('type', type);
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

  async findAll(options = {}) {
    const { page = 1, limit = 20, status, type, department, search } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('complaints')
      .select(`
        *,
        submitted_by_profile:submitted_by (
          email,
          raw_user_meta_data
        )
      `)
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
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

  async updateEvidence(id, evidence) {
    const { data, error } = await this.supabase
      .from('complaints')
      .update({ evidence })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return new Complaint(data);
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
