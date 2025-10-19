# GitHub Actions Setup Guide for CitizenLink

## 🔧 Repository Configuration

### 1. **Enable GitHub Actions**
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Actions** in the left sidebar
4. Under "Actions permissions", select **"Allow all actions and reusable workflows"**
5. Click **Save**

### 2. **Enable Security Scanning**
1. Go to **Settings** → **Security** → **Code security and analysis**
2. Enable these features:
   - ✅ **Dependency graph**
   - ✅ **Dependabot alerts**
   - ✅ **Code scanning** (CodeQL)
   - ✅ **Secret scanning**

### 3. **Workflow Permissions**
The workflow needs these permissions (already configured):
- ✅ `contents: write` - To commit security fixes
- ✅ `security-events: write` - To upload security results
- ✅ `pull-requests: write` - To comment on PRs
- ✅ `actions: read` - To read workflow status
- ✅ `packages: read` - To read npm packages

## 🎯 **Workflow Triggers**

### Automatic Triggers
- **Push to main**: Runs on every commit
- **Pull Requests**: Runs on every PR to main
- **Weekly Schedule**: Every Sunday at 2 AM UTC
- **Manual**: Can be triggered from Actions tab

### Manual Trigger
1. Go to **Actions** tab in your repository
2. Click **Security Analysis** workflow
3. Click **Run workflow** button
4. Select branch and click **Run workflow**

## 📊 **Monitoring & Results**

### 1. **View Workflow Runs**
- Go to **Actions** tab
- Click **Security Analysis** workflow
- View run history and logs

### 2. **Security Alerts**
- Go to **Security** tab
- Click **Code scanning alerts**
- View CodeQL and ESLint results

### 3. **PR Comments**
- Security analysis results appear as comments on PRs
- Shows what was fixed automatically
- Provides detailed security feedback

## ⚙️ **Customization Options**

### 1. **Change Schedule**
Edit `.github/workflows/security-analysis.yml`:
```yaml
schedule:
  # Run daily at 3 AM UTC
  - cron: '0 3 * * *'
  # Run every 6 hours
  - cron: '0 */6 * * *'
```

### 2. **Add More Branches**
```yaml
on:
  push:
    branches: [ "main", "develop", "staging" ]
  pull_request:
    branches: [ "main", "develop" ]
```

### 3. **Disable Auto-Commit**
Comment out these lines in the workflow:
```yaml
# - name: Commit security fixes
# - name: Push security fixes
```

### 4. **Add Notifications**
Add to workflow:
```yaml
- name: Notify on Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 🔐 **Secrets Configuration**

### Required Secrets (if using notifications)
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets if needed:
   - `SLACK_WEBHOOK` - For Slack notifications
   - `DISCORD_WEBHOOK` - For Discord notifications
   - `EMAIL_SMTP` - For email notifications

### Optional Environment Variables
Add to repository settings:
- `DISABLE_RATE_LIMITING=true` - Disable rate limiting in development
- `NODE_ENV=production` - Set environment

## 🚨 **Troubleshooting**

### Common Issues

#### 1. **Workflow Not Running**
- Check if Actions are enabled in repository settings
- Verify workflow file is in `.github/workflows/`
- Check for syntax errors in YAML

#### 2. **Permission Denied**
- Verify repository permissions
- Check if workflow has required permissions
- Ensure secrets are properly configured

#### 3. **Security Fixes Not Committed**
- Check if `contents: write` permission is enabled
- Verify git configuration in workflow
- Check if files are actually modified

#### 4. **CodeQL Analysis Failing**
- Check if CodeQL is enabled in security settings
- Verify `codeql-config.yml` syntax
- Check for unsupported languages

### Debug Steps
1. **Check workflow logs** in Actions tab
2. **Verify file permissions** in repository settings
3. **Test manually** using workflow_dispatch
4. **Check GitHub status** for service issues

## 📈 **Advanced Configuration**

### 1. **Matrix Strategy Customization**
```yaml
strategy:
  matrix:
    include:
    - language: javascript-typescript
      node-version: '18'
    - language: javascript-typescript
      node-version: '20'
```

### 2. **Conditional Execution**
```yaml
- name: Run only on main branch
  if: github.ref == 'refs/heads/main'
  run: echo "Running on main branch"
```

### 3. **Environment-Specific Settings**
```yaml
- name: Different settings per environment
  run: |
    if [ "${{ github.ref }}" == "refs/heads/main" ]; then
      echo "Production settings"
    else
      echo "Development settings"
    fi
```

## 🎉 **Success Indicators**

### ✅ **Workflow is Working When:**
- Security analysis runs on every push/PR
- CodeQL and ESLint results appear in Security tab
- PR comments show security analysis results
- Security fixes are automatically applied and committed
- No workflow failures in Actions tab

### 📊 **Monitoring Dashboard**
- **Actions tab**: Workflow run history
- **Security tab**: Security alerts and trends
- **Insights tab**: Repository activity and security metrics
- **Settings tab**: Security and analysis configuration

---

*This guide covers all aspects of configuring GitHub Actions for the CitizenLink security workflow.*
