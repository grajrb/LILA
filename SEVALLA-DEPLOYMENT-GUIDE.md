# Step-by-Step Sevalla Deployment Guide for LILA

This is your complete guide to deploy the LILA Tic-Tac-Toe application on Sevalla from start to finish.

## 🎯 Overview

You'll deploy:
- **Frontend**: Next.js application (Tic-Tac-Toe game interface)
- **Backend**: Nakama game server (matchmaking, real-time gameplay)
- **Database**: CockroachDB/PostgreSQL (user data, game stats)

Total deployment time: **15-30 minutes**

---

## 📋 Step 1: Create Sevalla Account & Setup

### 1.1 Sign Up for Sevalla
1. Go to [sevalla.com](https://sevalla.com)
2. Click **"Sign Up"** 
3. Choose a plan (Free tier available for testing)
4. Verify your email address
5. Complete account setup

### 1.2 Install Sevalla CLI (Optional but Recommended)
```bash
# Install via npm
npm install -g @sevalla/cli

# Verify installation
sevalla --version

# Login to your account
sevalla login
```

---

## 🔧 Step 2: Prepare Your Application

### 2.1 Build the Backend Match Handler
```bash
# Navigate to your project
cd "D:\DRIVE D\projects\LILA"

# Build TypeScript match handler
cd server/typescript
npm install
npm run build

# Verify build output
dir dist
# Should show: index.js, index.d.ts, and other compiled files
```

### 2.2 Test Frontend Build
```bash
# Navigate to frontend
cd ..\..\client

# Install dependencies and build
npm install
npm run build

# Verify build works
npm start
# Should start on http://localhost:3000
```

---

## 🌐 Step 3: Deploy to Sevalla

### Method A: Using Sevalla Dashboard (Recommended for Beginners)

#### 3.1 Create New Application
1. Login to [Sevalla Dashboard](https://dashboard.sevalla.com)
2. Click **"Create New Application"**
3. Choose **"Docker Compose"** deployment type
4. Name your app: `lila-tictactoe` (or your preferred name)
5. Select region closest to your users

#### 3.2 Upload Configuration Files
1. In the dashboard, go to **"Configuration"** tab
2. Upload your `docker-compose.sevalla.yml` file
3. Upload your `.env.sevalla` file (create if doesn't exist)

#### 3.3 Configure Environment Variables
In the **Environment Variables** section, add:

```bash
# Required Variables
NAKAMA_HOST=your-app-name.sevalla.com
NAKAMA_SERVER_KEY=your-32-character-secure-key
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=your-secure-admin-password
NODE_ENV=production

# Database (will be provided by Sevalla)
DATABASE_URL=postgresql://user:pass@db.sevalla.com:5432/nakama

# Frontend Variables
NEXT_PUBLIC_NAKAMA_HOST=your-app-name.sevalla.com
NEXT_PUBLIC_NAKAMA_PORT=7350
NEXT_PUBLIC_NAKAMA_SERVER_KEY=your-32-character-secure-key
NEXT_PUBLIC_NAKAMA_USE_SSL=true
```

#### 3.4 Deploy Application
1. Click **"Deploy"** button
2. Wait for build process (5-10 minutes)
3. Monitor deployment logs for any errors
4. Once complete, you'll get your application URLs

### Method B: Using Sevalla CLI

#### 3.1 Initialize Sevalla Project
```bash
# In your project root
cd "D:\DRIVE D\projects\LILA"

# Initialize Sevalla project
sevalla init

# Follow prompts:
# - Project name: lila-tictactoe
# - Deployment type: Docker Compose
# - Configuration file: docker-compose.sevalla.yml
```

#### 3.2 Configure Environment
```bash
# Create environment file
sevalla env:set NAKAMA_HOST=your-app-name.sevalla.com
sevalla env:set NAKAMA_SERVER_KEY=your-32-character-secure-key
sevalla env:set NAKAMA_CONSOLE_USERNAME=admin
sevalla env:set NAKAMA_CONSOLE_PASSWORD=your-secure-admin-password
sevalla env:set NODE_ENV=production
```

#### 3.3 Deploy
```bash
# Deploy to Sevalla
sevalla deploy

# Monitor deployment
sevalla logs --follow
```

---

## 🔗 Step 4: Configure Services

### 4.1 Database Setup
1. In Sevalla Dashboard, go to **"Add-ons"**
2. Add **"CockroachDB"** or **"PostgreSQL"**
3. Choose appropriate plan (Free tier available)
4. Note the connection string provided
5. Update `DATABASE_URL` environment variable

### 4.2 Custom Domain (Optional)
1. Go to **"Domains"** in dashboard
2. Click **"Add Custom Domain"**
3. Enter your domain: `yourgame.com`
4. Follow DNS configuration instructions:
   ```
   Type: CNAME
   Name: @
   Value: your-app-name.sevalla.com
   ```
5. Wait for DNS propagation (up to 24 hours)

### 4.3 SSL Certificate
- Sevalla automatically provisions SSL certificates
- No additional configuration needed
- Certificate will be ready within 10-15 minutes

---

## ✅ Step 5: Verify Deployment

### 5.1 Check Application Status
1. In Sevalla Dashboard, go to **"Services"**
2. Verify all services show **"Running"** status:
   - `frontend` (Next.js)
   - `nakama` (Game Server)
   - `database` (CockroachDB/PostgreSQL)

### 5.2 Test Application URLs
Open these URLs in your browser:

**Frontend Application:**
```
https://your-app-name.sevalla.com
```
Should load the Tic-Tac-Toe game interface.

**Admin Console:**
```
https://your-app-name.sevalla.com:7351
```
Login with your admin credentials to access Nakama console.

**API Health Check:**
```
https://your-app-name.sevalla.com:7350/healthcheck
```
Should return server status information.

### 5.3 Test Game Functionality
1. **Open game in two browser tabs/windows**
2. **Create account** in first tab
3. **Join matchmaking queue**
4. **Create account** in second tab  
5. **Join matchmaking** - should match with first player
6. **Play a game** to verify real-time functionality

---

## 🔧 Step 6: Configure Automatic Deployments

### 6.1 GitHub Secrets Setup
1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Add these repository secrets:

```bash
SEVALLA_API_TOKEN=your-sevalla-api-token
SEVALLA_NAKAMA_HOST=your-app-name.sevalla.com
SEVALLA_NAKAMA_SERVER_KEY=your-32-character-secure-key
SEVALLA_NAKAMA_CONSOLE_USERNAME=admin
SEVALLA_NAKAMA_CONSOLE_PASSWORD=your-secure-admin-password
SEVALLA_DATABASE_URL=your-database-connection-string
```

### 6.2 Get Sevalla API Token
1. In Sevalla Dashboard, go to **"API Keys"**
2. Click **"Generate New Token"**
3. Copy the token and add to GitHub secrets as `SEVALLA_API_TOKEN`

### 6.3 Test Automatic Deployment
1. Make a small change to your code
2. Commit and push to main branch:
   ```bash
   git add .
   git commit -m "Test automatic deployment"
   git push origin main
   ```
3. Go to GitHub **Actions** tab
4. Watch the deployment workflow run
5. Verify changes appear on your live site

---

## 📊 Step 7: Monitor and Scale

### 7.1 Application Monitoring
- **Sevalla Dashboard**: View CPU, memory, and request metrics
- **Nakama Console**: Monitor player connections and game sessions
- **Application Logs**: Check for errors and performance issues

### 7.2 Scaling Configuration
In Sevalla Dashboard → **"Scaling"**:
```yaml
Frontend:
  Min instances: 1
  Max instances: 3
  CPU threshold: 70%

Nakama:
  Min instances: 1  
  Max instances: 2
  Memory threshold: 80%
```

### 7.3 Performance Optimization
1. **Enable CDN** in Sevalla Dashboard
2. **Configure caching** for static assets
3. **Set up health checks** for automatic restarts
4. **Enable compression** for faster loading

---

## 🎯 Final Deployment Checklist

### ✅ Pre-deployment
- [ ] TypeScript match handler built successfully
- [ ] Frontend builds without errors
- [ ] Environment variables configured
- [ ] Sevalla account created and verified

### ✅ Deployment
- [ ] Application deployed to Sevalla
- [ ] Database service running
- [ ] All services show "Running" status
- [ ] Custom domain configured (if using)

### ✅ Testing
- [ ] Frontend loads correctly
- [ ] Admin console accessible
- [ ] API endpoints responding
- [ ] Matchmaking works between players
- [ ] Real-time gameplay functional

### ✅ Automation
- [ ] GitHub secrets configured
- [ ] Automatic deployment tested
- [ ] Monitoring alerts set up
- [ ] Scaling rules configured

---

## 🎮 Your Live Application

After successful deployment, your LILA Tic-Tac-Toe game will be available at:

**🌐 Game URL:** `https://your-app-name.sevalla.com`
**⚙️ Admin Console:** `https://your-app-name.sevalla.com:7351`  
**🔧 API Endpoint:** `https://your-app-name.sevalla.com:7350`

### Share Your Game
- Send the game URL to friends to test multiplayer
- Share on social media
- Add to your portfolio

---

## 🆘 Troubleshooting Common Issues

### Issue: Services Won't Start
**Solution:**
1. Check environment variables are set correctly
2. Verify Docker images are building successfully
3. Check Sevalla dashboard logs for error messages

### Issue: Can't Connect to Game Server
**Solution:**
1. Verify `NAKAMA_HOST` matches your Sevalla app URL
2. Check firewall settings allow ports 7350 and 7351
3. Ensure SSL settings match between frontend and backend

### Issue: Database Connection Errors
**Solution:**
1. Verify database add-on is running
2. Check `DATABASE_URL` format is correct
3. Ensure database migrations completed

### Issue: Automatic Deployment Failing
**Solution:**
1. Check GitHub secrets are set correctly
2. Verify Sevalla API token is valid
3. Review GitHub Actions logs for specific errors

---

## 🎉 Congratulations!

Your LILA Tic-Tac-Toe application is now live on Sevalla! Players can access your game from anywhere in the world, and every code change will automatically deploy.

**Next steps:**
- Monitor your application performance
- Gather user feedback
- Add new game features
- Scale based on player demand

Happy gaming! 🎮✨