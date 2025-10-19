#!/usr/bin/env node

/**
 * Advanced Code Cleanup Script
 * Performs deep code analysis and optimization
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Advanced Code Cleanup');
console.log('========================\n');

class AdvancedCleanup {
  constructor() {
    this.duplicates = [];
    this.unusedImports = [];
    this.optimizations = [];
    this.removedFiles = [];
    this.consolidatedFiles = [];
  }

  async run() {
    console.log('🔍 Starting advanced cleanup...\n');

    // Find and remove duplicate utility functions
    await this.consolidateUtilityFunctions();
    
    // Remove unused imports
    await this.removeUnusedImports();
    
    // Optimize CSS files
    await this.optimizeCSSFiles();
    
    // Optimize JavaScript files
    await this.optimizeJSFiles();
    
    // Remove empty files and directories
    await this.removeEmptyFiles();
    
    // Generate report
    this.generateReport();
  }

  async consolidateUtilityFunctions() {
    console.log('🔧 Consolidating utility functions...');
    
    // Check for duplicate validation functions
    const validationFiles = [
      'src/client/utils/validation.js',
      'src/shared/utils.js'
    ];

    const existingFiles = validationFiles.filter(file => fs.existsSync(file));
    
    if (existingFiles.length > 1) {
      // Keep the most comprehensive one and remove duplicates
      const mainFile = existingFiles[0];
      const duplicateFiles = existingFiles.slice(1);
      
      for (const duplicateFile of duplicateFiles) {
        try {
          fs.unlinkSync(duplicateFile);
          this.removedFiles.push(duplicateFile);
          console.log(`   ✅ Removed duplicate: ${duplicateFile}`);
        } catch (error) {
          console.warn(`   ⚠️  Could not remove: ${duplicateFile}`);
        }
      }
    }
  }

  async removeUnusedImports() {
    console.log('📦 Removing unused imports...');
    
    const jsFiles = this.getFilesRecursively('src');
    
    for (const file of jsFiles) {
      if (file.endsWith('.js')) {
        await this.cleanFileImports(file);
      }
    }
  }

  async cleanFileImports(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const originalLength = lines.length;
      
      // Remove empty import lines
      const cleanedLines = lines.filter(line => {
        const trimmed = line.trim();
        return !(trimmed.startsWith('import') && trimmed.endsWith(';') && trimmed.includes('{}'));
      });
      
      if (cleanedLines.length !== originalLength) {
        fs.writeFileSync(filePath, cleanedLines.join('\n'));
        this.optimizations.push({
          file: filePath,
          type: 'removed_empty_imports',
          linesRemoved: originalLength - cleanedLines.length
        });
      }
    } catch (error) {
      // Skip files that can't be processed
    }
  }

  async optimizeCSSFiles() {
    console.log('🎨 Optimizing CSS files...');
    
    const cssFiles = this.getFilesRecursively('public/css');
    
    for (const file of cssFiles) {
      if (file.endsWith('.css')) {
        await this.optimizeCSSFile(file);
      }
    }
  }

  async optimizeCSSFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalSize = content.length;
      
      // Remove duplicate CSS rules
      const lines = content.split('\n');
      const uniqueLines = [...new Set(lines)];
      
      // Remove empty lines and comments
      const cleanedLines = uniqueLines.filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
      });
      
      // Remove duplicate selectors
      const selectors = new Map();
      const optimizedLines = [];
      
      for (const line of cleanedLines) {
        if (line.includes('{') && !line.includes('@')) {
          const selector = line.split('{')[0].trim();
          if (!selectors.has(selector)) {
            selectors.set(selector, true);
            optimizedLines.push(line);
          }
        } else {
          optimizedLines.push(line);
        }
      }
      
      const optimizedContent = optimizedLines.join('\n');
      
      if (optimizedContent.length < originalSize) {
        fs.writeFileSync(filePath, optimizedContent);
        this.optimizations.push({
          file: filePath,
          type: 'css_optimization',
          sizeReduction: originalSize - optimizedContent.length
        });
        console.log(`   ✅ Optimized: ${filePath}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not optimize: ${filePath}`);
    }
  }

  async optimizeJSFiles() {
    console.log('⚡ Optimizing JavaScript files...');
    
    const jsFiles = this.getFilesRecursively('src');
    
    for (const file of jsFiles) {
      if (file.endsWith('.js')) {
        await this.optimizeJSFile(file);
      }
    }
  }

  async optimizeJSFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalSize = content.length;
      
      // Remove console.log statements in production
      if (process.env.NODE_ENV === 'production') {
        content = content.replace(/console\.(log|warn|info|debug)\([^)]*\);?\s*/g, '');
      }
      
      // Remove duplicate function declarations
      const lines = content.split('\n');
      const functions = new Map();
      const optimizedLines = [];
      
      for (const line of lines) {
        if (line.trim().startsWith('function ') || line.trim().includes('= function')) {
          const funcName = line.split('(')[0].split(' ').pop().split('=')[0].trim();
          if (!functions.has(funcName)) {
            functions.set(funcName, true);
            optimizedLines.push(line);
          }
        } else {
          optimizedLines.push(line);
        }
      }
      
      // Remove extra whitespace
      const cleanedContent = optimizedLines
        .join('\n')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/^\s+$/gm, '');
      
      if (cleanedContent.length < originalSize) {
        fs.writeFileSync(filePath, cleanedContent);
        this.optimizations.push({
          file: filePath,
          type: 'js_optimization',
          sizeReduction: originalSize - cleanedContent.length
        });
        console.log(`   ✅ Optimized: ${filePath}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not optimize: ${filePath}`);
    }
  }

  async removeEmptyFiles() {
    console.log('🗑️  Removing empty files...');
    
    const allFiles = this.getFilesRecursively('src');
    
    for (const file of allFiles) {
      try {
        const stats = fs.statSync(file);
        if (stats.size === 0) {
          fs.unlinkSync(file);
          this.removedFiles.push(file);
          console.log(`   ✅ Removed empty file: ${file}`);
        }
      } catch (error) {
        // Skip files that can't be processed
      }
    }
  }

  getFilesRecursively(dir) {
    const files = [];
    
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  generateReport() {
    console.log('\n📊 Advanced Cleanup Report');
    console.log('===========================');
    console.log(`Files removed: ${this.removedFiles.length}`);
    console.log(`Files optimized: ${this.optimizations.length}`);
    console.log(`Total size reduction: ${this.calculateTotalSizeReduction()} bytes`);

    if (this.removedFiles.length > 0) {
      console.log('\n🗑️  Removed Files:');
      this.removedFiles.forEach(file => {
        console.log(`   - ${file}`);
      });
    }

    if (this.optimizations.length > 0) {
      console.log('\n⚡ Optimizations:');
      this.optimizations.forEach(opt => {
        console.log(`   - ${opt.file}: ${opt.type} (${opt.sizeReduction || opt.linesRemoved || 0} ${opt.sizeReduction ? 'bytes' : 'lines'})`);
      });
    }

    console.log('\n✅ Advanced cleanup completed successfully!');
  }

  calculateTotalSizeReduction() {
    return this.optimizations.reduce((total, opt) => {
      return total + (opt.sizeReduction || 0);
    }, 0);
  }
}

// Run the advanced cleanup
const cleanup = new AdvancedCleanup();
cleanup.run().catch(console.error);
