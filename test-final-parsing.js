const { promises: fs } = require('fs');

function findFieldByLabel(lines, labels, valuePattern = null) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const label of labels) {
      const labelUpper = label.toUpperCase();
      const labelRegex = new RegExp(`(^|[^A-Z])${labelUpper.replace(/\s+/g, '\\s+')}($|[^A-Z])`, 'i');
      
      if (labelRegex.test(line)) {
        const match = line.match(labelRegex);
        const labelEndIndex = match.index + match[0].length - (match[2] ? 1 : 0);
        let value = line.substring(labelEndIndex).replace(/[:.\\/]/g, '').trim();
        
        const labelKeywords = ['LAST', 'NAME', 'FIRST', 'GIVEN', 'MIDDLE', 'NAMES', 'PANGALAN', 'APILYEDO', 'APELYIDO', 'GITNANG'];
        const valueWords = value.toUpperCase().split(/\s+/);
        const hasLabelKeyword = valueWords.some(w => labelKeywords.includes(w));
        
        if ((value.length < 2 || hasLabelKeyword) && i + 1 < lines.length) {
           value = lines[i + 1].trim();
        }
        
        // Clean first
        let cleaned = value.replace(/[^A-Z0-9\s.-]/gi, '').trim();
        cleaned = cleaned.replace(/^(oy|Yr|sh|w|a|i|d|v|J|ju|fa|Ra|pn)\s+/i, '').trim();
        cleaned = cleaned.replace(/\s+(Yr|oy|sh|w|a|i|d|v|J)$/i, '').trim();
        cleaned = cleaned.replace(/\s+\d+$/g, '').trim();
        
        // IMPORTANT: Test CLEANED and UPPERCASED value
        if (valuePattern && !valuePattern.test(cleaned.toUpperCase())) {
          console.log(`  [Line ${i}] Found label "${label}" but cleaned value "${cleaned}" doesn't match pattern, continuing...`);
          continue;
        }
        
        console.log(`  [Line ${i}] ✓ Found "${label}" → Value: "${cleaned}"`);
        return cleaned;
      }
    }
  }
  return null;
}

async function testFinal() {
  const content = await fs.readFile('philid-full-output.txt', 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('=== FINAL TEST WITH UPPERCASE PATTERN FIX ===\n');
  
  console.log('Searching for Last Name...');
  const lastName = findFieldByLabel(lines, ['Apelyido', 'Apilyedo', 'Apalyida', 'Apalyido', 'Last Name'], /^[A-Z\s.-]+$/);
  
  console.log('\nSearching for First Name...');
  const firstName = findFieldByLabel(lines, ['Mga Pangalan', 'Given Names', 'Pangalan'], /^[A-Z\s.-]+$/);
  
  console.log('\nSearching for Middle Name...');
  const middleName = findFieldByLabel(lines, ['Gitnang Apelyido', 'Gitnang Apilyedo', 'witnang', 'Middle Name'], /^[A-Z\s.-]+$/);
  
  console.log('\nSearching for Birth Date...');
  const birthDate = findFieldByLabel(lines, ['Petsa ng Kapanganakan', 'Date of Birth', 'falsa ng']);
  
  console.log('\nSearching for Address...');
  const address = findFieldByLabel(lines, ['Tirahan', 'Address', 'Nrahan']);
  
  console.log('\n=== RESULTS ===');
  console.log('Last Name:', lastName || 'NOT FOUND');
  console.log('First Name:', firstName || 'NOT FOUND');
  console.log('Middle Name:', middleName || 'NOT FOUND');
  console.log('Birth Date:', birthDate || 'NOT FOUND');
  console.log('Address:', address || 'NOT FOUND');
  
  console.log('\n=== VERIFICATION ===');
  console.log(lastName === 'GO' ? '✅' : '❌', 'Last Name:', lastName, '(expected: GO)');
  console.log(firstName === 'PYRRHUS ELCID' ? '✅' : '❌', 'First Name:', firstName, '(expected: PYRRHUS ELCID)');
  console.log(middleName === 'SALLA' ? '✅' : '❌', 'Middle Name:', middleName, '(expected: SALLA)');
  console.log(birthDate?.includes('JULY 14') ? '✅' : '❌', 'Birth Date:', birthDate, '(expected: JULY 14, 2004)');
  console.log(address?.includes('ACACIAHAN') ? '✅' : '❌', 'Address:', address, '(expected to contain: ACACIAHAN)');
}

testFinal().catch(console.error);
