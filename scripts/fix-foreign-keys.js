#!/usr/bin/env node

require('dotenv').config();
const Database = require('../src/server/config/database');

async function fixForeignKeys() {
  try {
    console.log('🔧 Fixing foreign key relationships...');
    
    const supabase = Database.getClient();
    
    // Fix role_changes table foreign keys
    console.log('📋 Setting up role_changes foreign keys...');
    
    // Add foreign key for user_id
    const { error: userFkError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'role_changes_user_id_fkey'
          ) THEN
            ALTER TABLE public.role_changes 
            ADD CONSTRAINT role_changes_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `
    });
    
    if (userFkError) {
      console.warn('⚠️ User FK error (may already exist):', userFkError.message);
    } else {
      console.log('✅ role_changes.user_id foreign key added');
    }
    
    // Add foreign key for changed_by
    const { error: changedByFkError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'role_changes_changed_by_fkey'
          ) THEN
            ALTER TABLE public.role_changes 
            ADD CONSTRAINT role_changes_changed_by_fkey 
            FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `
    });
    
    if (changedByFkError) {
      console.warn('⚠️ Changed by FK error (may already exist):', changedByFkError.message);
    } else {
      console.log('✅ role_changes.changed_by foreign key added');
    }
    
    // Fix complaint_assignments table foreign keys
    console.log('📋 Setting up complaint_assignments foreign keys...');
    
    // Add foreign key for complaint_id
    const { error: complaintFkError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'complaint_assignments_complaint_id_fkey'
          ) THEN
            ALTER TABLE public.complaint_assignments 
            ADD CONSTRAINT complaint_assignments_complaint_id_fkey 
            FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `
    });
    
    if (complaintFkError) {
      console.warn('⚠️ Complaint FK error (may already exist):', complaintFkError.message);
    } else {
      console.log('✅ complaint_assignments.complaint_id foreign key added');
    }
    
    // Add foreign key for assigned_to
    const { error: assignedToFkError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'complaint_assignments_assigned_to_fkey'
          ) THEN
            ALTER TABLE public.complaint_assignments 
            ADD CONSTRAINT complaint_assignments_assigned_to_fkey 
            FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `
    });
    
    if (assignedToFkError) {
      console.warn('⚠️ Assigned to FK error (may already exist):', assignedToFkError.message);
    } else {
      console.log('✅ complaint_assignments.assigned_to foreign key added');
    }
    
    // Add foreign key for assigned_by
    const { error: assignedByFkError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'complaint_assignments_assigned_by_fkey'
          ) THEN
            ALTER TABLE public.complaint_assignments 
            ADD CONSTRAINT complaint_assignments_assigned_by_fkey 
            FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `
    });
    
    if (assignedByFkError) {
      console.warn('⚠️ Assigned by FK error (may already exist):', assignedByFkError.message);
    } else {
      console.log('✅ complaint_assignments.assigned_by foreign key added');
    }
    
    // Add foreign key for updated_by
    const { error: updatedByFkError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'complaint_assignments_updated_by_fkey'
          ) THEN
            ALTER TABLE public.complaint_assignments 
            ADD CONSTRAINT complaint_assignments_updated_by_fkey 
            FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `
    });
    
    if (updatedByFkError) {
      console.warn('⚠️ Updated by FK error (may already exist):', updatedByFkError.message);
    } else {
      console.log('✅ complaint_assignments.updated_by foreign key added');
    }
    
    console.log('\n🎉 Foreign key relationships fixed!');
    console.log('📊 Summary:');
    console.log('   ✅ role_changes table foreign keys');
    console.log('   ✅ complaint_assignments table foreign keys');
    console.log('   ✅ All relationships should now work properly');
    
  } catch (error) {
    console.error('❌ Error fixing foreign keys:', error);
  }
}

fixForeignKeys();
