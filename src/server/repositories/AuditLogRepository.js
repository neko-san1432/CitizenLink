const Database = require('../config/database');

class AuditLogRepository {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
    this.table = 'audit_logs';
  }

  async log(action, actorId = null, metadata = {}, ipAddress = null) {
    const { error } = await this.supabase
      .from(this.table)
      .insert({
        action,
        actor_id: actorId,
        metadata,
        ip_address: ipAddress,
        created_at: new Date().toISOString()
      });
    if (error) throw error;
    return true;
  }

  async list(options = {}) {
    const { limit = 50, offset = 0, action = null } = options;
    let query = this.supabase
      .from(this.table)
      .select('*')
      .order('created_at', { ascending: false });

    if (action) query = query.eq('action', action);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }
}

module.exports = AuditLogRepository;

