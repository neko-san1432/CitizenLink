#!/usr/bin/env node

/**
 * CodeQL Local Scanner with Log File Output
 *
 * This script runs CodeQL analysis locally and outputs results to log files.
 * Usage: node scripts/codeql-local-scan.js [options]
 *
 * Options:
 *   --output-format=json|sarif|text  Output format (default: json)
 *   --output-dir=dirname             Directory to save results (default: ./codeql-results)
 *   --verbose                        Enable verbose logging
 *   --help                           Show this help
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class CodeQLLocalScanner {
  constructor() {
    this.projectRoot = process.cwd();
    this.codeqlPath = this.getCodeQLPath();
    this.outputDir = path.join(this.projectRoot, 'codeql-results');
    this.outputFormat = 'json';
    this.verbose = false;
    this.databasePath = path.join(this.outputDir, 'codeql-db');
    this.resultsPath = path.join(this.outputDir, 'results');

    // Parse command line arguments
    this.parseArguments();
  }

  parseArguments() {
    const args = process.argv.slice(2);

    for (const arg of args) {
      if (arg.startsWith('--output-format=')) {
        this.outputFormat = arg.split('=')[1];
      } else if (arg.startsWith('--output-dir=')) {
        this.outputDir = path.resolve(arg.split('=')[1]);
        this.databasePath = path.join(this.outputDir, 'codeql-db');
        this.resultsPath = path.join(this.outputDir, 'results');
      } else if (arg === '--verbose') {
        this.verbose = true;
      } else if (arg === '--help') {
        this.showHelp();
        process.exit(0);
      }
    }
  }

  showHelp() {
    console.log(`
CodeQL Local Scanner with Log File Output

Usage: node scripts/codeql-local-scan.js [options]

Options:
  --output-format=json|sarif|text  Output format (default: json)
  --output-dir=dirname             Directory to save results (default: ./codeql-results)
  --verbose                        Enable verbose logging
  --help                           Show this help

Examples:
  node scripts/codeql-local-scan.js
  node scripts/codeql-local-scan.js --output-format=sarif --verbose
  node scripts/codeql-local-scan.js --output-dir=./security-reports
`);
  }

  /**
   * Get CodeQL installation path
   */
  getCodeQLPath() {
    // Try common installation paths
    const possiblePaths = [
      'C:\\Program Files\\CodeQL',
      'C:\\CodeQL',
      '/opt/codeql',
      '/usr/local/codeql',
      path.join(os.homedir(), 'codeql'),
      path.join(this.projectRoot, 'codeql')
    ];

    for (const testPath of possiblePaths) {
      if (fs.existsSync(path.join(testPath, 'codeql.exe')) ||
          fs.existsSync(path.join(testPath, 'codeql'))) {
        return testPath;
      }
    }

    return null;
  }

  /**
   * Download and setup CodeQL if not found
   */
  async setupCodeQL() {
    console.log('🔍 CodeQL not found locally. Setting up CodeQL...');

    const codeqlHome = path.join(os.homedir(), 'codeql');
    const codeqlBinary = process.platform === 'win32' ? 'codeql.exe' : 'codeql';

    // Create CodeQL home directory
    if (!fs.existsSync(codeqlHome)) {
      fs.mkdirSync(codeqlHome, { recursive: true });
    }

    // Download CodeQL CLI
    const downloadUrl = process.platform === 'win32'
      ? 'https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-win64.zip'
      : 'https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-linux64.zip';

    console.log(`📥 Downloading CodeQL from: ${downloadUrl}`);

    try {
      // For now, we'll use a simple approach - in a real implementation,
      // you'd want to use a proper download library
      console.log('💡 Note: Please manually download CodeQL CLI from:');
      console.log('   https://github.com/github/codeql-cli-binaries/releases');
      console.log(`   Extract to: ${codeqlHome}`);
      console.log('   Then run this script again.');
      process.exit(1);
    } catch (error) {
      console.error('❌ Failed to download CodeQL:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run the complete CodeQL scan
   */
  async run() {
    console.log('🚀 Starting CodeQL Local Scan...\n');

    try {
      // 1. Setup and validate CodeQL
      await this.validateCodeQL();

      // 2. Create output directories
      this.createOutputDirectories();

      // 3. Create CodeQL database
      await this.createDatabase();

      // 4. Run CodeQL analysis
      await this.runAnalysis();

      // 5. Generate reports
      await this.generateReports();

      console.log('\n✅ CodeQL scan completed successfully!');
      console.log(`📊 Results saved to: ${this.outputDir}`);
      console.log(`📋 Log files created for review`);

    } catch (error) {
      console.error('\n❌ CodeQL scan failed:', error.message);
      console.error('Full error:', error);
      process.exit(1);
    }
  }

  /**
   * Validate CodeQL installation
   */
  async validateCodeQL() {
    if (!this.codeqlPath) {
      await this.setupCodeQL();
    }

    const codeqlBinary = process.platform === 'win32'
      ? path.join(this.codeqlPath, 'codeql.exe')
      : path.join(this.codeqlPath, 'codeql');

    if (!fs.existsSync(codeqlBinary)) {
      console.error(`❌ CodeQL binary not found at: ${codeqlBinary}`);
      console.error('💡 Please install CodeQL CLI from: https://github.com/github/codeql-cli-binaries/releases');
      process.exit(1);
    }

    // Test CodeQL installation
    try {
      const version = execSync(`"${codeqlBinary}" --version`, {
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      console.log(`✅ CodeQL version: ${version.trim()}`);
    } catch (error) {
      console.error('❌ CodeQL validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Create output directories
   */
  createOutputDirectories() {
    console.log(`📁 Creating output directory: ${this.outputDir}`);

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    if (!fs.existsSync(this.databasePath)) {
      fs.mkdirSync(this.databasePath, { recursive: true });
    }

    if (!fs.existsSync(this.resultsPath)) {
      fs.mkdirSync(this.resultsPath, { recursive: true });
    }
  }

  /**
   * Create CodeQL database
   */
  async createDatabase() {
    console.log('🏗️  Creating CodeQL database...');

    const codeqlBinary = process.platform === 'win32'
      ? path.join(this.codeqlPath, 'codeql.exe')
      : path.join(this.codeqlPath, 'codeql');

    const command = [
      'database',
      'create',
      this.databasePath,
      '--source-root', this.projectRoot,
      '--language=javascript',
      '--threads=0' // Use all available cores
    ];

    if (this.verbose) {
      command.push('--verbose');
    }

    try {
      execSync(`"${codeqlBinary}" ${command.join(' ')}`, {
        encoding: 'utf8',
        cwd: this.projectRoot,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      console.log(`✅ Database created: ${this.databasePath}`);
    } catch (error) {
      console.error('❌ Database creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Run CodeQL analysis
   */
  async runAnalysis() {
    console.log('🔍 Running CodeQL analysis...');

    const codeqlBinary = process.platform === 'win32'
      ? path.join(this.codeqlPath, 'codeql.exe')
      : path.join(this.codeqlPath, 'codeql');

    // Run analysis with different query suites
    const querySuites = [
      'security-and-quality',
      'security-extended'
    ];

    for (const suite of querySuites) {
      console.log(`🔎 Analyzing with ${suite} queries...`);

      const sarifFile = path.join(this.resultsPath, `${suite}-results.sarif`);
      const command = [
        'database',
        'analyze',
        this.databasePath,
        `--format=sarif-latest`,
        `--output=${sarifFile}`,
        `--threads=0`,
        `codeql/${suite}`
      ];

      try {
        execSync(`"${codeqlBinary}" ${command.join(' ')}`, {
          encoding: 'utf8',
          cwd: this.projectRoot,
          stdio: this.verbose ? 'inherit' : 'pipe'
        });

        console.log(`✅ Analysis completed: ${sarifFile}`);
      } catch (error) {
        console.warn(`⚠️  Analysis with ${suite} failed:`, error.message);
        // Continue with other suites
      }
    }
  }

  /**
   * Generate comprehensive reports
   */
  async generateReports() {
    console.log('📋 Generating reports...');

    // Generate summary report
    await this.generateSummaryReport();

    // Generate detailed log file
    await this.generateDetailedLog();

    // Generate recommendations
    await this.generateRecommendations();
  }

  /**
   * Generate summary report
   */
  async generateSummaryReport() {
    const summaryPath = path.join(this.outputDir, 'codeql-summary.json');

    // Count results by severity
    const severityCounts = {
      error: 0,
      warning: 0,
      info: 0,
      total: 0
    };

    // Parse SARIF files
    const sarifFiles = [
      path.join(this.resultsPath, 'security-and-quality-results.sarif'),
      path.join(this.resultsPath, 'security-extended-results.sarif')
    ];

    for (const sarifFile of sarifFiles) {
      if (fs.existsSync(sarifFile)) {
        try {
          const sarifContent = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));

          if (sarifContent.runs && sarifContent.runs.length > 0) {
            for (const run of sarifContent.runs) {
              if (run.results) {
                for (const result of run.results) {
                  severityCounts.total++;

                  // Map SARIF severity to our categories
                  const rule = run.tool.driver.rules.find(r => r.id === result.ruleId);
                  if (rule) {
                    const severity = this.mapSeverity(rule.properties?.severity);
                    severityCounts[severity]++;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️  Failed to parse SARIF file ${sarifFile}:`, error.message);
        }
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      project: 'CitizenLink',
      codeql_version: this.getCodeQLVersion(),
      scan_summary: {
        total_issues: severityCounts.total,
        errors: severityCounts.error,
        warnings: severityCounts.warning,
        info: severityCounts.info
      },
      output_files: {
        database: this.databasePath,
        results: this.resultsPath,
        summary: summaryPath
      },
      recommendations: this.generateQuickRecommendations(severityCounts)
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary report: ${summaryPath}`);
  }

  /**
   * Generate detailed log file
   */
  async generateDetailedLog() {
    const logPath = path.join(this.outputDir, 'codeql-detailed.log');

    let logContent = '';
    logContent += `CodeQL Local Scan - Detailed Log\n`;
    logContent += `================================\n\n`;
    logContent += `Timestamp: ${new Date().toISOString()}\n`;
    logContent += `Project: CitizenLink\n`;
    logContent += `CodeQL Path: ${this.codeqlPath}\n`;
    logContent += `Database Path: ${this.databasePath}\n`;
    logContent += `Results Path: ${this.resultsPath}\n`;
    logContent += `Output Format: ${this.outputFormat}\n\n`;

    // Add system information
    logContent += `System Information:\n`;
    logContent += `- Platform: ${process.platform}\n`;
    logContent += `- Node Version: ${process.version}\n`;
    logContent += `- Architecture: ${process.arch}\n`;
    logContent += `- CPU Cores: ${os.cpus().length}\n`;
    logContent += `- Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB\n\n`;

    // Add scan results
    logContent += `Scan Results:\n`;
    logContent += `-------------\n`;

    const sarifFiles = [
      path.join(this.resultsPath, 'security-and-quality-results.sarif'),
      path.join(this.resultsPath, 'security-extended-results.sarif')
    ];

    for (const sarifFile of sarifFiles) {
      if (fs.existsSync(sarifFile)) {
        logContent += `\n📄 File: ${path.basename(sarifFile)}\n`;

        try {
          const sarifContent = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));

          if (sarifContent.runs && sarifContent.runs.length > 0) {
            for (const run of sarifContent.runs) {
              logContent += `Query Suite: ${run.tool.driver.name}\n`;
              logContent += `Results: ${run.results?.length || 0}\n`;

              if (run.results && run.results.length > 0) {
                logContent += `\nTop Issues:\n`;

                // Show first 10 issues
                for (let i = 0; i < Math.min(10, run.results.length); i++) {
                  const result = run.results[i];
                  const rule = run.tool.driver.rules.find(r => r.id === result.ruleId);

                  logContent += `${i + 1}. ${result.ruleId}: ${rule?.name || 'Unknown'}\n`;
                  logContent += `   Severity: ${rule?.properties?.severity || 'unknown'}\n`;
                  logContent += `   Location: ${result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || 'unknown'}\n`;
                  logContent += `   Message: ${result.message?.text || 'No message'}\n\n`;
                }

                if (run.results.length > 10) {
                  logContent += `... and ${run.results.length - 10} more issues\n\n`;
                }
              }
            }
          }
        } catch (error) {
          logContent += `❌ Failed to parse SARIF file: ${error.message}\n\n`;
        }
      }
    }

    fs.writeFileSync(logPath, logContent);
    console.log(`✅ Detailed log: ${logPath}`);
  }

  /**
   * Generate recommendations based on scan results
   */
  async generateRecommendations() {
    const recommendationsPath = path.join(this.outputDir, 'recommendations.md');

    let recommendations = `# CodeQL Security Recommendations

Generated on: ${new Date().toISOString()}

## Priority Actions

`;

    // This would be populated based on actual scan results
    recommendations += `### High Priority
- Review and fix all **Error** severity issues
- Address SQL injection vulnerabilities immediately
- Fix authentication bypass issues

### Medium Priority
- Review **Warning** severity issues
- Update vulnerable dependencies
- Implement proper input validation

### Low Priority
- Address **Info** severity issues
- Improve code quality where possible

## Next Steps

1. **Review the detailed log** for specific issues
2. **Check SARIF files** for comprehensive results
3. **Fix critical issues** before deployment
4. **Re-run scan** after fixes to verify resolution

## Useful Commands

\`\`\`bash
# Run scan again
node scripts/codeql-local-scan.js

# Quick security fixes
npm run security-fix

# View detailed results
cat codeql-results/codeql-detailed.log
\`\`\`

## Resources

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Security Fixes Guide](SECURITY_FIXES.md)
- [GitHub Security Tab](https://github.com/your-repo/security)
`;

    fs.writeFileSync(recommendationsPath, recommendations);
    console.log(`✅ Recommendations: ${recommendationsPath}`);
  }

  /**
   * Map CodeQL severity to our categories
   */
  mapSeverity(severity) {
    if (!severity) return 'info';

    const severityLower = severity.toLowerCase();
    if (severityLower.includes('error') || severityLower.includes('critical')) {
      return 'error';
    } else if (severityLower.includes('warning') || severityLower.includes('medium')) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Get CodeQL version
   */
  getCodeQLVersion() {
    try {
      const codeqlBinary = process.platform === 'win32'
        ? path.join(this.codeqlPath, 'codeql.exe')
        : path.join(this.codeqlPath, 'codeql');

      return execSync(`"${codeqlBinary}" --version`, {
        encoding: 'utf8',
        cwd: this.projectRoot
      }).trim();
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Generate quick recommendations based on counts
   */
  generateQuickRecommendations(counts) {
    const recommendations = [];

    if (counts.error > 0) {
      recommendations.push(`🚨 Fix ${counts.error} critical security issues immediately`);
    }

    if (counts.warning > 5) {
      recommendations.push(`⚠️  Review ${counts.warning} warning-level issues`);
    }

    if (counts.total === 0) {
      recommendations.push('✅ No security issues found - excellent!');
    }

    return recommendations;
  }
}

// Main execution
if (require.main === module) {
  const scanner = new CodeQLLocalScanner();
  scanner.run().catch(console.error);
}

module.exports = CodeQLLocalScanner;
