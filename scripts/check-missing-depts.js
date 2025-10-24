#!/usr/bin/env node

require('dotenv').config();
const Database = require('../src/server/config/database');

async function checkMissing() {
  try {
    const supabase = Database.getClient();
    
    // Expected departments from x.md
    const expectedDepts = [
      'CEO', 'GSO', 'CPDC',  // Infrastructure
      'CHO', 'CSWDO', 'CDRRMO',  // Health
      'ENRO',  // Environment
      'CTO', 'CEEO',  // Licensing
      'HRMO',  // Labor
      'PNP', 'CLO', 'OCM',  // Legal
      'PAD', 'OCA', 'CIO',  // Assistance
      'CAO'  // Finance (CTO already counted above)
    ];
    
    const { data: currentDepts } = await supabase.from('departments').select('code');
    const currentCodes = currentDepts.map(d => d.code);
    
    console.log('Expected departments from x.md:');
    expectedDepts.forEach(code => console.log(`   ${code}`));
    
    console.log('\nCurrent departments in database:');
    currentCodes.forEach(code => console.log(`   ${code}`));
    
    console.log('\nMissing departments:');
    const missing = expectedDepts.filter(code => !currentCodes.includes(code));
    missing.forEach(code => console.log(`   ❌ ${code}`));
    
    console.log('\nExtra departments:');
    const extra = currentCodes.filter(code => !expectedDepts.includes(code));
    extra.forEach(code => console.log(`   ⚠️  ${code}`));
    
    console.log(`\n📊 Counts:`);
    console.log(`   Expected: ${expectedDepts.length}`);
    console.log(`   Current: ${currentCodes.length}`);
    console.log(`   Missing: ${missing.length}`);
    console.log(`   Extra: ${extra.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMissing();
