#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function runMigration() {
  console.log('🗃️  Running Multiple Officers Support Migration');
  console.log('='.repeat(50));

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase environment variables');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🔄 Testing database connection...');
    
    // Test connection by checking if complaint_assignments table exists
    const { data: testData, error: testError } = await supabase
      .from('complaint_assignments')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.log('❌ Cannot access complaint_assignments table:', testError.message);
      return;
    }
    
    console.log('✅ Database connection successful');
    
    // Check current schema
    console.log('🔍 Checking current schema...');
    const { data: schemaData, error: schemaError } = await supabase
      .from('complaint_assignments')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.log('❌ Schema check failed:', schemaError.message);
      return;
    }
    
    console.log('📋 Current columns:', Object.keys(schemaData[0] || {}));
    
    // Since we can't execute DDL directly, let's provide instructions
    console.log('\n📝 MANUAL MIGRATION REQUIRED');
    console.log('='.repeat(50));
    console.log('Please run the following SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('-- Add assignment_type column');
    console.log("ALTER TABLE complaint_assignments ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'single' CHECK (assignment_type IN ('single', 'multi'));");
    console.log('');
    console.log('-- Add assignment_group_id column');
    console.log('ALTER TABLE complaint_assignments ADD COLUMN IF NOT EXISTS assignment_group_id UUID DEFAULT gen_random_uuid();');
    console.log('');
    console.log('-- Add officer_order column');
    console.log('ALTER TABLE complaint_assignments ADD COLUMN IF NOT EXISTS officer_order INTEGER DEFAULT 1;');
    console.log('');
    console.log('-- Create indexes');
    console.log('CREATE INDEX IF NOT EXISTS idx_complaint_assignments_group_id ON complaint_assignments(assignment_group_id);');
    console.log('CREATE INDEX IF NOT EXISTS idx_complaint_assignments_type ON complaint_assignments(assignment_type);');
    console.log('');
    console.log('-- Update existing assignments');
    console.log('UPDATE complaint_assignments SET assignment_group_id = gen_random_uuid() WHERE assignment_group_id IS NULL;');
    console.log('');
    console.log('After running these SQL statements, the migration will be complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();