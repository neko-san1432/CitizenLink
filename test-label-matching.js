const { promises: fs } = require('fs');

// Read the full OCR output
async function analyzeLabelMatching() {
  const content = await fs.readFile('philid-full-output.txt', 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('=== ANALYZING LABEL MATCHING ===\n');
  
  // Show lines around name fields
  console.log('Lines 6-14 (Name section):');
  for (let i = 6; i <= 14; i++) {
    if (lines[i]) {
      console.log(`[${i.toString().padStart(2, '0')}] "${lines[i]}"`);
    }
  }
  
  // Test label matching manually
  console.log('\n=== MANUAL LABEL TESTS ===\n');
  
  const testLabels = [
    { line: lines[7], label: 'Apalyida', expected: 'Last Name label' },
    { line: lines[9], label: 'Mga Pangalan', expected: 'First Name label' },
    { line: lines[11], label: 'Gitnang Apelyido', expected: 'Middle Name label' },
  ];
  
  testLabels.forEach(test => {
    console.log(`Line: "${test.line}"`);
    console.log(`Looking for: "${test.label}"`);
    console.log(`Expected: ${test.expected}`);
    console.log(`Contains label: ${test.line.toUpperCase().includes(test.label.toUpperCase())}`);
    console.log('');
  });
  
  // Check what comes after labels
  console.log('=== VALUES AFTER LABELS ===\n');
  
  const labelPatterns = [
    { pattern: /Apalyida|Last\s+Name|Apilyedo/i, name: 'Last Name' },
    { pattern: /Mga\s+Pangalan|Given\s+Names/i, name: 'First Name' },
    { pattern: /Gitnang|Middle\s+Name/i, name: 'Middle Name' },
    { pattern: /Petsa\s+ng|Date\s+of\s+Birth/i, name: 'Birth Date' },
    { pattern: /Tirahan|Address/i, name: 'Address' }
  ];
  
  labelPatterns.forEach(({ pattern, name }) => {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        console.log(`${name} label found at line ${i}: "${lines[i]}"`);
        if (i + 1 < lines.length) {
          console.log(`  Next line [${i+1}]: "${lines[i+1]}"`);
        }
        console.log('');
        break;
      }
    }
  });
}

analyzeLabelMatching().catch(console.error);
