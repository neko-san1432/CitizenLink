#!/usr/bin/env node

/**
 * Cleanup Unused Files Script
 * Removes unnecessary files and optimizes the codebase
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 CitizenLink Cleanup Script');
console.log('==============================\n');

class CleanupScript {
  constructor() {
    this.removedFiles = [];
    this.removedDirs = [];
    this.optimizedFiles = [];
  }

  async run() {
    console.log('🔍 Starting cleanup process...\n');

    // Remove unused CSS files
    await this.removeUnusedCSSFiles();
    
    // Remove unused JavaScript files
    await this.removeUnusedJSFiles();
    
    // Remove empty directories
    await this.removeEmptyDirectories();
    
    // Optimize remaining files
    await this.optimizeFiles();
    
    // Generate report
    this.generateReport();
  }

  async removeUnusedCSSFiles() {
    console.log('📁 Cleaning up unused CSS files...');
    
    const cssDir = 'public/css/pages';
    if (!fs.existsSync(cssDir)) return;

    const files = fs.readdirSync(cssDir);
    const unusedFiles = [
      'admin-departments.css',
      'admin-settings.css',
      'coordinator-dashboard.css',
      'coordinator-review-queue.css',
      'coordinator-review.css',
      'hr-dashboard.css',
      'hr-link-generator.css',
      'hr-role-changer.css',
      'lgu-admin-assignments.css',
      'lgu-task-assigned.css',
      'oauth-complete.css',
      'super-admin-dashboard.css',
      'super-admin-role-changer.css'
    ];

    for (const file of unusedFiles) {
      const filePath = path.join(cssDir, file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          this.removedFiles.push(filePath);
          console.log(`   ✅ Removed: ${file}`);
        } catch (error) {
          console.warn(`   ⚠️  Could not remove: ${file}`);
        }
      }
    }
  }

  async removeUnusedJSFiles() {
    console.log('📁 Cleaning up unused JavaScript files...');
    
    const jsDirs = ['src/client', 'public/js'];
    
    for (const dir of jsDirs) {
      if (!fs.existsSync(dir)) continue;
      
      const files = this.getFilesRecursively(dir);
      
      for (const file of files) {
        if (this.isUnusedJSFile(file)) {
          try {
            fs.unlinkSync(file);
            this.removedFiles.push(file);
            console.log(`   ✅ Removed: ${file}`);
          } catch (error) {
            console.warn(`   ⚠️  Could not remove: ${file}`);
          }
        }
      }
    }
  }

  isUnusedJSFile(filePath) {
    const basename = path.basename(filePath);
    
    // Skip if it's a directory or not a JS file
    if (fs.statSync(filePath).isDirectory() || !basename.endsWith('.js')) {
      return false;
    }

    // Skip if it's a main file or configuration
    if (basename === 'index.js' || 
        basename === 'main.js' || 
        basename === 'app.js' ||
        basename === 'config.js') {
      return false;
    }

    // Check if file is referenced anywhere
    return !this.isFileReferenced(filePath);
  }

  isFileReferenced(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    const searchDirs = ['src', 'views', 'public'];
    
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      
      const files = this.getFilesRecursively(dir);
      
      for (const file of files) {
        if (file === filePath) continue;
        
        try {
          const content = fs.readFileSync(file, 'utf8');
          const basename = path.basename(filePath, '.js');
          
          // Check for various import patterns
          if (content.includes(basename) || 
              content.includes(relativePath) ||
              content.includes(filePath)) {
            return true;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
    
    return false;
  }

  async removeEmptyDirectories() {
    console.log('📁 Removing empty directories...');
    
    const dirsToCheck = [
      'public/css/pages',
      'src/client/components',
      'src/client/utils',
      'src/client/assets'
    ];

    for (const dir of dirsToCheck) {
      if (fs.existsSync(dir)) {
        const isEmpty = fs.readdirSync(dir).length === 0;
        if (isEmpty) {
          try {
            fs.rmdirSync(dir);
            this.removedDirs.push(dir);
            console.log(`   ✅ Removed empty directory: ${dir}`);
          } catch (error) {
            console.warn(`   ⚠️  Could not remove directory: ${dir}`);
          }
        }
      }
    }
  }

  async optimizeFiles() {
    console.log('⚡ Optimizing files...');
    
    // Optimize main CSS file
    await this.optimizeCSSFile('public/css/style.css');
    
    // Optimize main JS files
    const jsFiles = [
      'src/client/components/header.js',
      'src/client/components/notification.js'
    ];

    for (const file of jsFiles) {
      if (fs.existsSync(file)) {
        await this.optimizeJSFile(file);
      }
    }
  }

  async optimizeCSSFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Remove duplicate imports
      const imports = content.match(/@import[^;]+;/g) || [];
      const uniqueImports = [...new Set(imports)];
      
      if (imports.length !== uniqueImports.length) {
        content = content.replace(/@import[^;]+;/g, '');
        content = uniqueImports.join('\n') + '\n\n' + content;
        this.optimizedFiles.push(filePath);
        console.log(`   ✅ Optimized: ${filePath}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not optimize: ${filePath}`);
    }
  }

  async optimizeJSFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Remove console.log statements in production
      if (process.env.NODE_ENV === 'production') {
        const originalLength = content.length;
        content = content.replace(/console\.(log|warn|info|debug)\([^)]*\);?\s*/g, '');
        
        if (content.length !== originalLength) {
          this.optimizedFiles.push(filePath);
          console.log(`   ✅ Optimized: ${filePath}`);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not optimize: ${filePath}`);
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
    console.log('\n📊 Cleanup Report');
    console.log('==================');
    console.log(`Files removed: ${this.removedFiles.length}`);
    console.log(`Directories removed: ${this.removedDirs.length}`);
    console.log(`Files optimized: ${this.optimizedFiles.length}`);

    if (this.removedFiles.length > 0) {
      console.log('\n🗑️  Removed Files:');
      this.removedFiles.forEach(file => {
        console.log(`   - ${file}`);
      });
    }

    if (this.removedDirs.length > 0) {
      console.log('\n📁 Removed Directories:');
      this.removedDirs.forEach(dir => {
        console.log(`   - ${dir}`);
      });
    }

    if (this.optimizedFiles.length > 0) {
      console.log('\n⚡ Optimized Files:');
      this.optimizedFiles.forEach(file => {
        console.log(`   - ${file}`);
      });
    }

    console.log('\n✅ Cleanup completed successfully!');
  }
}

// Run the cleanup
const cleanup = new CleanupScript();
cleanup.run().catch(console.error);
