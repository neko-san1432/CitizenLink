const { promises: fs } = require('fs');

async function debugRegexMatching() {
  const content = await fs.readFile('philid-full-output.txt', 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('=== DEBUGGING REGEX MATCHING ===\n');
  
  // Test the regex on specific lines
  const testCases = [
    { line: lines[7], label: 'Apalyida', expected: true },
    { line: lines[7], label: 'Last Name', expected: true },
    { line: lines[9], label: 'Mga Pangalan', expected: true },
    { line: lines[9], label: 'Given Names', expected: true },
    { line: lines[11], label: 'witnang', expected: true },
    { line: lines[11], label: 'Middle Name', expected: true },
    { line: lines[11], label: 'Last Name', expected: false }, // Should NOT match
  ];
  
  testCases.forEach(({ line, label, expected }) => {
    const labelUpper = label.toUpperCase();
    const labelRegex = new RegExp(`(^|[^A-Z])${labelUpper.replace(/\s+/g, '\\s+')}($|[^A-Z])`, 'i');
    const matches = labelRegex.test(line);
    const status = matches === expected ? '✅' : '❌';
    
    console.log(`${status} Line: "${line}"`);
    console.log(`   Label: "${label}"`);
    console.log(`   Regex: ${labelRegex}`);
    console.log(`   Matches: ${matches} (expected: ${expected})`);
    
    if (matches) {
      const match = line.match(labelRegex);
      console.log(`   Match: "${match[0]}" at index ${match.index}`);
    }
    console.log('');
  });
  
  // Now test the full search for "Last Name"
  console.log('\n=== SEARCHING FOR "Last Name" IN ALL LINES ===\n');
  const labels = ['Apelyido', 'Apilyedo', 'Apalyida', 'Apalyido', 'Last Name'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const label of labels) {
      const labelUpper = label.toUpperCase();
      const labelRegex = new RegExp(`(^|[^A-Z])${labelUpper.replace(/\s+/g, '\\s+')}($|[^A-Z])`, 'i');
      
      if (labelRegex.test(line)) {
        console.log(`Found "${label}" at line ${i}: "${line}"`);
        const match = line.match(labelRegex);
        console.log(`  Match: "${match[0]}" at index ${match.index}`);
        console.log(`  Next line [${i+1}]: "${lines[i+1] || 'N/A'}"`);
        console.log('');
        break; // Found, stop searching other labels for this line
      }
    }
  }
}

debugRegexMatching().catch(console.error);
