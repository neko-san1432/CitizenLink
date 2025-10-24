#!/usr/bin/env node

require('dotenv').config();
const Database = require('../src/server/config/database');

async function updateCategories() {
  try {
    console.log('🔄 Updating categories and subcategories to match x.md structure...');
    
    const supabase = Database.getClient();
    
    // First, let's see what we currently have
    const { data: currentCategories, error: catError } = await supabase
      .from('categories')
      .select('*');
    
    if (catError) throw catError;
    
    console.log('Current categories:', currentCategories.length);
    
    const { data: currentSubcategories, error: subError } = await supabase
      .from('subcategories')
      .select('*');
    
    if (subError) throw subError;
    
    console.log('Current subcategories:', currentSubcategories.length);
    
    // Update categories
    const categories = [
      { name: 'Infrastructure & Public Works', code: 'INFRA', description: 'Roads, construction, facilities, and public works' },
      { name: 'Health & Social Services', code: 'HEALTH', description: 'Public health, social welfare, and emergency response' },
      { name: 'Environment & Sanitation', code: 'ENV', description: 'Waste management, pollution, and environmental protection' },
      { name: 'Licensing, Permits & Business', code: 'LICENSE', description: 'Tax collection, permits, and economic enterprises' },
      { name: 'Labor & Employment', code: 'LABOR', description: 'Personnel management and employment services' },
      { name: 'Law Enforcement & Legal Affairs', code: 'LEGAL', description: 'Police, security, legal investigation, and executive oversight' },
      { name: 'Public Assistance & Communication', code: 'ASSISTANCE', description: 'Frontline assistance, complaint routing, and information services' },
      { name: 'Finance & Revenue', code: 'FINANCE', description: 'Tax collection and financial review services' }
    ];
    
    console.log('Upserting categories...');
    const { error: catUpsertError } = await supabase
      .from('categories')
      .upsert(categories, { onConflict: 'code' });
    
    if (catUpsertError) throw catUpsertError;
    
    // Get updated category IDs
    const { data: updatedCategories, error: updatedCatError } = await supabase
      .from('categories')
      .select('id, code');
    
    if (updatedCatError) throw updatedCatError;
    
    const categoryMap = new Map(updatedCategories.map(c => [c.code, c.id]));
    
    // Define subcategories
    const subcategories = [
      // Infrastructure & Public Works
      { category_code: 'INFRA', name: 'Roads & Construction', code: 'ROADS_CONSTRUCTION', description: 'Road damage, potholes, construction issues' },
      { category_code: 'INFRA', name: 'Facilities & Maintenance', code: 'FACILITIES_MAINTENANCE', description: 'Public building maintenance and facilities' },
      { category_code: 'INFRA', name: 'Land Use & Planning', code: 'LAND_USE_PLANNING', description: 'Zoning, land use, and development planning' },
      
      // Health & Social Services
      { category_code: 'HEALTH', name: 'Public Health', code: 'PUBLIC_HEALTH', description: 'Health services, medical concerns, disease prevention' },
      { category_code: 'HEALTH', name: 'Social Welfare', code: 'SOCIAL_WELFARE', description: 'Social services, welfare programs, community assistance' },
      { category_code: 'HEALTH', name: 'Emergency Response', code: 'EMERGENCY_RESPONSE', description: 'Disaster response, emergency services, crisis management' },
      
      // Environment & Sanitation
      { category_code: 'ENV', name: 'Waste Management', code: 'WASTE_MANAGEMENT', description: 'Garbage collection, waste disposal, recycling' },
      
      // Licensing, Permits & Business
      { category_code: 'LICENSE', name: 'Tax & Fees', code: 'TAX_FEES', description: 'Tax collection, fee payment, revenue services' },
      { category_code: 'LICENSE', name: 'Economic Enterprises', code: 'ECONOMIC_ENTERPRISES', description: 'Business permits, economic development, enterprise services' },
      
      // Labor & Employment
      { category_code: 'LABOR', name: 'Personnel & Staff', code: 'PERSONNEL_STAFF', description: 'HR services, personnel management, employment issues' },
      
      // Law Enforcement & Legal Affairs
      { category_code: 'LEGAL', name: 'Police & Security', code: 'POLICE_SECURITY', description: 'Crime reports, security concerns, law enforcement' },
      { category_code: 'LEGAL', name: 'Legal Investigation', code: 'LEGAL_INVESTIGATION', description: 'Legal matters, investigations, court proceedings' },
      { category_code: 'LEGAL', name: 'Executive Oversight', code: 'EXECUTIVE_OVERSIGHT', description: 'Mayor\'s office, executive decisions, administrative oversight' },
      
      // Public Assistance & Communication
      { category_code: 'ASSISTANCE', name: 'Frontline Assistance', code: 'FRONTLINE_ASSISTANCE', description: 'Public assistance desk, citizen services' },
      { category_code: 'ASSISTANCE', name: 'Complaint Routing', code: 'COMPLAINT_ROUTING', description: 'Complaint processing, routing, and follow-up' },
      { category_code: 'ASSISTANCE', name: 'Information & Feedback', code: 'INFORMATION_FEEDBACK', description: 'Public information, feedback, communication services' },
      
      // Finance & Revenue
      { category_code: 'FINANCE', name: 'Tax Collection', code: 'TAX_COLLECTION', description: 'Tax collection, revenue generation, financial services' },
      { category_code: 'FINANCE', name: 'Financial Review', code: 'FINANCIAL_REVIEW', description: 'Financial auditing, budget review, accounting services' }
    ];
    
    // Prepare subcategories with category_id
    const subcategoriesWithIds = subcategories.map(sub => ({
      category_id: categoryMap.get(sub.category_code),
      name: sub.name,
      code: sub.code,
      description: sub.description
    }));
    
    console.log('Upserting subcategories...');
    // First, delete existing subcategories to avoid conflicts
    const { error: deleteError } = await supabase
      .from('subcategories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all existing
    
    if (deleteError) throw deleteError;
    
    // Then insert new subcategories
    const { error: subInsertError } = await supabase
      .from('subcategories')
      .insert(subcategoriesWithIds);
    
    if (subInsertError) throw subInsertError;
    
    // Get updated subcategory IDs
    const { data: updatedSubcategories, error: updatedSubError } = await supabase
      .from('subcategories')
      .select('id, code');
    
    if (updatedSubError) throw updatedSubError;
    
    const subcategoryMap = new Map(updatedSubcategories.map(s => [s.code, s.id]));
    
    // Get department IDs
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, code');
    
    if (deptError) throw deptError;
    
    const departmentMap = new Map(departments.map(d => [d.code, d.id]));
    
    // Define mappings
    const mappings = [
      // Infrastructure & Public Works
      { deptCode: 'CEO', subCode: 'ROADS_CONSTRUCTION', isPrimary: true, priority: 1 },
      { deptCode: 'CEO', subCode: 'FACILITIES_MAINTENANCE', isPrimary: false, priority: 2 },
      { deptCode: 'GSO', subCode: 'FACILITIES_MAINTENANCE', isPrimary: true, priority: 1 },
      { deptCode: 'CPDC', subCode: 'LAND_USE_PLANNING', isPrimary: true, priority: 1 },
      
      // Health & Social Services
      { deptCode: 'CHO', subCode: 'PUBLIC_HEALTH', isPrimary: true, priority: 1 },
      { deptCode: 'CSWDO', subCode: 'SOCIAL_WELFARE', isPrimary: true, priority: 1 },
      { deptCode: 'CDRRMO', subCode: 'EMERGENCY_RESPONSE', isPrimary: true, priority: 1 },
      
      // Environment & Sanitation
      { deptCode: 'ENRO', subCode: 'WASTE_MANAGEMENT', isPrimary: true, priority: 1 },
      
      // Licensing, Permits & Business
      { deptCode: 'CTO', subCode: 'TAX_FEES', isPrimary: true, priority: 1 },
      { deptCode: 'CEEO', subCode: 'ECONOMIC_ENTERPRISES', isPrimary: true, priority: 1 },
      
      // Labor & Employment
      { deptCode: 'HRMO', subCode: 'PERSONNEL_STAFF', isPrimary: true, priority: 1 },
      
      // Law Enforcement & Legal Affairs
      { deptCode: 'PNP', subCode: 'POLICE_SECURITY', isPrimary: true, priority: 1 },
      { deptCode: 'CLO', subCode: 'LEGAL_INVESTIGATION', isPrimary: true, priority: 1 },
      { deptCode: 'OCM', subCode: 'EXECUTIVE_OVERSIGHT', isPrimary: true, priority: 1 },
      
      // Public Assistance & Communication
      { deptCode: 'PAD', subCode: 'FRONTLINE_ASSISTANCE', isPrimary: true, priority: 1 },
      { deptCode: 'OCA', subCode: 'COMPLAINT_ROUTING', isPrimary: true, priority: 1 },
      { deptCode: 'CIO', subCode: 'INFORMATION_FEEDBACK', isPrimary: true, priority: 1 },
      
      // Finance & Revenue
      { deptCode: 'CTO', subCode: 'TAX_COLLECTION', isPrimary: true, priority: 1 },
      { deptCode: 'CAO', subCode: 'FINANCIAL_REVIEW', isPrimary: true, priority: 1 }
    ];
    
    // Prepare mapping data
    const mappingData = mappings.map(m => ({
      department_id: departmentMap.get(m.deptCode),
      subcategory_id: subcategoryMap.get(m.subCode),
      is_primary: m.isPrimary,
      response_priority: m.priority
    })).filter(m => m.department_id && m.subcategory_id);
    
    console.log('Upserting department-subcategory mappings...');
    const { error: mappingError } = await supabase
      .from('department_subcategory_mapping')
      .upsert(mappingData, { 
        onConflict: 'department_id,subcategory_id',
        ignoreDuplicates: false 
      });
    
    if (mappingError) throw mappingError;
    
    console.log('✅ Categories and subcategories updated successfully!');
    console.log(`📊 Final counts:`);
    console.log(`   - Categories: ${categories.length}`);
    console.log(`   - Subcategories: ${subcategories.length}`);
    console.log(`   - Mappings: ${mappingData.length}`);
    
  } catch (error) {
    console.error('❌ Error updating categories:', error);
    process.exit(1);
  }
}

updateCategories();
