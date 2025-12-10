const Database = require('../config/database');
const Profile = require('../models/Profile');

class ProfileRepository {
  constructor() {
    this.supabase = Database.getClient();
  }

  /**
   * Find profiles by role (Efficient O(1) lookup via index)
   */
  async findByRole(role, department = null) {
    let query = this.supabase
      .from('profiles')
      .select('*')
      .eq('role', role);

    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[PROFILE_REPO] Error finding profiles by role:', error);
      return [];
    }

    return (data || []).map(p => new Profile(p));
  }

  /**
   * Sync user data to profiles table
   */
  async upsertProfile(userData) {
    const profileData = {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      first_name: userData.firstName,
      last_name: userData.lastName,
      department: userData.department,
      updated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('profiles')
      .upsert(profileData);

    if (error) {
      console.error('[PROFILE_REPO] Error syncing profile:', error);
      throw error;
    }
  }
}

module.exports = ProfileRepository;
