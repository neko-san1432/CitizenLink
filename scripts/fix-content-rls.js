#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function fixContentRLS() {
  console.log('🔒 Fixing RLS Policies for Content Tables (news, notices, events)');
  console.log('='.repeat(60));

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      console.error('   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_content_tables_rls_policies.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing RLS policies migration...');
    console.log('');

    // Execute the migration using Supabase RPC (if available) or direct SQL
    try {
      // Try using exec_sql RPC function if it exists
      const { data, error } = await supabase.rpc('exec_sql', { sql });

      if (error) {
        // If RPC doesn't exist, we'll need manual execution
        console.log('⚠️  RPC exec_sql not available. Please run manually in Supabase SQL Editor.');
        console.log('');
        console.log('📝 MANUAL MIGRATION REQUIRED:');
        console.log('='.repeat(60));
        console.log('1. Go to your Supabase Dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Copy and paste the following SQL:');
        console.log('');
        console.log(sql);
        console.log('');
        console.log('4. Click "Run" to execute');
        process.exit(0);
      }

      console.log('✅ RLS policies created successfully!');
      console.log('');
      console.log('📋 Summary:');
      console.log('  ✅ News table: Policies for SELECT, INSERT, UPDATE');
      console.log('  ✅ Notices table: Policies for SELECT, INSERT, UPDATE');
      console.log('  ✅ Events table: Policies for SELECT, INSERT, UPDATE');
      console.log('');
      console.log('🎉 Content tables are now accessible by lgu-admin users!');

    } catch (rpcError) {
      console.log('⚠️  RPC execution failed:', rpcError.message);
      console.log('');
      console.log('📝 Please run the migration manually:');
      console.log('');
      console.log('1. Open Supabase Dashboard → SQL Editor');
      console.log('2. Copy the SQL from: database/migrations/add_content_tables_rls_policies.sql');
      console.log('3. Paste and run it');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the migration
fixContentRLS();

