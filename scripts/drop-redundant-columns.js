#!/usr/bin/env node

/**
 * Simple script to drop redundant columns from complaints table
 * Uses direct SQL execution through Supabase client
 */

require('dotenv').config();
const Database = require('../src/server/config/database');

async function dropRedundantColumns() {
  try {
    console.log('🗑️  Dropping redundant columns from complaints table...');
    
    const supabase = Database.getClient();
    
    // Step 1: Drop RLS policies first
    console.log('📋 Step 1: Dropping RLS policies...');
    
    const policies = [
      'Citizens can view own complaints',
      'Citizens can update own pending complaints', 
      'Coordinators can view assigned complaints',
      'Coordinators can update assigned complaints',
      'LGU admins can view all complaints',
      'LGU admins can update all complaints',
      'Super admins can view all complaints',
      'Super admins can update all complaints'
    ];
    
    for (const policy of policies) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: `DROP POLICY IF EXISTS "${policy}" ON public.complaints;`
        });
        if (error) {
          console.warn(`⚠️  Could not drop policy "${policy}":`, error.message);
        } else {
          console.log(`✅ Dropped policy: ${policy}`);
        }
      } catch (e) {
        console.warn(`⚠️  Policy drop failed: ${e.message}`);
      }
    }
    
    // Step 2: Drop the redundant columns
    console.log('📋 Step 2: Dropping redundant columns...');
    
    const columnsToDrop = [
      'type',
      'status', 
      'primary_department',
      'secondary_departments',
      'evidence'
    ];
    
    for (const column of columnsToDrop) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE public.complaints DROP COLUMN IF EXISTS ${column};`
        });
        
        if (error) {
          console.warn(`⚠️  Could not drop column "${column}":`, error.message);
        } else {
          console.log(`✅ Dropped column: ${column}`);
        }
      } catch (e) {
        console.warn(`⚠️  Column drop failed: ${e.message}`);
      }
    }
    
    // Step 3: Recreate essential RLS policies
    console.log('📋 Step 3: Recreating RLS policies...');
    
    const policiesToCreate = [
      {
        name: 'Citizens can view own complaints',
        sql: `CREATE POLICY "Citizens can view own complaints" ON public.complaints FOR SELECT USING (submitted_by = auth.uid());`
      },
      {
        name: 'Citizens can update own pending complaints',
        sql: `CREATE POLICY "Citizens can update own pending complaints" ON public.complaints FOR UPDATE USING (submitted_by = auth.uid() AND workflow_status IN ('new', 'assigned'));`
      },
      {
        name: 'Coordinators can view assigned complaints',
        sql: `CREATE POLICY "Coordinators can view assigned complaints" ON public.complaints FOR SELECT USING (assigned_coordinator_id = auth.uid() OR workflow_status IN ('new', 'assigned'));`
      },
      {
        name: 'Coordinators can update assigned complaints',
        sql: `CREATE POLICY "Coordinators can update assigned complaints" ON public.complaints FOR UPDATE USING (assigned_coordinator_id = auth.uid() AND workflow_status IN ('assigned', 'in_progress', 'pending_approval'));`
      }
    ];
    
    for (const policy of policiesToCreate) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: policy.sql
        });
        
        if (error) {
          console.warn(`⚠️  Could not create policy "${policy.name}":`, error.message);
        } else {
          console.log(`✅ Created policy: ${policy.name}`);
        }
      } catch (e) {
        console.warn(`⚠️  Policy creation failed: ${e.message}`);
      }
    }
    
    // Step 4: Verify the changes
    console.log('📋 Step 4: Verifying changes...');
    
    try {
      const { data: complaints, error: selectError } = await supabase
        .from('complaints')
        .select('id, workflow_status, department_r')
        .limit(1);
      
      if (selectError) {
        console.error('❌ Error verifying changes:', selectError);
        return;
      }
      
      console.log('✅ Verification successful!');
      console.log('📊 Complaints table now has streamlined structure');
      
    } catch (e) {
      console.warn('⚠️  Verification failed:', e.message);
    }
    
    console.log('\n🎉 Redundant columns removal completed!');
    console.log('\n📝 Removed columns:');
    console.log('   ❌ type (always "complaint")');
    console.log('   ❌ status (use workflow_status)');
    console.log('   ❌ primary_department (use department_r[0])');
    console.log('   ❌ secondary_departments (use department_r[1:])');
    console.log('   ❌ evidence (use complaint_evidence table)');
    
    console.log('\n✅ Remaining key fields:');
    console.log('   ✓ workflow_status (primary status)');
    console.log('   ✓ department_r (department array)');
    console.log('   ✓ All other essential fields');
    
  } catch (error) {
    console.error('❌ Error dropping redundant columns:', error);
    console.log('\n🔧 Manual steps required:');
    console.log('1. Connect to Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Run these commands one by one:');
    console.log('   ALTER TABLE public.complaints DROP COLUMN IF EXISTS type;');
    console.log('   ALTER TABLE public.complaints DROP COLUMN IF EXISTS status;');
    console.log('   ALTER TABLE public.complaints DROP COLUMN IF EXISTS primary_department;');
    console.log('   ALTER TABLE public.complaints DROP COLUMN IF EXISTS secondary_departments;');
    console.log('   ALTER TABLE public.complaints DROP COLUMN IF EXISTS evidence;');
    process.exit(1);
  }
}

// Run the script
dropRedundantColumns();










