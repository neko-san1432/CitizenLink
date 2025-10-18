const Database = require('../config/database');

class InvitationTokenRepository {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
    this.table = 'invitation_tokens';
  }

  async createToken(tokenData) {
    const { data, error } = await this.supabase
      .from(this.table)
      .insert(tokenData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getToken(token) {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('token', token)
      .single();
    if (error) throw error;
    return data;
  }

  async incrementUse(token) {
    const { data, error } = await this.supabase
      .from(this.table)
      .update({ uses: this.supabase.rpc ? undefined : undefined })
      .eq('token', token)
      .select()
      .single();
    // Supabase does not support atomic ++ in update; fallback via RPC if available
    if (error) {
      // Try select then update
      const existing = await this.getToken(token);
      const nextUses = (existing?.uses || 0) + 1;
      const { data: upd, error: updErr } = await this.supabase
        .from(this.table)
        .update({ uses: nextUses })
        .eq('token', token)
        .select()
        .single();
      if (updErr) throw updErr;
      return upd;
    }
    return data;
  }

  async deactivate(token) {
    const { data, error } = await this.supabase
      .from(this.table)
      .update({ active: false })
      .eq('token', token)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async cleanupExpired(nowIso = new Date().toISOString()) {
    const { error } = await this.supabase
      .from(this.table)
      .update({ active: false })
      .lte('expires_at', nowIso)
      .eq('active', true);
    if (error) throw error;
    return true;
  }
}

module.exports = InvitationTokenRepository;

