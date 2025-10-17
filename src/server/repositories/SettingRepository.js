const Database = require('../config/database');
const Setting = require('../models/Setting');

class SettingRepository {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
  }

  async findAll() {
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .order('category, key');

    if (error) throw error;
    return data.map(setting => new Setting(setting));
  }

  async findByCategory(category) {
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .eq('category', category)
      .order('key');

    if (error) throw error;
    return data.map(setting => new Setting(setting));
  }

  async findPublic() {
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .eq('is_public', true)
      .order('category, key');

    if (error) throw error;
    return data.map(setting => new Setting(setting));
  }

  async findByKey(key) {
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return new Setting(data);
  }

  async create(settingData) {
    const { data, error } = await this.supabase
      .from('settings')
      .insert(settingData)
      .select()
      .single();

    if (error) throw error;
    return new Setting(data);
  }

  async update(key, settingData) {
    const { data, error } = await this.supabase
      .from('settings')
      .update({
        ...settingData,
        updated_at: new Date().toISOString()
      })
      .eq('key', key)
      .select()
      .single();

    if (error) throw error;
    return new Setting(data);
  }

  async delete(key) {
    const { error } = await this.supabase
      .from('settings')
      .delete()
      .eq('key', key);

    if (error) throw error;
    return true;
  }

  async upsert(settingData) {
    const { data, error } = await this.supabase
      .from('settings')
      .upsert(settingData, { onConflict: 'key' })
      .select()
      .single();

    if (error) throw error;
    return new Setting(data);
  }
}

module.exports = SettingRepository;
