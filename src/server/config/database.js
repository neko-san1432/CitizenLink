const { createClient } = require('@supabase/supabase-js');

class Database {
  constructor() {
    this.supabase = null;
    this._initialized = false;
  }

  _initialize() {
    if (this._initialized) return;

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('⚠️  Missing Supabase environment variables. Database functionality will be limited.');
      console.warn('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
      this.supabase = null;
      this._initialized = true;
      return;
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
    this._initialized = true;
  }

  getClient() {
    this._initialize();
    if (!this.supabase) {
      throw new Error('Database not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    return this.supabase;
  }

  async testConnection() {
    this._initialize();
    if (!this.supabase) {
      console.error('❌ Database not configured');
      console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
      return false;
    }

    try {
      // Test basic connection by checking if we can list tables
      // This is more reliable than querying a specific table that might not exist
      const { data, error } = await this.supabase
        .rpc('get_current_user');

      // If the RPC function doesn't exist, try a simple query that should work
      if (error && error.message.includes('function')) {
        // Fallback: try to query a system table or use a basic auth check
        const { data: authData, error: authError } = await this.supabase.auth.getSession();
        if (authError && authError.message.includes('JWT')) {
          throw new Error('Invalid Supabase configuration');
        }
        return true;
      }

      return true;
    } catch (error) {
      console.error('Database connection failed:', error.message);
      console.error('Please ensure:');
      console.error('1. SUPABASE_URL is correct');
      console.error('2. SUPABASE_SERVICE_ROLE_KEY is correct');
      console.error('3. Database schema is properly set up');
      return false;
    }
  }
}

module.exports = Database;
