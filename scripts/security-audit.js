#!/usr/bin/env node

/**
 * Comprehensive Security Audit Script
 * Scans the codebase for potential security vulnerabilities
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 CitizenLink Security Audit');
console.log('============================\n');

class SecurityAudit {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.recommendations = [];
    this.scannedFiles = 0;
  }

  async runAudit() {
    console.log('🔍 Starting security audit...\n');

    // Scan server-side code
    await this.scanDirectory('src/server', 'server');
    
    // Scan client-side code
    await this.scanDirectory('src/client', 'client');
    
    // Scan configuration files
    await this.scanConfigFiles();
    
    // Scan package.json for vulnerabilities
    await this.scanPackageJson();
    
    // Generate report
    this.generateReport();
  }

  async scanDirectory(dir, type) {
    if (!fs.existsSync(dir)) return;

    const files = this.getFilesRecursively(dir);
    
    for (const file of files) {
      if (this.shouldScanFile(file)) {
        await this.scanFile(file, type);
        this.scannedFiles++;
      }
    }
  }

  getFilesRecursively(dir) {
    const files = [];
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

  shouldScanFile(file) {
    const ext = path.extname(file);
    const basename = path.basename(file);
    
    return (
      ['.js', '.json', '.html', '.css'].includes(ext) &&
      !basename.startsWith('.') &&
      !basename.includes('node_modules') &&
      !basename.includes('.min.')
    );
  }

  async scanFile(filePath, type) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Check for common security issues
      this.checkForHardcodedSecrets(filePath, lines);
      this.checkForSQLInjection(filePath, lines);
      this.checkForXSS(filePath, lines);
      this.checkForInsecureCrypto(filePath, lines);
      this.checkForInsecureRandom(filePath, lines);
      this.checkForPathTraversal(filePath, lines);
      this.checkForCommandInjection(filePath, lines);
      this.checkForInsecureHeaders(filePath, lines);
      this.checkForMissingValidation(filePath, lines);
      this.checkForInsecureRedirects(filePath, lines);
      
    } catch (error) {
      console.warn(`⚠️  Could not scan file: ${filePath}`);
    }
  }

  checkForHardcodedSecrets(filePath, lines) {
    const secretPatterns = [
      /password\s*=\s*['"][^'"]+['"]/gi,
      /secret\s*=\s*['"][^'"]+['"]/gi,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,
      /token\s*=\s*['"][^'"]+['"]/gi,
      /private[_-]?key\s*=\s*['"][^'"]+['"]/gi,
      /database[_-]?url\s*=\s*['"][^'"]+['"]/gi,
      /connection[_-]?string\s*=\s*['"][^'"]+['"]/gi
    ];

    lines.forEach((line, index) => {
      secretPatterns.forEach(pattern => {
        if (pattern.test(line) && !line.includes('process.env')) {
          this.issues.push({
            type: 'HARDCODED_SECRET',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'HIGH',
            description: 'Hardcoded secret detected. Use environment variables instead.'
          });
        }
      });
    });
  }

  checkForSQLInjection(filePath, lines) {
    const sqlPatterns = [
      /query\s*\(\s*['"`][^'"`]*\$\{/gi,
      /query\s*\(\s*['"`][^'"`]*\+/gi,
      /\.query\s*\(\s*[^)]*\+/gi,
      /SELECT\s+.*\$\{/gi,
      /INSERT\s+.*\$\{/gi,
      /UPDATE\s+.*\$\{/gi,
      /DELETE\s+.*\$\{/gi
    ];

    lines.forEach((line, index) => {
      sqlPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          this.warnings.push({
            type: 'POTENTIAL_SQL_INJECTION',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'MEDIUM',
            description: 'Potential SQL injection vulnerability. Use parameterized queries.'
          });
        }
      });
    });
  }

  checkForXSS(filePath, lines) {
    const xssPatterns = [
      /innerHTML\s*=/gi,
      /outerHTML\s*=/gi,
      /document\.write\s*\(/gi,
      /eval\s*\(/gi,
      /setTimeout\s*\(\s*['"`][^'"`]*['"`]/gi,
      /setInterval\s*\(\s*['"`][^'"`]*['"`]/gi
    ];

    lines.forEach((line, index) => {
      xssPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          this.warnings.push({
            type: 'POTENTIAL_XSS',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'MEDIUM',
            description: 'Potential XSS vulnerability. Sanitize user input before rendering.'
          });
        }
      });
    });
  }

  checkForInsecureCrypto(filePath, lines) {
    const cryptoPatterns = [
      /crypto\.createHash\s*\(\s*['"`]md5['"`]/gi,
      /crypto\.createHash\s*\(\s*['"`]sha1['"`]/gi,
      /Math\.random\s*\(\s*\)/gi
    ];

    lines.forEach((line, index) => {
      cryptoPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          this.issues.push({
            type: 'INSECURE_CRYPTO',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'HIGH',
            description: 'Insecure cryptographic function detected. Use stronger algorithms.'
          });
        }
      });
    });
  }

  checkForInsecureRandom(filePath, lines) {
    const randomPatterns = [
      /Math\.random\s*\(\s*\)/gi
    ];

    lines.forEach((line, index) => {
      randomPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          this.warnings.push({
            type: 'INSECURE_RANDOM',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'LOW',
            description: 'Math.random() is not cryptographically secure. Use crypto.randomBytes() for security-sensitive operations.'
          });
        }
      });
    });
  }

  checkForPathTraversal(filePath, lines) {
    const pathPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /path\.join\s*\(\s*[^)]*req\./gi,
      /fs\.readFile\s*\(\s*[^)]*req\./gi
    ];

    lines.forEach((line, index) => {
      pathPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          this.issues.push({
            type: 'PATH_TRAVERSAL',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'HIGH',
            description: 'Potential path traversal vulnerability. Validate and sanitize file paths.'
          });
        }
      });
    });
  }

  checkForCommandInjection(filePath, lines) {
    const commandPatterns = [
      /exec\s*\(/gi,
      /spawn\s*\(/gi,
      /execSync\s*\(/gi,
      /child_process/gi
    ];

    lines.forEach((line, index) => {
      commandPatterns.forEach(pattern => {
        if (pattern.test(line) && !line.includes('require(')) {
          this.warnings.push({
            type: 'COMMAND_INJECTION',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'MEDIUM',
            description: 'Command execution detected. Ensure input is properly sanitized.'
          });
        }
      });
    });
  }

  checkForInsecureHeaders(filePath, lines) {
    const headerPatterns = [
      /Access-Control-Allow-Origin\s*:\s*\*/gi,
      /X-Frame-Options\s*:\s*DENY/gi
    ];

    lines.forEach((line, index) => {
      headerPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          this.warnings.push({
            type: 'INSECURE_HEADERS',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'LOW',
            description: 'Review security headers configuration.'
          });
        }
      });
    });
  }

  checkForMissingValidation(filePath, lines) {
    const validationPatterns = [
      /req\.body\.[a-zA-Z_][a-zA-Z0-9_]*\s*[^=]/gi,
      /req\.query\.[a-zA-Z_][a-zA-Z0-9_]*\s*[^=]/gi,
      /req\.params\.[a-zA-Z_][a-zA-Z0-9_]*\s*[^=]/gi
    ];

    lines.forEach((line, index) => {
      validationPatterns.forEach(pattern => {
        if (pattern.test(line) && !line.includes('validator') && !line.includes('sanitize')) {
          this.warnings.push({
            type: 'MISSING_VALIDATION',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'LOW',
            description: 'User input used without validation. Consider adding input validation.'
          });
        }
      });
    });
  }

  checkForInsecureRedirects(filePath, lines) {
    const redirectPatterns = [
      /res\.redirect\s*\(\s*req\./gi,
      /window\.location\s*=\s*[^'"]*req\./gi
    ];

    lines.forEach((line, index) => {
      redirectPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          this.issues.push({
            type: 'INSECURE_REDIRECT',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            severity: 'HIGH',
            description: 'Insecure redirect detected. Validate redirect URLs.'
          });
        }
      });
    });
  }

  async scanConfigFiles() {
    const configFiles = [
      'package.json',
      '.env.example',
      'server.js',
      'config/database.js'
    ];

    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        await this.scanFile(file, 'config');
      }
    }
  }

  async scanPackageJson() {
    if (!fs.existsSync('package.json')) return;

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check for known vulnerable packages
      const vulnerablePackages = [
        'express', 'body-parser', 'cors', 'helmet'
      ];

      for (const pkg of vulnerablePackages) {
        if (packageJson.dependencies && packageJson.dependencies[pkg]) {
          const version = packageJson.dependencies[pkg];
          if (version.includes('^') || version.includes('~')) {
            this.recommendations.push({
              type: 'PACKAGE_VERSION',
              package: pkg,
              version: version,
              description: `Consider pinning exact version for ${pkg} to prevent supply chain attacks.`
            });
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not parse package.json');
    }
  }

  generateReport() {
    console.log(`📊 Security Audit Report`);
    console.log(`=======================`);
    console.log(`Files scanned: ${this.scannedFiles}`);
    console.log(`Issues found: ${this.issues.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Recommendations: ${this.recommendations.length}\n`);

    if (this.issues.length > 0) {
      console.log('🚨 HIGH PRIORITY ISSUES:');
      console.log('========================');
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.type} (${issue.severity})`);
        console.log(`   File: ${issue.file}:${issue.line}`);
        console.log(`   Description: ${issue.description}`);
        console.log(`   Code: ${issue.content}`);
        console.log('');
      });
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      console.log('=============');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.type} (${warning.severity})`);
        console.log(`   File: ${warning.file}:${warning.line}`);
        console.log(`   Description: ${warning.description}`);
        console.log(`   Code: ${warning.content}`);
        console.log('');
      });
    }

    if (this.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      console.log('===================');
      this.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.type}`);
        console.log(`   Description: ${rec.description}`);
        if (rec.package) {
          console.log(`   Package: ${rec.package} (${rec.version})`);
        }
        console.log('');
      });
    }

    // Security score
    const totalIssues = this.issues.length + this.warnings.length;
    let score = 100;
    score -= this.issues.length * 10; // High severity issues
    score -= this.warnings.length * 5; // Medium/low severity warnings
    score = Math.max(0, score);

    console.log(`🏆 Security Score: ${score}/100`);
    
    if (score >= 90) {
      console.log('✅ Excellent security posture!');
    } else if (score >= 70) {
      console.log('⚠️  Good security, but room for improvement.');
    } else if (score >= 50) {
      console.log('🔶 Security needs attention.');
    } else {
      console.log('🚨 Critical security issues detected!');
    }

    console.log('\n🔒 Security audit completed.');
  }
}

// Run the audit
const audit = new SecurityAudit();
audit.runAudit().catch(console.error);
