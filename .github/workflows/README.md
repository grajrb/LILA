# CI/CD Setup for LILA

This document explains the automated CI/CD pipeline for deploying LILA to Sevalla.

## 🔄 Workflows Overview

### 1. CI/CD Pipeline (`ci-cd.yml`)
Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
- **Lint**: Code quality checks for frontend and backend
- **Build Frontend**: Compiles Next.js application
- **Build Backend**: Compiles TypeScript match handler
- **Integration Tests**: Tests the complete application stack
- **Security**: Vulnerability scanning and npm audit
- **Performance**: Lighthouse CI for frontend performance

### 2. Auto Deploy to Sevalla (`auto-deploy-sevalla.yml`)
Triggers automatic deployment to Sevalla on every push to `main` branch.

**Jobs:**
- **Prepare Deployment**: Creates GitHub deployment tracking
- **Build and Deploy**: Builds and deploys to Sevalla
- **Verify Deployment**: Health checks and smoke tests

### 3. Manual Deploy to Sevalla (`deploy-sevalla.yml`)
Full deployment workflow with additional features like notifications.

## 🔧 Required GitHub Secrets

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

### Sevalla Configuration
```bash
SEVALLA_API_TOKEN=your-sevalla-api-token
SEVALLA_NAKAMA_HOST=your-app.sevalla.com
SEVALLA_NAKAMA_SERVER_KEY=your-production-server-key
SEVALLA_NAKAMA_CONSOLE_USERNAME=admin
SEVALLA_NAKAMA_CONSOLE_PASSWORD=your-secure-password
SEVALLA_DATABASE_URL=postgresql://user:pass@db.sevalla.com:5432/nakama
```

### Optional Notifications
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
LHCI_GITHUB_APP_TOKEN=your-lighthouse-ci-token
```

## 🚀 Deployment Process

### Automatic Deployment
1. **Push to main branch** → Triggers automatic deployment
2. **Build validation** → Ensures code compiles successfully
3. **Deploy to Sevalla** → Uses Docker Compose configuration
4. **Health checks** → Verifies all services are running
5. **Notification** → Reports deployment status

### Manual Deployment
1. Go to **Actions** tab in GitHub
2. Select **Deploy to Sevalla** workflow
3. Click **Run workflow**
4. Choose branch and deployment options

## 📊 Monitoring & Health Checks

### Automated Health Checks
- **Frontend**: `https://your-app.sevalla.com`
- **Backend API**: `https://your-app.sevalla.com:7350/healthcheck`
- **Admin Console**: `https://your-app.sevalla.com:7351/health`

### Smoke Tests
- Authentication endpoint validation
- RPC function availability
- WebSocket connection testing
- Database connectivity

## 🔧 Configuration Files

### GitHub Actions Workflows
- `.github/workflows/ci-cd.yml` - Main CI/CD pipeline
- `.github/workflows/auto-deploy-sevalla.yml` - Auto deployment
- `.github/workflows/deploy-sevalla.yml` - Manual deployment

### Deployment Configuration
- `docker-compose.sevalla.yml` - Production Docker Compose
- `client/Dockerfile.prod` - Production frontend container
- `.env.sevalla` - Production environment variables

## 🛠 Customization

### Adding New Tests
Edit `.github/workflows/ci-cd.yml`:

```yaml
- name: Custom integration test
  run: |
    # Add your test commands here
    npm run test:integration
```

### Modifying Deployment
Edit `.github/workflows/auto-deploy-sevalla.yml`:

```yaml
- name: Custom deployment step
  run: |
    # Add custom deployment logic
    ./custom-deploy-script.sh
```

### Environment-Specific Deployments
Create separate workflows for different environments:

```yaml
# .github/workflows/deploy-staging.yml
on:
  push:
    branches: [ develop ]
```

## 🔍 Troubleshooting

### Common Issues

**1. Build Failures**
- Check Node.js version compatibility
- Verify all dependencies are properly installed
- Review build logs in Actions tab

**2. Deployment Failures**
- Verify Sevalla API token is valid
- Check environment variables are set correctly
- Ensure Docker Compose configuration is valid

**3. Health Check Failures**
- Verify Sevalla application is running
- Check if services are accessible on correct ports
- Review Sevalla application logs

### Debug Commands
```bash
# Check workflow runs
gh run list --workflow=auto-deploy-sevalla.yml

# View specific run logs
gh run view <run-id> --log

# Re-run failed workflow
gh run rerun <run-id>
```

## 📚 Best Practices

### Branch Strategy
- **main**: Production deployments
- **develop**: Staging deployments  
- **feature/***: Feature development (CI only)

### Security
- Never commit secrets to repository
- Use GitHub Secrets for sensitive data
- Rotate API tokens regularly
- Enable branch protection rules

### Performance
- Use npm cache in workflows
- Optimize Docker builds with multi-stage builds
- Use workflow caching for dependencies

## 🔄 Rollback Strategy

### Automatic Rollback
```yaml
- name: Rollback on failure
  if: failure()
  run: |
    # Rollback to previous version
    sevalla rollback --app ${{ env.SEVALLA_APP_NAME }}
```

### Manual Rollback
1. Go to Sevalla dashboard
2. Select previous deployment
3. Click "Rollback"

## 📊 Metrics & Monitoring

### GitHub Actions Metrics
- Build success rate
- Deployment frequency
- Lead time for changes
- Mean time to recovery

### Application Metrics
- Response times
- Error rates
- User engagement
- Game session metrics

## 🎯 Next Steps

1. **Setup GitHub Secrets** with your Sevalla credentials
2. **Push to main branch** to trigger first deployment
3. **Monitor deployment** in Actions tab
4. **Verify application** is running on Sevalla
5. **Configure notifications** for deployment status

---

Your LILA application will now automatically deploy to Sevalla on every commit to main! 🚀