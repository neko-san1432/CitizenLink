# CodeQL Alert Resolution Guide

## Most Common CodeQL Alerts and How to Fix Them

### 1. **SQL Injection (js/sql-injection)**
**Problem**: Untrusted user input used in database queries

**Auto-Fix**: ✅ Handled by input sanitization middleware
**Manual Fix**:
```javascript
// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = '${req.body.id}'`;

// ✅ Safe
const query = 'SELECT * FROM users WHERE id = $1';
const values = [req.body.id];
```

### 2. **Cross-Site Scripting (js/xss)**
**Problem**: Unescaped user input rendered in HTML

**Auto-Fix**: ✅ Handled by XSS sanitization
**Manual Fix**:
```javascript
// ❌ Vulnerable
res.send(`<div>Welcome ${req.body.name}</div>`);

// ✅ Safe
const sanitizedName = DOMPurify.sanitize(req.body.name);
res.send(`<div>Welcome ${sanitizedName}</div>`);
```

### 3. **Path Traversal (js/path-injection)**
**Problem**: User input used in file paths without validation

**Manual Fix**:
```javascript
// ❌ Vulnerable
const filePath = path.join(__dirname, req.body.filename);

// ✅ Safe
const safePath = path.normalize(req.body.filename).replace(/^(\.\.[\/\\])+/, '');
const filePath = path.join(__dirname, 'uploads', safePath);
```

### 4. **Insecure Randomness (js/insufficient-randomness)**
**Problem**: Weak random number generation

**Manual Fix**:
```javascript
// ❌ Weak
const token = Math.random().toString();

// ✅ Secure
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex');
```

### 5. **Information Disclosure (js/exposing-internal-details)**
**Problem**: Sensitive information in error messages

**Auto-Fix**: ✅ Handled by error sanitization
**Manual Fix**:
```javascript
// ❌ Leaks info
throw new Error(`User ${user.id} not found in database ${db.url}`);

// ✅ Safe
throw new Error('User not found');
```

### 6. **Hardcoded Secrets (js/hardcoded-credentials)**
**Problem**: Secrets stored in code

**Manual Fix**:
```javascript
// ❌ Insecure
const API_KEY = 'sk-123456789';

// ✅ Secure
const API_KEY = process.env.API_KEY;
```

### 7. **Insecure Dependencies**
**Problem**: Vulnerable npm packages

**Auto-Fix**: ✅ Handled by npm audit fix
**Manual Fix**:
```bash
npm audit
npm audit fix
npm update <package-name>
```

## Using the Auto-Resolution Tools

### 1. **Local Security Scan**
```bash
# Run comprehensive security scan
npm run security-scan

# Quick security fixes
npm run security-fix

# Check for vulnerabilities
npm run security-audit
```

### 2. **GitHub Actions Auto-Resolution**
- Automatically runs on pull requests
- Fixes common issues and commits changes
- Comments on PR with results

### 3. **Manual Alert Resolution**

#### **Step 1: View Alerts**
1. Go to your repository's Security tab
2. Click on "Code scanning alerts"
3. Review each alert

#### **Step 2: Understand the Alert**
- Read the description carefully
- Look at the code location
- Understand why it's flagged

#### **Step 3: Apply Fix**
- Use the examples above for common patterns
- Test your fix thoroughly
- Ensure functionality still works

#### **Step 4: Verify Fix**
- Run CodeQL scan again
- Check if alert is resolved
- Test application functionality

## Advanced Configuration

### **Custom CodeQL Queries**
Create `.github/codeql-custom-queries/` directory for project-specific queries.

### **Suppressing False Positives**
Add to `.github/codeql-config.yml`:
```yaml
rules:
  - id: js/specific-rule-id
    severity: warning
```

### **Baseline Configuration**
Set up baseline to suppress existing issues:
```yaml
baseline:
  new-issues-only: true
```

## Best Practices

1. **Fix High/Critical alerts first**
2. **Test fixes thoroughly**
3. **Use auto-resolution for common patterns**
4. **Review remaining alerts manually**
5. **Keep dependencies updated**
6. **Regular security audits**

## Getting Help

- **GitHub Security Tab**: Primary location for alerts
- **CodeQL Documentation**: https://codeql.github.com/docs/
- **Security Policy**: Check SECURITY.md for reporting issues
- **Community**: GitHub Security Lab for guidance
