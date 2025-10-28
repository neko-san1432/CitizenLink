#!/usr/bin/env node

// Emergency fix for auth.users RLS permissions
require('dotenv').config();

const Database = require('../src/server/config/database');

async function fixAuthUsersPermissions() {
  console.log('🔧 Fixing auth.users RLS permissions...');

  try {
    const db = Database.getInstance();
    const supabase = db.getClient();

    if (!supabase) {
      console.log('❌ Database not configured');
      return;
    }

    // Try to run the RLS fix SQL
    const fixSql = `
      -- Enable RLS on auth.users table (if not already enabled)
      ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

      -- Create policy to allow service role full access to auth.users
      CREATE POLICY "Allow service role full access to auth.users" ON auth.users
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

      -- Also create policy for authenticated users to access their own data
      CREATE POLICY "Allow users to access their own data" ON auth.users
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id);

      -- Grant necessary permissions to service_role
      GRANT ALL ON auth.users TO service_role;
      GRANT USAGE ON SCHEMA auth TO service_role;
    `;

    console.log('📝 Executing SQL migration...');

    // Split SQL into individual statements and execute them
    const statements = fixSql.split(';').filter(stmt => stmt.trim().length > 0);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim() + ';';
      if (statement.trim() === ';') continue;

      console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
        } else {
          console.log(`✅ Statement ${i + 1} completed`);
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} warning:`, err.message);
      }
    }

    console.log('✅ RLS permissions fix attempted');
    console.log('');
    console.log('💡 If this didn\'t work, please run the SQL manually in Supabase:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL from database/migrations/fix_auth_users_rls_permissions.sql');

  } catch (error) {
    console.error('❌ Error fixing permissions:', error.message);
  }
}

fixAuthUsersPermissions();
