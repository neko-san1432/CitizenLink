#!/usr/bin/env node

/**
 * Comprehensive Security Scan Script
 * Scans for specific ESLint rule violations and security issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 Starting Comprehensive Security Scan...\n');

// Define the specific rules to scan for
const TARGET_RULES = [
  'indent',
  'no-case-declarations',
  'no-constant-condition',
  'no-empty',
  'no-multiple-empty-lines',
  'no-trailing-spaces',
  'no-unsanitized/property',
  'no-unused-vars',
  'no-useless-escape',
  'prefer-const',
  'quotes',
  'security/detect-non-literal-fs-filename',
  'security/detect-non-literal-regexp',
  'security/detect-object-injection',
  'security/detect-possible-timing-attacks',
  'security/detect-unsafe-regex'
];

// Additional security rules to check
const ADDITIONAL_SECURITY_RULES = [
  'security/detect-buffer-noassert',
  'security/detect-child-process',
  'security/detect-disable-mustache-escape',
  'security/detect-eval-with-expression',
  'security/detect-new-buffer',
  'security/detect-pseudoRandomBytes',
  'security/detect-buffer-overflow',
  'no-eval',
  'no-implied-eval',
  'no-new-func'
];

const ALL_RULES = [...TARGET_RULES, ...ADDITIONAL_SECURITY_RULES];

function runESLintWithSpecificRules() {
  try {
    console.log('🔍 Running ESLint with specific security rules...\n');
    
    // Create a temporary ESLint config for this specific scan
    const tempConfig = {
      extends: ['eslint:recommended'],
      plugins: ['security', 'no-unsanitized'],
      env: {
        node: true,
        es2022: true
      },
      rules: {}
    };

    // Set all target rules to error level
    ALL_RULES.forEach(rule => {
      tempConfig.rules[rule] = 'error';
    });

    // Write temporary config
    const tempConfigPath = '.eslintrc.temp.json';
    fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));

    // Run ESLint with the temporary config
    const command = `npx eslint . --config ${tempConfigPath} --ext .js,.jsx,.ts,.tsx --format=json`;
    
    console.log(`Running: ${command}\n`);
    
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    // Clean up temp config
    fs.unlinkSync(tempConfigPath);

    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : parsed.results || [];

  } catch (error) {
    // Clean up temp config if it exists
    if (fs.existsSync('.eslintrc.temp.json')) {
      fs.unlinkSync('.eslintrc.temp.json');
    }

    if (error.stdout) {
      try {
        const parsed = JSON.parse(error.stdout);
        return Array.isArray(parsed) ? parsed : parsed.results || [];
      } catch (parseError) {
        console.error('❌ Failed to parse ESLint output:', error.message);
        return [];
      }
    } else {
      console.error('❌ ESLint execution failed:', error.message);
      return [];
    }
  }
}

function analyzeResults(results) {
  console.log('📊 Analyzing Security Scan Results...\n');

  const ruleStats = {};
  const fileStats = {};
  let totalIssues = 0;
  let criticalIssues = 0;

  results.forEach(file => {
    const fileName = file.filePath;
    fileStats[fileName] = {
      errors: 0,
      warnings: 0,
      rules: new Set()
    };

    file.messages.forEach(message => {
      const ruleId = message.ruleId;
      const severity = message.severity;
      
      // Count by rule
      if (!ruleStats[ruleId]) {
        ruleStats[ruleId] = { errors: 0, warnings: 0, files: new Set() };
      }
      
      if (severity === 2) {
        ruleStats[ruleId].errors++;
        fileStats[fileName].errors++;
        totalIssues++;
        
        // Check if it's a critical security rule
        if (ruleId && ruleId.startsWith('security/')) {
          criticalIssues++;
        }
      } else if (severity === 1) {
        ruleStats[ruleId].warnings++;
        fileStats[fileName].warnings++;
      }
      
      ruleStats[ruleId].files.add(fileName);
      fileStats[fileName].rules.add(ruleId);
    });
  });

  // Display results
  console.log('🎯 TARGET RULES VIOLATIONS:');
  console.log('='.repeat(50));
  
  TARGET_RULES.forEach(rule => {
    if (ruleStats[rule]) {
      const { errors, warnings, files } = ruleStats[rule];
      const status = errors > 0 ? '❌' : warnings > 0 ? '⚠️' : '✅';
      console.log(`${status} ${rule}: ${errors} errors, ${warnings} warnings (${files.size} files)`);
    } else {
      console.log(`✅ ${rule}: No violations found`);
    }
  });

  console.log('\n🔒 ADDITIONAL SECURITY RULES:');
  console.log('='.repeat(50));
  
  ADDITIONAL_SECURITY_RULES.forEach(rule => {
    if (ruleStats[rule]) {
      const { errors, warnings, files } = ruleStats[rule];
      const status = errors > 0 ? '❌' : warnings > 0 ? '⚠️' : '✅';
      console.log(`${status} ${rule}: ${errors} errors, ${warnings} warnings (${files.size} files)`);
    } else {
      console.log(`✅ ${rule}: No violations found`);
    }
  });

  console.log('\n📁 FILES WITH ISSUES:');
  console.log('='.repeat(50));
  
  Object.entries(fileStats)
    .filter(([_, stats]) => stats.errors > 0 || stats.warnings > 0)
    .sort((a, b) => (b[1].errors + b[1].warnings) - (a[1].errors + a[1].warnings))
    .forEach(([fileName, stats]) => {
      const relativePath = path.relative(process.cwd(), fileName);
      console.log(`📄 ${relativePath}: ${stats.errors} errors, ${stats.warnings} warnings`);
      console.log(`   Rules: ${Array.from(stats.rules).join(', ')}`);
    });

  console.log('\n📈 SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Total Issues: ${totalIssues}`);
  console.log(`Critical Security Issues: ${criticalIssues}`);
  console.log(`Files Scanned: ${results.length}`);
  console.log(`Files with Issues: ${Object.keys(fileStats).filter(f => fileStats[f].errors > 0 || fileStats[f].warnings > 0).length}`);

  // Return exit code based on critical issues
  if (criticalIssues > 0) {
    console.log('\n❌ Security scan failed: Critical security issues found!');
    return 1;
  } else if (totalIssues > 0) {
    console.log('\n⚠️ Security scan completed with warnings');
    return 0;
  } else {
    console.log('\n✅ Security scan passed: No issues found!');
    return 0;
  }
}

function main() {
  try {
    const results = runESLintWithSpecificRules();
    const exitCode = analyzeResults(results);
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Security scan failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, TARGET_RULES, ADDITIONAL_SECURITY_RULES };
