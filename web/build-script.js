import { gzipSync } from 'zlib';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Files to compress (extensions that benefit from compression)
const COMPRESSIBLE_EXTENSIONS = ['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg'];
const MIN_FILE_SIZE = 1024; // Only compress files larger than 1KB

// Directories to process
const DIRECTORIES_TO_PROCESS = [
  '.',           // Root directory
  'css',
  'js',
  'citizen',
  'lgu',
  'components',
  'superadmin'
];

function shouldCompress(filePath) {
  const ext = extname(filePath).toLowerCase();
  return COMPRESSIBLE_EXTENSIONS.includes(ext);
}

function compressFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }

    const stats = statSync(filePath);
    if (stats.size < MIN_FILE_SIZE) {
      console.log(`⏭️  Skipping small file: ${filePath} (${stats.size} bytes)`);
      return false;
    }

    const content = readFileSync(filePath);
    const compressed = gzipSync(content, { level: 6 });
    
    // Create .gz file
    const gzPath = filePath + '.gz';
    writeFileSync(gzPath, compressed);
    
    const compressionRatio = ((1 - compressed.length / content.length) * 100).toFixed(1);
    console.log(`✅ Compressed: ${filePath} (${content.length} → ${compressed.length} bytes, ${compressionRatio}% reduction)`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error compressing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dirPath) {
  const fullPath = join(__dirname, dirPath);
  
  if (!existsSync(fullPath)) {
    console.log(`⚠️  Directory not found: ${fullPath}`);
    return;
  }

  console.log(`\n📁 Processing directory: ${dirPath}`);
  
  try {
    const items = readdirSync(fullPath);
    let compressedCount = 0;
    
    for (const item of items) {
      const itemPath = join(fullPath, item);
      const relativePath = join(dirPath, item);
      
      if (statSync(itemPath).isDirectory()) {
        // Recursively process subdirectories
        processDirectory(relativePath);
      } else if (shouldCompress(itemPath)) {
        if (compressFile(itemPath)) {
          compressedCount++;
        }
      }
    }
    
    console.log(`📊 Compressed ${compressedCount} files in ${dirPath}`);
  } catch (error) {
    console.error(`❌ Error processing directory ${dirPath}:`, error.message);
  }
}

function main() {
  console.log('🚀 Starting pre-compression build process...\n');
  
  let totalCompressed = 0;
  
  for (const dir of DIRECTORIES_TO_PROCESS) {
    processDirectory(dir);
  }
  
  console.log('\n✨ Pre-compression build completed!');
  console.log('📝 Render deployment ready:');
  console.log('   1. Pre-compressed files created for optimal performance');
  console.log('   2. Server configured to serve .gz files automatically');
  console.log('   3. Fallback compression available for non-precompressed files');
  console.log('   4. Ready for Render deployment!');
}

main();
