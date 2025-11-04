#!/usr/bin/env node

/**
 * Migration Script: Add Missing NGA Departments
 * This script adds the 5 missing NGA departments to reach 22 total departments
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting migration: Add Missing NGA Departments...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add_missing_nga_departments.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration by running each INSERT statement
    const insertStatements = [
      {
        name: 'Department of Education – Digos City Division',
        code: 'DEPED',
        description: 'Educational services and support',
        level: 'NGA',
        contact_info: '{"email":"deped.digos@deped.gov.ph","phone":"(082) 553-1251"}',
        response_time_hours: 48,
        escalation_time_hours: 96
      },
      {
        name: 'DENR – CENRO Digos',
        code: 'DENR',
        description: 'Environmental regulation and compliance',
        level: 'NGA',
        contact_info: '{"email":"cenro.digos@denr.gov.ph","phone":"(082) 553-1252"}',
        response_time_hours: 48,
        escalation_time_hours: 96
      },
      {
        name: 'Department of Trade and Industry – Digos',
        code: 'DTI',
        description: 'Business regulation and trade services',
        level: 'NGA',
        contact_info: '{"email":"dti.digos@dti.gov.ph","phone":"(082) 553-1253"}',
        response_time_hours: 24,
        escalation_time_hours: 48
      },
      {
        name: 'Land Transportation Office – Digos',
        code: 'LTO',
        description: 'Vehicle registration and transport licensing',
        level: 'NGA',
        contact_info: '{"email":"lto.digos@lto.gov.ph","phone":"(082) 553-1254"}',
        response_time_hours: 12,
        escalation_time_hours: 24
      },
      {
        name: 'Department of Labor and Employment – Digos',
        code: 'DOLE',
        description: 'Labor regulation and employment services',
        level: 'NGA',
        contact_info: '{"email":"dole.digos@dole.gov.ph","phone":"(082) 553-1255"}',
        response_time_hours: 24,
        escalation_time_hours: 48
      }
    ];

    console.log('📝 Adding 5 missing NGA departments...');
    
    for (const dept of insertStatements) {
      const { data, error } = await supabase
        .from('departments')
        .upsert({
          name: dept.name,
          code: dept.code,
          description: dept.description,
          level: dept.level,
          contact_info: dept.contact_info,
          response_time_hours: dept.response_time_hours,
          escalation_time_hours: dept.escalation_time_hours,
          is_active: true
        }, {
          onConflict: 'code'
        });
      
      if (error) {
        console.error(`❌ Failed to add ${dept.name}:`, error);
        process.exit(1);
      }
      
      console.log(`✅ Added: ${dept.name} (${dept.code})`);
    }
    
    // Verify the results
    const { data: departments, error: countError } = await supabase
      .from('departments')
      .select('id, name, code, level, is_active')
      .eq('is_active', true)
      .order('level', { ascending: true })
      .order('name');
    
    if (countError) {
      console.error('❌ Failed to verify departments:', countError);
      process.exit(1);
    }
    
    const lguCount = departments.filter(d => d.level === 'LGU').length;
    const ngaCount = departments.filter(d => d.level === 'NGA').length;
    const totalCount = departments.length;
    
    console.log('\n📊 Migration Results:');
    console.log(`   LGU Departments: ${lguCount}`);
    console.log(`   NGA Departments: ${ngaCount}`);
    console.log(`   Total Departments: ${totalCount}`);
    
    if (totalCount === 22) {
      console.log('\n✅ SUCCESS: Migration completed successfully!');
      console.log('   All 22 departments are now available in the complaint form.');
    } else {
      console.log('\n⚠️  WARNING: Expected 22 departments, found', totalCount);
    }
    
    console.log('\n📋 Department List:');
    departments.forEach((dept, index) => {
      console.log(`   ${index + 1}. ${dept.name} (${dept.code}) - ${dept.level}`);
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
