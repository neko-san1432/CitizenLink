const Database = require("../config/database");

class ComplaintHistoryRepository {

  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
    this.table = "complaint_history";
  }
  async addEntry(complaintId, action, actorId = null, notes = null) {
    const { error } = await this.supabase
      .from(this.table)
      .insert({
        complaint_id: complaintId,
        action,
        actor_id: actorId,
        notes,
        created_at: new Date().toISOString()
      });
    if (error) throw error;
    return true;
  }
  async list(complaintId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    const { data, error } = await this.supabase
      .from(this.table)
      .select("*")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }
}

module.exports = ComplaintHistoryRepository;
