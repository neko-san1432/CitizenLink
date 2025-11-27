const { promises: fs } = require('fs');

// Simulate the findFieldByLabel function
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function findFieldByLabel(lines, labels, valuePattern = null) {
  console.log(`\n--- Searching for labels: ${labels.join(', ')} ---`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const label of labels) {
      const words = line.split(/\s+/);
      const labelWords = label.split(/\s+/);
      
      if (words.length < labelWords.length) continue;
      
      const potentialLabel = words.slice(0, labelWords.length).join(' ');
      
      const distance = levenshteinDistance(potentialLabel.toUpperCase(), label.toUpperCase());
      const similarity = 1 - (distance / Math.max(potentialLabel.length, label.length));
      
      if (similarity >= 0.8) {
        console.log(`  ✓ Found label at line ${i}: "${line}"`);
        console.log(`    Matched "${potentialLabel}" with "${label}" (similarity: ${(similarity * 100).toFixed(1)}%)`);
        
        let value = line.substring(potentialLabel.length).replace(/[:.]/g, '').trim();
        
        if (value.length < 2 && i + 1 < lines.length) {
          value = lines[i + 1].trim();
          console.log(`    Value on next line [${i+1}]: "${value}"`);
        } else {
          console.log(`    Value on same line: "${value}"`);
        }
        
        if (valuePattern && !valuePattern.test(value)) {
          console.log(`    ❌ Value doesn't match pattern, continuing...`);
          continue;
        }
        
        let cleaned = value.replace(/[^A-Z0-9\s.-]/gi, '').trim();
        cleaned = cleaned.replace(/^(oy|Yr|sh|py|w|a|i|d|v|J|ju|fa|Ra|pn)\s*/i, '').trim();
        cleaned = cleaned.replace(/\s*(Yr|oy|sh|py|w|a|i|d|v|J)$/i, '').trim();
        
        console.log(`    Cleaned value: "${cleaned}"`);
        return cleaned;
      }
    }
  }
  
  console.log(`  ❌ No matching label found`);
  return null;
}

async function debugLabelMatching() {
  const content = await fs.readFile('philid-full-output.txt', 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('=== DEBUGGING LABEL MATCHING ===');
  console.log(`Total lines: ${lines.length}\n`);
  
  // Show first 20 lines
  console.log('First 20 lines:');
  lines.slice(0, 20).forEach((line, idx) => {
    console.log(`[${idx.toString().padStart(2, '0')}] "${line}"`);
  });
  
  // Test label matching
  const lastName = findFieldByLabel(lines, ['Apelyido', 'Apilyedo', 'Apalyida', 'Apalyido', 'Last Name', 'Last Narne'], /^[A-Z\s.-]+$/);
  const firstName = findFieldByLabel(lines, ['Mga Pangalan', 'Given Names', 'Given Narnes', 'Pangalan'], /^[A-Z\s.-]+$/);
  const middleName = findFieldByLabel(lines, ['Gitnang Apelyido', 'Gitnang Apilyedo', 'witnang', 'Middle Name', 'Middle Narne'], /^[A-Z\s.-]+$/);
  const birthDate = findFieldByLabel(lines, ['Petsa ng Kapanganakan', 'Date of Birth']);
  const address = findFieldByLabel(lines, ['Tirahan', 'Address']);
  
  console.log('\n=== FINAL RESULTS ===');
  console.log('Last Name:', lastName || 'NOT FOUND');
  console.log('First Name:', firstName || 'NOT FOUND');
  console.log('Middle Name:', middleName || 'NOT FOUND');
  console.log('Birth Date:', birthDate || 'NOT FOUND');
  console.log('Address:', address || 'NOT FOUND');
}

debugLabelMatching().catch(console.error);
