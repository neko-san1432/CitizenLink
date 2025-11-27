const { promises: fs } = require('fs');

// Copy the exact parsing logic from OCRController
function findFieldByLabel(lines, labels, valuePattern = null) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const label of labels) {
      const lineUpper = line.toUpperCase();
      const labelUpper = label.toUpperCase();
      
      // Use regex for exact contiguous match with word boundaries
      const labelRegex = new RegExp(`(^|[^A-Z])${labelUpper.replace(/\s+/g, '\\s+')}($|[^A-Z])`, 'i');
      if (labelRegex.test(line)) {
        const match = line.match(labelRegex);
        const labelEndIndex = match.index + match[0].length - (match[2] ? 1 : 0);
        let value = line.substring(labelEndIndex).replace(/[:.\\/]/g, '').trim();
        
        // Check if the value looks like it's another label
        const labelKeywords = ['LAST', 'NAME', 'FIRST', 'GIVEN', 'MIDDLE', 'NAMES', 'PANGALAN', 'APILYEDO', 'APELYIDO', 'GITNANG'];
        const valueWords = value.toUpperCase().split(/\s+/);
        const hasLabelKeyword = valueWords.some(w => labelKeywords.includes(w));
        
        // Value on next line if current value is empty or looks like a label
        if ((value.length < 2 || hasLabelKeyword) && i + 1 < lines.length) {
           value = lines[i + 1].trim();
        }
        
        // Validate value if pattern provided
        if (valuePattern && !valuePattern.test(value.toUpperCase())) {
          continue;
        }
        
        // Clean up value
        let cleaned = value.replace(/[^A-Z0-9\s.-]/gi, '').trim();
        cleaned = cleaned.replace(/^(oy|Yr|sh|py|w|a|i|d|v|J|ju|fa|Ra|pn)\s*/i, '').trim();
        cleaned = cleaned.replace(/\s*(Yr|oy|sh|py|w|a|i|d|v|J)$/i, '').trim();
        
        return { value: cleaned, lineIndex: i, nextLine: i + 1 < lines.length ? lines[i + 1] : null };
      }
    }
  }
  return null;
}

async function testDirectParsing() {
  const content = await fs.readFile('philid-full-output.txt', 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const results = {
    totalLines: lines.length,
    dataLines: lines.slice(6, 18),
    extracted: {}
  };
  
  const lastNameResult = findFieldByLabel(lines, ['Apelyido', 'Apilyedo', 'Apalyida', 'Apalyido', 'Last Name'], /^[A-Z\s.-]+$/);
  results.extracted.lastName = lastNameResult;
  
  const firstNameResult = findFieldByLabel(lines, ['Mga Pangalan', 'Given Names', 'Pangalan'], /^[A-Z\s.-]+$/);
  results.extracted.firstName = firstNameResult;
  
  const middleNameResult = findFieldByLabel(lines, ['Gitnang Apelyido', 'Gitnang Apilyedo', 'witnang', 'Middle Name'], /^[A-Z\s.-]+$/);
  results.extracted.middleName = middleNameResult;
  
  const birthDateResult = findFieldByLabel(lines, ['Petsa ng Kapanganakan', 'Date of Birth', 'falsa ng']);
  results.extracted.birthDate = birthDateResult;
  
  const addressResult = findFieldByLabel(lines, ['Tirahan', 'Address', 'Nrahan']);
  results.extracted.address = addressResult;
  
  await fs.writeFile('parse-results.json', JSON.stringify(results, null, 2));
  console.log('Results written to parse-results.json');
  console.log('\nExtracted values:');
  console.log('Last Name:', lastNameResult?.value || 'NOT FOUND');
  console.log('First Name:', firstNameResult?.value || 'NOT FOUND');
  console.log('Middle Name:', middleNameResult?.value || 'NOT FOUND');
  console.log('Birth Date:', birthDateResult?.value || 'NOT FOUND');
  console.log('Address:', addressResult?.value || 'NOT FOUND');
}

testDirectParsing().catch(console.error);
