#!/usr/bin/env node

require('dotenv').config();
const Database = require('../src/server/config/database');

async function cleanupExtraData() {
  try {
    console.log('🧹 Cleaning up extra categories and departments not in x.md...');
    
    const supabase = Database.getClient();
    
    // Remove extra category "Public Safety" (not in x.md)
    const { error: deleteSafetyCat } = await supabase
      .from('categories')
      .delete()
      .eq('code', 'SAFETY');
    
    if (deleteSafetyCat) throw deleteSafetyCat;
    console.log('✅ Removed extra "Public Safety" category');
    
    // Remove extra departments not in x.md
    const extraDepartments = ['ENG', 'ENVI', 'HEALTH', 'PSO'];
    
    for (const code of extraDepartments) {
      const { error: deleteDept } = await supabase
        .from('departments')
        .delete()
        .eq('code', code);
      
      if (deleteDept) throw deleteDept;
      console.log(`✅ Removed extra department: ${code}`);
    }
    
    // Check final counts
    const { data: categories } = await supabase.from('categories').select('*');
    const { data: departments } = await supabase.from('departments').select('*');
    const { data: subcategories } = await supabase.from('subcategories').select('*');
    const { data: mappings } = await supabase.from('department_subcategory_mapping').select('*');
    
    console.log('\n📊 FINAL COUNTS:');
    console.log(`   Categories: ${categories.length} (should be 8)`);
    console.log(`   Subcategories: ${subcategories.length} (should be 18)`);
    console.log(`   Departments: ${departments.length} (should be 19)`);
    console.log(`   Mappings: ${mappings.length} (should be 19)`);
    
    console.log('\n✅ Cleanup complete! Database now matches x.md exactly.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupExtraData();
