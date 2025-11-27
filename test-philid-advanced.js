const { promises: fs } = require('fs');
const Tesseract = require('tesseract.js');

let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.warn('[TEST] Sharp not available');
}

async function testMultipleStrategies() {
  const imagePath = 'C:\\Users\\User\\Downloads\\362142282_1351083545477868_3087288934325249736_n.jpg';
  
  console.log('\n=== Testing Multiple OCR Strategies ===\n');
  
  const imageBuffer = await fs.readFile(imagePath);
  
  // Strategy 1: Standard preprocessing with PSM 6
  console.log('[STRATEGY 1] Standard preprocessing + PSM 6');
  await testStrategy(imageBuffer, {
    name: 'Standard',
    psm: 6,
    scale: 2000,
    gamma: 1.2,
    sharpen: true
  });
  
  // Strategy 2: Higher resolution with PSM 4
  console.log('\n[STRATEGY 2] Higher resolution + PSM 4');
  await testStrategy(imageBuffer, {
    name: 'HighRes',
    psm: 4,
    scale: 3000,
    gamma: 1.3,
    sharpen: true
  });
  
  // Strategy 3: Aggressive sharpening
  console.log('\n[STRATEGY 3] Aggressive preprocessing + PSM 6');
  await testStrategy(imageBuffer, {
    name: 'Aggressive',
    psm: 6,
    scale: 2500,
    gamma: 1.5,
    sharpen: true,
    threshold: 128
  });
}

async function testStrategy(imageBuffer, config) {
  try {
    let processedBuffer = imageBuffer;
    
    if (sharp) {
      const metadata = await sharp(imageBuffer).metadata();
      const scaleFactor = config.scale / metadata.width;
      const targetWidth = Math.round(metadata.width * scaleFactor);
      const targetHeight = Math.round(metadata.height * scaleFactor);
      
      let pipeline = sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos3,
          fit: 'fill'
        })
        .greyscale()
        .normalize()
        .gamma(config.gamma);
      
      if (config.sharpen) {
        pipeline = pipeline.sharpen({ sigma: 3 });
      }
      
      if (config.threshold) {
        pipeline = pipeline.threshold(config.threshold);
      }
      
      processedBuffer = await pipeline.toBuffer();
      console.log(`  Preprocessed: ${metadata.width}x${metadata.height} → ${targetWidth}x${targetHeight}`);
    }
    
    const result = await Tesseract.recognize(processedBuffer, 'eng', {
      options: {
        psm: config.psm,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/,.: ',
      }
    });
    
    const confidence = result.data.confidence;
    const rawText = result.data.text;
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log(`  Confidence: ${confidence.toFixed(2)}%`);
    
    // Extract fields
    const idMatch = rawText.match(/(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/);
    const dateMatch = rawText.match(/([A-Z]+\s+\d{1,2},?\s+\d{4})/i);
    
    // Find name lines
    const EXCLUDED_WORDS = [
      'REPUBLIKA', 'PILIPINAS', 'PHILIPPINES', 'PAGKAKAKILANLAN', 
      'LAST', 'NAME', 'GIVEN', 'APILYEDO', 'APELYIDO', 'MGA', 'PANGALAN', 
      'GITNANG', 'MIDDLE', 'SEX', 'DATE', 'BIRTH', 'ADDRESS',
      'TIRAHAN', 'LALAKI', 'BABAE', 'MALE', 'FEMALE',
      'HALALAN', 'KOMISYON', 'PHILSYS', 'CARD', 'NUMBER',
      'REPUBLIC', 'IDENTIFICATION', 'PETSA', 'KAPANGANAKAN', 'NAMES', 'VARMIE', 'NAM'
    ];
    
    const nameLines = lines.filter(l => {
      const normalized = l.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
      if (normalized.length < 2) return false;
      const words = normalized.split(/\s+/);
      const hasExcluded = words.some(w => EXCLUDED_WORDS.includes(w));
      if (hasExcluded) return false;
      return /^[A-Z\s.-]+$/.test(l);
    });
    
    const addressMatch = lines.find(l => 
      l.includes('ZONE') || 
      l.includes('CITY') || 
      l.includes('DAVAO') ||
      /\d{4}\s+[A-Z]/.test(l)
    );
    
    console.log('  Fields extracted:');
    console.log('    ID Number:', idMatch ? idMatch[1] : '❌');
    console.log('    Last Name:', nameLines[0] || '❌');
    console.log('    First Name:', nameLines[1] || '❌');
    console.log('    Middle Name:', nameLines[2] || '❌');
    console.log('    Birth Date:', dateMatch ? dateMatch[0] : '❌');
    console.log('    Address:', addressMatch || '❌');
    
    // Show all lines for debugging
    console.log('  All lines:');
    lines.forEach((line, idx) => {
      console.log(`    [${idx.toString().padStart(2, '0')}] ${line}`);
    });
    
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

testMultipleStrategies();
