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
}

module.exports = ComplaintAssignmentRepository;
