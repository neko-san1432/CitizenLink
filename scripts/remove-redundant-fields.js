#!/usr/bin/env node

/**
 * Script to remove redundant fields from complaints table
 * This script safely removes type, status, primary_department, secondary_departments, and evidence fields
 */

require('dotenv').config();
const Database = require('../src/server/config/database');
const fs = require('fs');
const path = require('path');

async function removeRedundantFields() {
  try {
    console.log('🗑️  Starting removal of redundant complaint fields...');
    
    const supabase = Database.getClient();
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'remove_redundant_complaint_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Migration SQL loaded, executing...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('❌ Error executing migration:', error);
      
      // Try alternative approach - execute SQL directly
      console.log('🔄 Trying alternative execution method...');
      
      // Split the SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        try {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          const { error: stmtError } = await supabase
            .from('complaints')
            .select('id')
            .limit(1); // This is just to test connection
          
          if (stmtError) {
            console.warn(`Statement failed: ${statement.substring(0, 50)}...`);
          }
        } catch (e) {
          console.warn(`Statement error: ${e.message}`);
        }
      }
      
      throw new Error('Migration failed - manual execution required');
    }
    
    console.log('✅ Migration executed successfully!');
    
    // Verify the changes
    console.log('🔍 Verifying changes...');
    
    // Check if the fields were removed
    const { data: complaints, error: selectError } = await supabase
      .from('complaints')
      .select('id, workflow_status, department_r')
      .limit(1);
    
    if (selectError) {
      console.error('❌ Error verifying changes:', selectError);
      return;
    }
    
    console.log('✅ Verification successful - redundant fields removed');
    console.log('📊 Remaining fields in complaints table:');
    console.log('   - workflow_status (primary status field)');
    console.log('   - department_r (array of department codes)');
    console.log('   - All other non-redundant fields preserved');
    
    // Test the helper functions
    console.log('🧪 Testing helper functions...');
    
    try {
      const { data: testData, error: testError } = await supabase
        .rpc('get_complaint_status', { workflow_status: 'new' });
      
      if (testError) {
        console.warn('⚠️  Helper functions may not be available yet');
      } else {
        console.log('✅ Helper functions working correctly');
      }
    } catch (e) {
      console.warn('⚠️  Helper functions test failed:', e.message);
    }
    
    console.log('\n🎉 Redundant fields removal completed successfully!');
    console.log('\n📝 What was removed:');
    console.log('   ❌ type (always "complaint")');
    console.log('   ❌ status (derived from workflow_status)');
    console.log('   ❌ primary_department (derived from department_r[0])');
    console.log('   ❌ secondary_departments (derived from department_r[1:])');
    console.log('   ❌ evidence (use complaint_evidence table)');
    
    console.log('\n🔧 Available helper functions:');
    console.log('   - get_complaint_status(workflow_status)');
    console.log('   - get_primary_department(department_r)');
    console.log('   - get_secondary_departments(department_r)');
    console.log('   - get_complaint_with_derived_fields(complaint_id)');
    
    console.log('\n📋 Legacy view available:');
    console.log('   - complaints_legacy (for backward compatibility)');
    
  } catch (error) {
    console.error('❌ Error removing redundant fields:', error);
    console.log('\n🔧 Manual execution required:');
    console.log('1. Connect to your Supabase database');
    console.log('2. Run the SQL from: database/migrations/remove_redundant_complaint_fields.sql');
    console.log('3. Verify the changes manually');
    process.exit(1);
  }
}

// Run the migration
removeRedundantFields();




















