#!/usr/bin/env node

require('dotenv').config();
const Database = require('../src/server/config/database');

async function checkImplementation() {
  try {
    const supabase = Database.getClient();
    
    console.log('🔍 Checking current database implementation vs x.md...\n');
    
    // Check categories
    const { data: categories } = await supabase.from('categories').select('*').order('name');
    console.log('📊 CATEGORIES:');
    categories.forEach(cat => console.log(`   ${cat.name} (${cat.code})`));
    
    // Check subcategories
    const { data: subcategories } = await supabase.from('subcategories').select('*').order('name');
    console.log('\n📋 SUBCATEGORIES:');
    subcategories.forEach(sub => console.log(`   ${sub.name} (${sub.code})`));
    
    // Check departments
    const { data: departments } = await supabase.from('departments').select('*').order('name');
    console.log('\n🏢 DEPARTMENTS:');
    departments.forEach(dept => console.log(`   ${dept.name} (${dept.code})`));
    
    // Check mappings
    const { data: mappings } = await supabase
      .from('department_subcategory_mapping')
      .select(`
        departments(name, code),
        subcategories(name, code)
      `);
    console.log('\n🔗 MAPPINGS:');
    mappings.forEach(m => console.log(`   ${m.departments.name} → ${m.subcategories.name}`));
    
    console.log('\n📈 SUMMARY:');
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Subcategories: ${subcategories.length}`);
    console.log(`   Departments: ${departments.length}`);
    console.log(`   Mappings: ${mappings.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkImplementation();
