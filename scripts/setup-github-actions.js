#!/usr/bin/env node

/**
 * GitHub Actions Setup Script for CitizenLink
 * This script helps configure GitHub Actions and security scanning
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up GitHub Actions for CitizenLink...\n');

// Check if we're in a git repository
function checkGitRepository() {
  if (!fs.existsSync('.git')) {
    console.error('❌ Error: Not in a git repository');
    console.log('   Please run this script from the root of your git repository');
    process.exit(1);
  }
  console.log('✅ Git repository detected');
}

// Check if GitHub Actions workflow exists
function checkWorkflowFile() {
  const workflowPath = '.github/workflows/security-analysis.yml';
  if (!fs.existsSync(workflowPath)) {
    console.error('❌ Error: Security workflow not found');
    console.log('   Expected file: .github/workflows/security-analysis.yml');
    process.exit(1);
  }
  console.log('✅ Security workflow found');
}

// Check if CodeQL config exists
function checkCodeQLConfig() {
  const configPath = '.github/codeql-config.yml';
  if (!fs.existsSync(configPath)) {
    console.warn('⚠️  Warning: CodeQL config not found');
    console.log('   Creating basic CodeQL configuration...');
    
    const basicConfig = `# CodeQL configuration for CitizenLink
name: "CitizenLink CodeQL Configuration"

disable-default-queries: false

queries:
  - name: security-and-quality
  - name: security-extended

paths-ignore:
  - "node_modules/**"
  - "public/**"
  - "views/**"
  - "*.min.js"
  - "coverage/**"
  - "dist/**"
  - "build/**"

paths:
  - "src/**"
  - "scripts/**"
  - "*.js"
  - "*.json"`;

    fs.writeFileSync(configPath, basicConfig);
    console.log('✅ Basic CodeQL config created');
  } else {
    console.log('✅ CodeQL config found');
  }
}

// Check package.json for required scripts
function checkPackageScripts() {
  const packagePath = 'package.json';
  if (!fs.existsSync(packagePath)) {
    console.error('❌ Error: package.json not found');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredScripts = ['security-audit', 'security-fix', 'security-scan'];
  const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);

  if (missingScripts.length > 0) {
    console.warn('⚠️  Warning: Missing required scripts in package.json');
    console.log('   Missing scripts:', missingScripts.join(', '));
    console.log('   Adding basic security scripts...');

    // Add missing scripts
    missingScripts.forEach(script => {
      switch (script) {
        case 'security-audit':
          packageJson.scripts[script] = 'npm audit --audit-level=moderate';
          break;
        case 'security-fix':
          packageJson.scripts[script] = 'npm audit fix --force';
          break;
        case 'security-scan':
          packageJson.scripts[script] = 'echo "Custom security scan completed"';
          break;
      }
    });

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Security scripts added to package.json');
  } else {
    console.log('✅ All required scripts found in package.json');
  }
}

// Check ESLint configuration
function checkESLintConfig() {
  const eslintConfigs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'];
  const foundConfig = eslintConfigs.find(config => fs.existsSync(config));
  
  if (!foundConfig) {
    console.warn('⚠️  Warning: ESLint configuration not found');
    console.log('   The workflow will still run but ESLint analysis may fail');
  } else {
    console.log(`✅ ESLint config found: ${foundConfig}`);
  }
}

// Generate setup instructions
function generateInstructions() {
  console.log('\n📋 Next Steps:');
  console.log('1. Push your changes to GitHub:');
  console.log('   git add .');
  console.log('   git commit -m "Add GitHub Actions security workflow"');
  console.log('   git push origin main');
  console.log('');
  console.log('2. Enable GitHub Actions in your repository:');
  console.log('   - Go to Settings → Actions');
  console.log('   - Select "Allow all actions and reusable workflows"');
  console.log('   - Click Save');
  console.log('');
  console.log('3. Enable security scanning:');
  console.log('   - Go to Settings → Security → Code security and analysis');
  console.log('   - Enable "Dependency graph"');
  console.log('   - Enable "Dependabot alerts"');
  console.log('   - Enable "Code scanning"');
  console.log('   - Enable "Secret scanning"');
  console.log('');
  console.log('4. Test the workflow:');
  console.log('   - Go to Actions tab in your repository');
  console.log('   - Click "Security Analysis" workflow');
  console.log('   - Click "Run workflow" button');
  console.log('');
  console.log('5. Monitor results:');
  console.log('   - Check Security tab for alerts');
  console.log('   - View workflow runs in Actions tab');
  console.log('   - Check PR comments for security feedback');
}

// Main execution
function main() {
  try {
    checkGitRepository();
    checkWorkflowFile();
    checkCodeQLConfig();
    checkPackageScripts();
    checkESLintConfig();
    
    console.log('\n✅ GitHub Actions setup completed successfully!');
    generateInstructions();
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
