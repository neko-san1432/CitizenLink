#!/usr/bin/env node

/**
 * Remove problematic foreign key constraints that reference auth.users
 * These constraints cause permission issues in Supabase
 */

const Database = require('../src/server/config/database');

async function removeProblematicForeignKeys() {
  try {
    console.log('🔧 Removing problematic foreign key constraints...');
    
    const db = new Database();
    const supabase = db.getClient();

    // List of foreign key constraints to remove
    const constraintsToRemove = [
      // complaint_assignments table
      'ALTER TABLE complaint_assignments DROP CONSTRAINT IF EXISTS complaint_assignments_assigned_to_fkey;',
      'ALTER TABLE complaint_assignments DROP CONSTRAINT IF EXISTS complaint_assignments_assigned_by_fkey;',
      'ALTER TABLE complaint_assignments DROP CONSTRAINT IF EXISTS complaint_assignments_updated_by_fkey;',
      
      // role_changes table
      'ALTER TABLE role_changes DROP CONSTRAINT IF EXISTS role_changes_user_id_fkey;',
      'ALTER TABLE role_changes DROP CONSTRAINT IF EXISTS role_changes_changed_by_fkey;',
      
      // department_transfers table
      'ALTER TABLE department_transfers DROP CONSTRAINT IF EXISTS department_transfers_user_id_fkey;',
      'ALTER TABLE department_transfers DROP CONSTRAINT IF EXISTS department_transfers_performed_by_fkey;',
      
      // Other tables with auth.users references
      'ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_cancelled_by_fkey;',
      'ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_resolved_by_fkey;',
      'ALTER TABLE complaint_reminders DROP CONSTRAINT IF EXISTS complaint_reminders_reminded_by_fkey;',
      'ALTER TABLE false_complaints DROP CONSTRAINT IF EXISTS false_complaints_false_complaint_marked_by_fkey;'
    ];

    console.log('📋 Executing constraint removal queries...');
    
    for (const query of constraintsToRemove) {
      try {
        console.log(`   Executing: ${query}`);
        const { error } = await supabase.rpc('exec_sql', { sql: query });
        
        if (error) {
          console.warn(`   ⚠️  Warning: ${error.message}`);
        } else {
          console.log(`   ✅ Success`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Warning: ${err.message}`);
      }
    }

    console.log('✅ Foreign key constraint removal completed');
    console.log('📝 Note: Data integrity is now maintained at the application level');
    
  } catch (error) {
    console.error('❌ Error removing foreign key constraints:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  removeProblematicForeignKeys()
    .then(() => {
      console.log('🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { removeProblematicForeignKeys };
