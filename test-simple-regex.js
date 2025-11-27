// Simple regex test
const line = "Apalyida/Last Name";
const label = "Apalyida";
const labelUpper = label.toUpperCase();
const labelRegex = new RegExp(`(^|[^A-Z])${labelUpper.replace(/\s+/g, '\\s+')}($|[^A-Z])`, 'i');

console.log('Line:', line);
console.log('Label:', label);
console.log('Regex:', labelRegex);
console.log('Test result:', labelRegex.test(line));

if (labelRegex.test(line)) {
  const match = line.match(labelRegex);
  console.log('Match:', match);
  console.log('Match[0]:', match[0]);
  console.log('Match index:', match.index);
  console.log('Match[1] (prefix):', match[1]);
  console.log('Match[2] (suffix):', match[2]);
  
  const labelEndIndex = match.index + match[0].length - (match[2] ? 1 : 0);
  console.log('Label end index:', labelEndIndex);
  
  const value = line.substring(labelEndIndex);
  console.log('Value after label:', value);
}

// Now test with the pattern
const pattern = /^[A-Z\s.-]+$/;
const testValue = "oy GO |";
console.log('\nPattern test:');
console.log('Value:', testValue);
console.log('Pattern:', pattern);
console.log('Matches:', pattern.test(testValue));

const cleaned = testValue.replace(/[^A-Z0-9\s.-]/gi, '').trim();
console.log('Cleaned:', cleaned);
console.log('Cleaned matches:', pattern.test(cleaned));
