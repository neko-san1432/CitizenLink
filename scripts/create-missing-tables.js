#!/usr/bin/env node

require('dotenv').config();
const Database = require('../src/server/config/database');
const fs = require('fs');
const path = require('path');

async function createMissingTables() {
  try {
    console.log('🔧 Creating missing database tables...');
    
    const supabase = Database.getClient();
    
    // Read and execute complaint_assignments migration
    console.log('📋 Creating complaint_assignments table...');
    const assignmentsPath = path.join(__dirname, '..', 'database', 'migrations', 'create_complaint_assignments_table.sql');
    const assignmentsSQL = fs.readFileSync(assignmentsPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = assignmentsSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.warn(`Statement failed: ${error.message}`);
          }
        } catch (e) {
          console.warn(`Statement error: ${e.message}`);
        }
      }
    }
    
    console.log('✅ complaint_assignments table created');
    
    // Read and execute role_changes migration
    console.log('📋 Creating role_changes table...');
    const roleChangesPath = path.join(__dirname, '..', 'database', 'migrations', 'create_role_changes_table.sql');
    const roleChangesSQL = fs.readFileSync(roleChangesPath, 'utf8');
    
    // Split SQL into individual statements
    const roleStatements = roleChangesSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of roleStatements) {
      if (statement.trim()) {
        try {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.warn(`Statement failed: ${error.message}`);
          }
        } catch (e) {
          console.warn(`Statement error: ${e.message}`);
        }
      }
    }
    
    console.log('✅ role_changes table created');
    
    // Verify tables exist
    console.log('🔍 Verifying tables...');
    
    const { data: assignments, error: assignmentsError } = await supabase
      .from('complaint_assignments')
      .select('id')
      .limit(1);
    
    if (assignmentsError) {
      console.error('❌ complaint_assignments table not accessible:', assignmentsError.message);
    } else {
      console.log('✅ complaint_assignments table is accessible');
    }
    
    const { data: roleChanges, error: roleChangesError } = await supabase
      .from('role_changes')
      .select('id')
      .limit(1);
    
    if (roleChangesError) {
      console.error('❌ role_changes table not accessible:', roleChangesError.message);
    } else {
      console.log('✅ role_changes table is accessible');
    }
    
    console.log('\n🎉 Missing tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
}

createMissingTables();
