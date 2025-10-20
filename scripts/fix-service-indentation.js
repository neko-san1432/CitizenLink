#!/usr/bin/env node

/**
 * Fix Service Files Indentation Script
 * Converts CRLF to LF and fixes indentation in all service files
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing service files indentation...\n');

const servicesDir = 'src/server/services';
const serviceFiles = [
  'ComplaintService.js',
  'CoordinatorService.js',
  'DepartmentService.js',
  'DuplicationDetectionService.js',
  'HRService.js',
  'InvitationService.js',
  'NotificationService.js',
  'RoleManagementService.js',
  'RuleBasedSuggestionService.js',
  'SettingService.js',
  'SimilarityCalculatorService.js',
  'SuperAdminService.js',
  'UserService.js'
];

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
      const line = lines[i];
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
  let successCount = 0;
  const totalCount = serviceFiles.length;
  console.log(`Found ${totalCount} service files to fix:\n`);
  
  serviceFiles.forEach(fileName => {
    const filePath = path.join(servicesDir, fileName);
    
    if (fs.existsSync(filePath)) {
      if (fixFileIndentation(filePath)) {
        successCount++;
      }
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  });
  
  console.log(`\n📊 Results:`);
  console.log(`✅ Successfully fixed: ${successCount}/${totalCount} files`);
  
  if (successCount === totalCount) {
    console.log('🎉 All service files have been fixed!');
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
