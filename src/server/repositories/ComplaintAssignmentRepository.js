const Database = require('../config/database');

class ComplaintAssignmentRepository {

  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
    this.table = 'complaint_assignments';
  }
  async assign(complaintId, departmentId, assignedBy, options = {}) {
    const payload = {
      complaint_id: complaintId,
      department_id: departmentId,
      assigned_by: assignedBy,
      assigned_to: options.assigned_to || null,
      status: options.status || 'pending',
      rejection_reason: options.rejection_reason || null
    };
    const { data, error } = await this.supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  async updateStatus(assignmentId, status, metadata = {}) {
    const { data, error } = await this.supabase
      .from(this.table)
      .update({ status, rejection_reason: metadata.rejection_reason || null, updated_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  async listByComplaint(complaintId) {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async findByOfficer(officerId, filters = {}) {
    const { status, priority, limit } = filters;
    let query = this.supabase
      .from(this.table)
      .select('id, complaint_id, assigned_to, assigned_by, status, priority, assignment_type, assignment_group_id, officer_order, created_at, updated_at, completed_at, notes, deadline')
      .eq('assigned_to', officerId)
      .order('created_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  async findByIdAndOfficer(assignmentId, officerId) {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('id, complaint_id, assigned_by, status')
      .eq('id', assignmentId)
      .eq('assigned_to', officerId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
  async update(assignmentId, updateData) {
    const { data, error } = await this.supabase
      .from(this.table)
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  async findByComplaintIds(complaintIds) {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('assigned_to, status, assigned_at, assigned_by, department_id')
      .in('complaint_id', complaintIds);
    if (error) throw error;
    return data || [];
  }
  async getActivitiesByOfficer(officerId, limit = 10) {
    const { data, error } = await this.supabase
      .from(this.table)
      .select(`
        id,
        status,
        notes,
        created_at,
        updated_at,
        completed_at,
        complaint_id,
        complaints!inner(
          id,
          title,
          category
        )
      `)
      .eq('assigned_to', officerId)
      .order('updated_at', { ascending: false })
      .limit(parseInt(limit));
    if (error) throw error;
    return data || [];
  }
}

module.exports = ComplaintAssignmentRepository;
