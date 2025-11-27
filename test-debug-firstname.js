const { promises: fs } = require('fs');

async function debugFirstName() {
  const content = await fs.readFile('philid-full-output.txt', 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('=== DEBUGGING FIRST NAME EXTRACTION ===\n');
  
  console.log('Line 9:', JSON.stringify(lines[9]));
  console.log('Line 10:', JSON.stringify(lines[10]));
  
  const line = lines[9];
  const label = 'Mga Pangalan';
  const labelUpper = label.toUpperCase();
  const labelRegex = new RegExp(`(^|[^A-Z])${labelUpper.replace(/\s+/g, '\\s+')}($|[^A-Z])`, 'i');
  
  console.log('\nRegex test:', labelRegex.test(line));
  
  if (labelRegex.test(line)) {
    const match = line.match(labelRegex);
    console.log('Match:', match[0]);
    const labelEndIndex = match.index + match[0].length - (match[2] ? 1 : 0);
    let value = line.substring(labelEndIndex).replace(/[:.\\/]/g, '').trim();
    console.log('Value on same line:', JSON.stringify(value));
    
    const labelKeywords = ['LAST', 'NAME', 'FIRST', 'GIVEN', 'MIDDLE', 'NAMES', 'PANGALAN', 'APILYEDO', 'APELYIDO', 'GITNANG'];
    const valueWords = value.toUpperCase().split(/\s+/);
    const hasLabelKeyword = valueWords.some(w => labelKeywords.includes(w));
    console.log('Has label keyword:', hasLabelKeyword);
    
    if (value.length < 2 || hasLabelKeyword) {
      value = lines[10].trim();
      console.log('Using next line:', JSON.stringify(value));
    }
    
    console.log('\nCleaning value...');
    let cleaned = value.replace(/[^A-Z0-9\s.-]/gi, '').trim();
    console.log('After removing special chars:', JSON.stringify(cleaned));
    
    cleaned = cleaned.replace(/^(oy|Yr|sh|w|a|i|d|v|J|ju|fa|Ra|pn)\s+/i, '').trim();
    console.log('After removing leading noise:', JSON.stringify(cleaned));
    
    cleaned = cleaned.replace(/\s+(Yr|oy|sh|w|a|i|d|v|J)$/i, '').trim();
    console.log('After removing trailing noise:', JSON.stringify(cleaned));
    
    cleaned = cleaned.replace(/\s+\d+$/g, '').trim();
    console.log('After removing trailing digits:', JSON.stringify(cleaned));
    
    console.log('\nPattern test:');
    const pattern = /^[A-Z\s.-]+$/;
    console.log('Pattern:', pattern);
    console.log('Cleaned value:', JSON.stringify(cleaned));
    console.log('Cleaned uppercase:', JSON.stringify(cleaned.toUpperCase()));
    console.log('Matches:', pattern.test(cleaned.toUpperCase()));
  }
}

debugFirstName().catch(console.error);
