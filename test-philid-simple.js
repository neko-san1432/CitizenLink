const { promises: fs } = require('fs');
const Tesseract = require('tesseract.js');

let sharp;
try {
  sharp = require('sharp');
} catch (err) {}

async function extractPhilIdData() {
  const imagePath = 'C:\\Users\\User\\Downloads\\362142282_1351083545477868_3087288934325249736_n.jpg';
  
  console.log('Testing PhilID extraction...\n');
  
  const imageBuffer = await fs.readFile(imagePath);
  
  // Best strategy based on previous tests
  let processedBuffer = imageBuffer;
  
  if (sharp) {
    const metadata = await sharp(imageBuffer).metadata();
    const targetWidth = 3000; // Higher resolution
    const targetHeight = Math.round((metadata.height / metadata.width) * targetWidth);
    
    processedBuffer = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3
      })
      .greyscale()
      .normalize()
      .gamma(1.4)
      .sharpen({ sigma: 2.5 })
      .toBuffer();
    
    console.log(`Preprocessed to ${targetWidth}x${targetHeight}\n`);
  }
  
  // Try PSM 4 (single column)
  const result = await Tesseract.recognize(processedBuffer, 'eng', {
    options: {
      psm: 4,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/,.: ',
    }
  });
  
  const rawText = result.data.text;
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('=== EXTRACTED DATA ===\n');
  
  // ID Number
  const idMatch = rawText.match(/(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/);
  console.log('ID Number:', idMatch ? idMatch[1] : 'NOT FOUND');
  
  // Birth Date
  const dateMatch = rawText.match(/(JULY|JUNE|JANUARY|FEBRUARY|MARCH|APRIL|MAY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{1,2},?\s+\d{4}/i);
  console.log('Birth Date:', dateMatch ? dateMatch[0] : 'NOT FOUND');
  
  // Address
  const addressLines = lines.filter(l => 
    l.match(/ZONE|CITY|DAVAO|FRK|KAWAYAN/i) ||
    l.match(/^\d{4}\s+[A-Z]/i)
  );
  console.log('Address Lines:', addressLines.join(' '));
  
  // Names - find lines with only uppercase letters
  console.log('\n=== NAME EXTRACTION ===\n');
  
  const EXCLUDED = ['REPUBLIKA', 'PILIPINAS', 'PHILIPPINES', 'PAGKAKAKILANLAN', 
    'LAST', 'NAME', 'GIVEN', 'APILYEDO', 'APELYIDO', 'MGA', 'PANGALAN', 
    'GITNANG', 'MIDDLE', 'SEX', 'DATE', 'BIRTH', 'ADDRESS', 'TIRAHAN', 
    'LALAKI', 'BABAE', 'MALE', 'FEMALE', 'HALALAN', 'KOMISYON', 'PHILSYS', 
    'CARD', 'NUMBER', 'REPUBLIC', 'IDENTIFICATION', 'PETSA', 'KAPANGANAKAN', 
    'NAMES', 'VARMIE', 'NAM'];
  
  const nameLines = [];
  
  for (const line of lines) {
    // Only uppercase letters and spaces
    if (!/^[A-Z\s.-]+$/.test(line)) continue;
    
    // Remove noise
    const clean = line.replace(/[^A-Z\s]/g, '').trim();
    if (clean.length < 2) continue;
    
    // Check for excluded words
    const words = clean.split(/\s+/);
    const hasExcluded = words.some(w => EXCLUDED.includes(w));
    if (hasExcluded) continue;
    
    nameLines.push(clean);
  }
  
  console.log('Potential name lines found:', nameLines.length);
  nameLines.forEach((line, idx) => {
    console.log(`  [${idx}] ${line}`);
  });
  
  console.log('\nExtracted Names:');
  console.log('  Last Name:', nameLines[0] || 'NOT FOUND');
  console.log('  First Name:', nameLines[1] || 'NOT FOUND');
  console.log('  Middle Name:', nameLines[2] || 'NOT FOUND');
  
  console.log('\n=== ALL LINES (first 30) ===\n');
  lines.slice(0, 30).forEach((line, idx) => {
    console.log(`[${idx.toString().padStart(2, '0')}] ${line}`);
  });
  
  // Save full output
  await fs.writeFile('philid-full-output.txt', rawText);
  console.log('\nFull OCR output saved to philid-full-output.txt');
}

extractPhilIdData().catch(console.error);
