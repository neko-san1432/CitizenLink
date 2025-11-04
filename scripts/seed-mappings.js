#!/usr/bin/env node

require('dotenv').config();
const Database = require('../src/server/config/database');

async function seedMappings() {
  try {
    console.log('🌱 Seeding department-subcategory mappings...');
    
    const supabase = Database.getClient();
    
    // Get department IDs by code
    const { data: departments, error: deptError } = await supabase
      .from('departments')      
      .select('id, code');
    
    if (deptError) throw deptError;
    
    // Get subcategory IDs by code  
    const { data: subcategories, error: subError } = await supabase
      .from('subcategories')
      .select('id, code');
    
    if (subError) throw subError;
    
    console.log('Found departments:', departments.length);
    console.log('Found subcategories:', subcategories.length);
    
    // Create mappings
    const mappings = [
      // Infrastructure subcategories
      { deptCode: 'CEO', subCode: 'ROAD_DAMAGE', isPrimary: true, priority: 1 },
      { deptCode: 'CEO', subCode: 'STREETLIGHT', isPrimary: true, priority: 1 },
      { deptCode: 'GSO', subCode: 'STREETLIGHT', isPrimary: false, priority: 2 },
      
      // Health subcategories  
      { deptCode: 'CHO', subCode: 'SANITATION', isPrimary: true, priority: 1 },
      { deptCode: 'ENRO', subCode: 'SANITATION', isPrimary: false, priority: 2 },
      
      // Environment subcategories
      { deptCode: 'ENRO', subCode: 'ILLEGAL_DUMP', isPrimary: true, priority: 1 },
      { deptCode: 'GSO', subCode: 'ILLEGAL_DUMP', isPrimary: false, priority: 2 },
      
      // Public Safety subcategories
      { deptCode: 'CDRRMO', subCode: 'TRAFFIC_OBS', isPrimary: true, priority: 1 },
      { deptCode: 'CEO', subCode: 'TRAFFIC_OBS', isPrimary: false, priority: 2 }
    ];
    
    const deptMap = new Map(departments.map(d => [d.code, d.id]));
    const subMap = new Map(subcategories.map(s => [s.code, s.id]));
    
    const insertData = mappings.map(m => ({
      department_id: deptMap.get(m.deptCode),
      subcategory_id: subMap.get(m.subCode),
      is_primary: m.isPrimary,
      response_priority: m.priority
    })).filter(m => m.department_id && m.subcategory_id);
    
    console.log('Inserting mappings:', insertData.length);
    
    const { error: insertError } = await supabase
      .from('department_subcategory_mapping')
      .upsert(insertData, { 
        onConflict: 'department_id,subcategory_id',
        ignoreDuplicates: false 
      });
    
    if (insertError) throw insertError;
    
    console.log('✅ Department-subcategory mappings seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding mappings:', error);
    process.exit(1);
  }
}

seedMappings();
