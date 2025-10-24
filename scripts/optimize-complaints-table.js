#!/usr/bin/env node

/**
 * Script to optimize the complaints table by removing redundant fields
 * This handles RLS policy dependencies properly
 */

require('dotenv').config();
const Database = require('../src/server/config/database');

async function optimizeComplaintsTable() {
  try {
    console.log('🔧 Starting complaints table optimization...');
    
    const supabase = Database.getClient();
    
    // Step 1: Run the first migration (update policies and create view)
    console.log('📋 Step 1: Updating RLS policies and creating compatibility view...');
    
    const { error: migration1Error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create a view that provides backward compatibility for status
        CREATE OR REPLACE VIEW complaint_status_view AS
        SELECT 
          id,
          submitted_by,
          title,
          type,
          subtype,
          descriptive_su,
          location_text,
          latitude,
          longitude,
          department_r,
          -- Derive status from workflow_status for backward compatibility
          CASE 
            WHEN workflow_status = 'new' THEN 'pending review'
            WHEN workflow_status = 'assigned' THEN 'in progress'
            WHEN workflow_status = 'in_progress' THEN 'in progress'
            WHEN workflow_status = 'pending_approval' THEN 'in progress'
            WHEN workflow_status = 'completed' THEN 'resolved'
            WHEN workflow_status = 'cancelled' THEN 'rejected'
            ELSE 'pending review'
          END as status,
          workflow_status,
          priority,
          -- Derive primary_department from department_r array
          CASE 
            WHEN array_length(department_r, 1) > 0 THEN department_r[1]
            ELSE NULL
          END as primary_department,
          -- Derive secondary_departments from department_r array
          CASE 
            WHEN array_length(department_r, 1) > 1 THEN department_r[2:]
            ELSE '{}'::text[]
          END as secondary_departments,
          assigned_coordinator_id,
          response_deadline,
          citizen_satisfaction_rating,
          is_duplicate,
          master_complaint_id,
          task_force_id,
          coordinator_notes,
          estimated_resolution_date,
          submitted_at,
          updated_at,
          cancelled_at,
          cancellation_reason,
          cancelled_by,
          last_activity_at,
          preferred_departments,
          resolution_notes,
          resolved_by,
          resolved_at,
          confirmed_by_citizen,
          citizen_confirmation_date
        FROM complaints;
      `
    });
    
    if (migration1Error) {
      console.error('❌ Error creating compatibility view:', migration1Error);
      throw migration1Error;
    }
    
    console.log('✅ Compatibility view created successfully');
    
    // Step 2: Drop and recreate RLS policies
    console.log('📋 Step 2: Updating RLS policies...');
    
    const { error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop existing policies
        DO $$
        DECLARE
            policy_name text;
        BEGIN
            FOR policy_name IN 
                SELECT policyname 
                FROM pg_policies 
                WHERE tablename = 'complaints' 
                AND schemaname = 'public'
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.complaints', policy_name);
            END LOOP;
        END $$;
        
        -- Recreate policies using workflow_status
        CREATE POLICY "Citizens can view own complaints" ON public.complaints
          FOR SELECT USING (submitted_by = auth.uid());

        CREATE POLICY "Citizens can update own pending complaints" ON public.complaints
          FOR UPDATE USING (
            submitted_by = auth.uid() 
            AND workflow_status IN ('new', 'assigned')
          );

        CREATE POLICY "Citizens can insert own complaints" ON public.complaints
          FOR INSERT WITH CHECK (submitted_by = auth.uid());

        CREATE POLICY "Coordinators can view all complaints" ON public.complaints
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM auth.users 
              WHERE id = auth.uid() 
              AND (raw_user_meta_data->>'role' IN ('complaint-coordinator', 'super-admin', 'lgu-admin', 'lgu-officer'))
            )
          );

        CREATE POLICY "Coordinators can update all complaints" ON public.complaints
          FOR UPDATE USING (
            EXISTS (
              SELECT 1 FROM auth.users 
              WHERE id = auth.uid() 
              AND (raw_user_meta_data->>'role' IN ('complaint-coordinator', 'super-admin', 'lgu-admin', 'lgu-officer'))
            )
          );
      `
    });
    
    if (policiesError) {
      console.error('❌ Error updating policies:', policiesError);
      throw policiesError;
    }
    
    console.log('✅ RLS policies updated successfully');
    
    // Step 3: Now we can safely drop the redundant columns
    console.log('📋 Step 3: Dropping redundant columns...');
    
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.complaints 
          DROP COLUMN IF EXISTS status,
          DROP COLUMN IF EXISTS primary_department,
          DROP COLUMN IF EXISTS secondary_departments,
          DROP COLUMN IF EXISTS evidence;
      `
    });
    
    if (dropError) {
      console.error('❌ Error dropping columns:', dropError);
      throw dropError;
    }
    
    console.log('✅ Redundant columns dropped successfully');
    
    // Step 4: Create helper functions
    console.log('📋 Step 4: Creating helper functions...');
    
    const { error: functionsError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Function to get primary department from department_r array
        CREATE OR REPLACE FUNCTION get_primary_department(complaint_row complaints)
        RETURNS text AS $$
        BEGIN
          RETURN CASE 
            WHEN array_length(complaint_row.department_r, 1) > 0 THEN complaint_row.department_r[1]
            ELSE NULL
          END;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;

        -- Function to get secondary departments from department_r array
        CREATE OR REPLACE FUNCTION get_secondary_departments(complaint_row complaints)
        RETURNS text[] AS $$
        BEGIN
          RETURN CASE 
            WHEN array_length(complaint_row.department_r, 1) > 1 THEN complaint_row.department_r[2:]
            ELSE '{}'::text[]
          END;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;

        -- Function to get status from workflow_status
        CREATE OR REPLACE FUNCTION get_status_from_workflow(complaint_row complaints)
        RETURNS text AS $$
        BEGIN
          RETURN CASE 
            WHEN complaint_row.workflow_status = 'new' THEN 'pending review'
            WHEN complaint_row.workflow_status = 'assigned' THEN 'in progress'
            WHEN complaint_row.workflow_status = 'in_progress' THEN 'in progress'
            WHEN complaint_row.workflow_status = 'pending_approval' THEN 'in progress'
            WHEN complaint_row.workflow_status = 'completed' THEN 'resolved'
            WHEN complaint_row.workflow_status = 'cancelled' THEN 'rejected'
            ELSE 'pending review'
          END;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
      `
    });
    
    if (functionsError) {
      console.error('❌ Error creating helper functions:', functionsError);
      throw functionsError;
    }
    
    console.log('✅ Helper functions created successfully');
    
    // Step 5: Update the view to use helper functions
    console.log('📋 Step 5: Updating compatibility view...');
    
    const { error: viewError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW complaint_status_view AS
        SELECT 
          id,
          submitted_by,
          title,
          type,
          subtype,
          descriptive_su,
          location_text,
          latitude,
          longitude,
          department_r,
          get_status_from_workflow(complaints.*) as status,
          workflow_status,
          priority,
          get_primary_department(complaints.*) as primary_department,
          get_secondary_departments(complaints.*) as secondary_departments,
          assigned_coordinator_id,
          response_deadline,
          citizen_satisfaction_rating,
          is_duplicate,
          master_complaint_id,
          task_force_id,
          coordinator_notes,
          estimated_resolution_date,
          submitted_at,
          updated_at,
          cancelled_at,
          cancellation_reason,
          cancelled_by,
          last_activity_at,
          preferred_departments,
          resolution_notes,
          resolved_by,
          resolved_at,
          confirmed_by_citizen,
          citizen_confirmation_date
        FROM complaints;
      `
    });
    
    if (viewError) {
      console.error('❌ Error updating view:', viewError);
      throw viewError;
    }
    
    console.log('✅ Compatibility view updated successfully');
    
    // Step 6: Create indexes for better performance
    console.log('📋 Step 6: Creating performance indexes...');
    
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_complaints_workflow_status ON complaints(workflow_status);
        CREATE INDEX IF NOT EXISTS idx_complaints_department_r ON complaints USING GIN(department_r);
        CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by ON complaints(submitted_by);
        CREATE INDEX IF NOT EXISTS idx_complaints_last_activity ON complaints(last_activity_at);
      `
    });
    
    if (indexError) {
      console.error('❌ Error creating indexes:', indexError);
      throw indexError;
    }
    
    console.log('✅ Performance indexes created successfully');
    
    // Step 7: Log the migration
    console.log('📋 Step 7: Logging migration...');
    
    const { error: logError } = await supabase
      .from('settings')
      .upsert({
        key: 'complaints_table_optimized',
        value: 'true',
        type: 'boolean',
        category: 'database',
        description: 'Complaints table has been optimized by removing redundant status, primary_department, secondary_departments, and evidence columns'
      });
    
    if (logError) {
      console.warn('⚠️  Warning: Could not log migration:', logError);
    } else {
      console.log('✅ Migration logged successfully');
    }
    
    console.log('🎉 Complaints table optimization completed successfully!');
    console.log('');
    console.log('📊 Summary of changes:');
    console.log('  ✅ Removed redundant status column (now derived from workflow_status)');
    console.log('  ✅ Removed redundant primary_department column (now derived from department_r[1])');
    console.log('  ✅ Removed redundant secondary_departments column (now derived from department_r[2:])');
    console.log('  ✅ Removed redundant evidence column (use complaint_evidence table)');
    console.log('  ✅ Updated RLS policies to use workflow_status');
    console.log('  ✅ Created backward compatibility view: complaint_status_view');
    console.log('  ✅ Created helper functions for common queries');
    console.log('  ✅ Added performance indexes');
    console.log('');
    console.log('💡 Usage:');
    console.log('  - Use complaint_status_view for backward compatibility');
    console.log('  - Use get_primary_department(complaints.*) for primary department');
    console.log('  - Use get_secondary_departments(complaints.*) for secondary departments');
    console.log('  - Use get_status_from_workflow(complaints.*) for legacy status');
    
  } catch (error) {
    console.error('❌ Error optimizing complaints table:', error);
    process.exit(1);
  }
}

// Run the optimization
optimizeComplaintsTable();
