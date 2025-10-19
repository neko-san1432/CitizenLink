#!/usr/bin/env node

/**
 * Fix All Indentation Script
 * Fixes indentation and line endings in all specified folders
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing indentation and line endings in all folders...\n');

// Define the folders to fix
const foldersToFix = [
  'src/client/admin',
  'src/client/pages/lgu', 
  'src/server/middleware',
  'src/server/models'
];

function getAllJSFiles(dir) {
  const files = [];
  
  function scanDirectory(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not scan directory ${currentDir}:`, error.message);
    }
  }
  
  scanDirectory(dir);
  return files;
}

function fixFileIndentation(filePath) {
  try {
    console.log(`📄 Processing: ${filePath}`);
    
    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Convert CRLF to LF
    content = content.replace(/\r\n/g, '\n');
    
    // Split into lines
    const lines = content.split('\n');
    const fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Remove trailing whitespace
      line = line.replace(/\s+$/, '');
      
      // Fix indentation - convert tabs to 2 spaces
      line = line.replace(/^\t+/, (match) => '  '.repeat(match.length));
      
      // Ensure consistent 2-space indentation
      const leadingSpaces = line.match(/^(\s*)/)[1];
      if (leadingSpaces) {
        // Count spaces and convert to proper 2-space indentation
        const spaceCount = leadingSpaces.length;
        const indentLevel = Math.floor(spaceCount / 2);
        line = '  '.repeat(indentLevel) + line.trim();
      }
      
      fixedLines.push(line);
    }
    
    // Join lines back together
    const fixedContent = fixedLines.join('\n') + '\n';
    
    // Write back to file
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    
    console.log(`✅ Fixed: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  let totalFiles = 0;
  let successCount = 0;
  
  console.log('📁 Scanning folders for JavaScript files...\n');
  
  for (const folder of foldersToFix) {
    if (!fs.existsSync(folder)) {
      console.log(`⚠️  Folder not found: ${folder}`);
      continue;
    }
    
    console.log(`📂 Processing folder: ${folder}`);
    const files = getAllJSFiles(folder);
    
    if (files.length === 0) {
      console.log(`   No JavaScript files found in ${folder}`);
      continue;
    }
    
    console.log(`   Found ${files.length} JavaScript files`);
    totalFiles += files.length;
    
    for (const file of files) {
      if (fixFileIndentation(file)) {
        successCount++;
      }
    }
    
    console.log('');
  }
  
  console.log('📊 Results:');
  console.log(`✅ Successfully fixed: ${successCount}/${totalFiles} files`);
  
  if (successCount === totalFiles) {
    console.log('🎉 All files have been fixed!');
    return 0;
  } else {
    console.log('⚠️  Some files could not be fixed');
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main, fixFileIndentation };
