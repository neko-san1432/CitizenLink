# GitHub Actions Workflow Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                      │
│                     security-analysis.yml                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TRIGGERS      │    │   TRIGGERS      │    │   TRIGGERS      │
│                 │    │                 │    │                 │
│ • Push to main  │    │ • Pull Request  │    │ • Weekly Cron   │
│ • PR to main    │    │ • Manual Run    │    │ • Manual Run    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     WORKFLOW EXECUTION    │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      MATRIX STRATEGY      │
                    │                           │
                    │ • actions                 │
                    │ • javascript-typescript   │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │        STEPS              │
                    └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CHECKOUT    │    │   SETUP NODE    │    │  INSTALL DEPS   │
│               │    │                 │    │                 │
│ • Get code    │    │ • Node.js 18    │    │ • npm ci        │
│ • Full depth  │    │ • Cache npm     │    │ • Dependencies  │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     ANALYSIS PHASE        │
                    └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ESLINT      │    │     CODEQL      │    │  AUTO-RESOLVE   │
│               │    │                 │    │                 │
│ • Code quality│    │ • Security scan │    │ • npm audit fix │
│ • Security    │    │ • Vulnerability │    │ • Custom fixes  │
│ • SARIF output│    │ • SARIF output  │    │ • File changes  │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     COMMIT PHASE          │
                    └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ CHECK CHANGES │    │  COMMIT FIXES   │    │  PUSH CHANGES   │
│               │    │                 │    │                 │
│ • Git status  │    │ • Security bot  │    │ • Auto-push     │
│ • File diff   │    │ • Commit msg    │    │ • PR updates    │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     PR COMMENTS           │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     RESULTS OUTPUT        │
                    │                           │
                    │ • Security alerts         │
                    │ • Code quality issues     │
                    │ • Auto-fix summary        │
                    │ • PR feedback             │
                    └───────────────────────────┘
```

## Configuration Steps

### 1. **Repository Setup**
```
Settings → Actions → Allow all actions
Settings → Security → Enable all security features
```

### 2. **Workflow Triggers**
- **Push**: Every commit to main branch
- **PR**: Every pull request to main
- **Schedule**: Weekly on Sundays at 2 AM UTC
- **Manual**: Via GitHub Actions UI

### 3. **Permissions Required**
- `contents: write` - Commit security fixes
- `security-events: write` - Upload security results
- `pull-requests: write` - Comment on PRs
- `actions: read` - Read workflow status
- `packages: read` - Read npm packages

### 4. **Output Locations**
- **Security Tab**: CodeQL and ESLint alerts
- **Actions Tab**: Workflow run logs
- **PR Comments**: Detailed security feedback
- **Commits**: Auto-applied security fixes

## Quick Setup Commands

```bash
# 1. Run setup script
npm run setup-actions

# 2. Push to GitHub
git add .
git commit -m "Add GitHub Actions security workflow"
git push origin main

# 3. Enable in GitHub UI
# Go to Settings → Actions → Allow all actions
# Go to Settings → Security → Enable security scanning
```

## Monitoring

### Success Indicators
- ✅ Workflow runs on every push/PR
- ✅ Security alerts appear in Security tab
- ✅ PR comments show analysis results
- ✅ Security fixes are auto-committed
- ✅ No workflow failures

### Troubleshooting
- Check Actions tab for failed runs
- Verify repository permissions
- Check Security tab for configuration
- Review workflow logs for errors
