const path = require('path');
const { promises: fs } = require('fs');
const Tesseract = require('tesseract.js');

// Try to load Sharp
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.warn('[TEST] Sharp not available');
}

async function testPhilIdExtraction() {
  const imagePath = 'C:\\Users\\User\\Downloads\\362142282_1351083545477868_3087288934325249736_n.jpg';
  
  console.log('\n=== Testing Philippine National ID Extraction ===\n');
  
  try {
    // Read image
    const imageBuffer = await fs.readFile(imagePath);
    console.log(`✓ Image loaded (${(imageBuffer.length / 1024).toFixed(1)} KB)\n`);
    
    // Preprocess if Sharp is available
    let processedBuffer = imageBuffer;
    
    if (sharp) {
      console.log('[PREPROCESSING] Enhancing image...');
      const metadata = await sharp(imageBuffer).metadata();
      
      // Scale up
      const minWidth = 2000;
      const scaleFactor = metadata.width < minWidth ? minWidth / metadata.width : 1;
      const targetWidth = Math.round(metadata.width * scaleFactor);
      const targetHeight = Math.round(metadata.height * scaleFactor);
      
      processedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos3,
          fit: 'fill'
        })
        .greyscale()
        .normalize()
        .gamma(1.2)
        .sharpen({
          sigma: 2,
          m1: 0,
          m2: 0,
          x1: 0,
          y2: 10,
          y3: 20
        })
        .toBuffer();
      
      console.log(`✓ Preprocessed: ${metadata.width}x${metadata.height} → ${targetWidth}x${targetHeight}\n`);
    }
    
    // Run OCR
    console.log('[OCR] Running Tesseract...\n');
    const result = await Tesseract.recognize(processedBuffer, 'eng', {
      options: {
        psm: 6,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/,.: ',
      }
    });
    
    const confidence = result.data.confidence;
    const rawText = result.data.text;
    
    console.log('=== RAW OCR TEXT ===');
    console.log(rawText);
    console.log('\n=== OCR CONFIDENCE: ' + confidence.toFixed(2) + '% ===\n');
    
    // Parse lines
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log('=== EXTRACTED FIELDS ===\n');
    
    // ID Number
    const idMatch = rawText.match(/(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/);
    console.log('✓ ID Number:', idMatch ? idMatch[1] : '❌ NOT FOUND');
    
    // Date of Birth
    const dateMatch = rawText.match(/([A-Z]+\s+\d{1,2},?\s+\d{4})/i);
    console.log('✓ Birth Date:', dateMatch ? dateMatch[0] : '❌ NOT FOUND');
    
    // Names - look for lines that are all caps and alphabetic
    const EXCLUDED_WORDS = [
      'REPUBLIKA', 'PILIPINAS', 'PHILIPPINES', 'PAGKAKAKILANLAN', 
      'LAST', 'NAME', 'GIVEN', 'APILYEDO', 'APELYIDO', 'MGA', 'PANGALAN', 
      'GITNANG', 'MIDDLE', 'SEX', 'DATE', 'BIRTH', 'ADDRESS',
      'TIRAHAN', 'LALAKI', 'BABAE', 'MALE', 'FEMALE',
      'HALALAN', 'KOMISYON', 'PHILSYS', 'CARD', 'NUMBER',
      'REPUBLIC', 'IDENTIFICATION', 'PETSA', 'KAPANGANAKAN', 'NAMES'
    ];
    
    const nameLines = lines.filter(l => {
      const normalized = l.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
      if (normalized.length < 2) return false;
      const words = normalized.split(/\s+/);
      const hasExcluded = words.some(w => EXCLUDED_WORDS.includes(w));
      if (hasExcluded) return false;
      return /^[A-Z\s.-]+$/.test(l);
    });
    
    console.log('\n--- Potential Name Lines ---');
    nameLines.forEach((line, idx) => {
      console.log(`  [${idx}] ${line}`);
    });
    
    if (nameLines.length >= 1) console.log('\n✓ Last Name:', nameLines[0]);
    if (nameLines.length >= 2) console.log('✓ First Name:', nameLines[1]);
    if (nameLines.length >= 3) console.log('✓ Middle Name:', nameLines[2]);
    
    // Address
    const addressMatch = lines.find(l => 
      l.includes('ZONE') || 
      l.includes('CITY') || 
      l.includes('DAVAO') ||
      /\d{4}\s+[A-Z]/.test(l)
    );
    console.log('\n✓ Address:', addressMatch || '❌ NOT FOUND');
    
    console.log('\n=== ALL OCR LINES (for debugging) ===');
    lines.forEach((line, idx) => {
      console.log(`[${idx.toString().padStart(2, '0')}] ${line}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testPhilIdExtraction();
