# 🚀 Hybrid Deployment Guide: Vercel + Sevalla

**Complete step-by-step guide for deploying LILA Tic-Tac-Toe with optimal performance and cost**

## 🎯 Architecture Overview

```
Frontend (Next.js) → Vercel (Global CDN)
     ↓ WebSocket/HTTP
Backend (Nakama) → Sevalla (Game Server)
     ↓ Database
CockroachDB → Sevalla (Managed Database)
```

## ⏱️ Total Time: 30-45 minutes

---

## 📋 Prerequisites

- ✅ GitHub account with your LILA repository
- ✅ Node.js 18+ and npm installed
- ✅ Docker Desktop running
- ✅ Git configured locally

---

## 🎮 Phase 1: Deploy Backend to Sevalla (15-20 minutes)

### Step 1.1: Build the Backend Match Handler

```bash
# Navigate to your project
cd "path/to/your/LILA"

# Build TypeScript match handler
cd server/typescript
npm install
npm run build

# Verify build output
ls dist/
# Should show: index.js and other compiled files
```

### Step 1.2: Create Sevalla Account

1. **Go to** [sevalla.com](https://sevalla.com)
2. **Click "Sign Up"** 
3. **Choose plan** (Free tier available)
4. **Verify email** and complete setup
5. **Note your account details**

### Step 1.3: Prepare Backend-Only Configuration

Create `docker-compose.backend.yml`:`
``yaml
# Backend-only deployment for Sevalla
version: '3.8'

services:
  # Database
  cockroachdb:
    image: cockroachdb/cockroach:latest-v23.1
    command: start-single-node --insecure
    restart: unless-stopped
    volumes:
      - cockroach_data:/cockroach/cockroach-data
    ports:
      - '26257:26257'
      - '8080:8080'
    environment:
      - COCKROACH_DATABASE=nakama
      - COCKROACH_USER=root

  # Game Server (Nakama)
  nakama:
    image: registry.heroiclabs.com/heroiclabs/nakama:3.20.0
    entrypoint:
      - '/bin/sh'
      - '-ec'
      - /nakama/nakama migrate up --database.address root@cockroachdb:26257 && exec /nakama/nakama --name nakama1 --database.address root@cockroachdb:26257 --logger.level INFO --runtime.path /nakama/data/modules --runtime.js_entrypoint index.js
    restart: unless-stopped
    depends_on:
      - cockroachdb
    volumes:
      - ./server/typescript/dist:/nakama/data/modules:ro
    ports:
      - '7349:7349' # gRPC
      - '7350:7350' # HTTP
      - '7351:7351' # Console
    environment:
      - NAKAMA_DATABASE_ADDRESS=root@cockroachdb:26257
      - NAKAMA_LOGGER_LEVEL=INFO
      - NAKAMA_SERVER_KEY=${NAKAMA_SERVER_KEY:-defaultkey}
      - NAKAMA_CONSOLE_USERNAME=${NAKAMA_CONSOLE_USERNAME:-admin}
      - NAKAMA_CONSOLE_PASSWORD=${NAKAMA_CONSOLE_PASSWORD:-password}

volumes:
  cockroach_data:
    driver: local
```

### Step 1.4: Configure Environment Variables

Create `.env.sevalla`:

```bash
# Sevalla Backend Environment
NAKAMA_SERVER_KEY=your-secure-32-character-random-key
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=YourSecurePassword123!
NODE_ENV=production
```

**Generate secure server key:**
```bash
# Use this command or create manually
openssl rand -hex 16
# Example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 1.5: Deploy to Sevalla

**Option A: Sevalla Dashboard (Recommended)**

1. **Login** to [dashboard.sevalla.com](https://dashboard.sevalla.com)
2. **Click "Create New Application"**
3. **Choose "Docker Compose"**
4. **Name**: `lila-backend`
5. **Upload** `docker-compose.backend.yml`
6. **Set Environment Variables**:
   - `NAKAMA_SERVER_KEY`: Your 32-character key
   - `NAKAMA_CONSOLE_USERNAME`: `admin`
   - `NAKAMA_CONSOLE_PASSWORD`: Your secure password
7. **Click "Deploy"**
8. **Wait 5-10 minutes** for deployment

**Option B: Sevalla CLI**

```bash
# Install Sevalla CLI
npm install -g @sevalla/cli

# Login
sevalla login

# Deploy
sevalla deploy --compose docker-compose.backend.yml
```

### Step 1.6: Verify Backend Deployment

1. **Note your Sevalla URLs**:
   - Backend API: `https://your-app.sevalla.com:7350`
   - Admin Console: `https://your-app.sevalla.com:7351`

2. **Test Backend**:
   ```bash
   # Test API health
   curl https://your-app.sevalla.com:7350/healthcheck
   
   # Should return server status
   ```

3. **Access Admin Console**:
   - Go to `https://your-app.sevalla.com:7351`
   - Login with your admin credentials
   - Verify match handler is loaded

---

## 🌐 Phase 2: Deploy Frontend to Vercel (10-15 minutes)

### Step 2.1: Prepare Frontend Configuration

Update `client/.env.local` for production:

```bash
# Production environment variables
NEXT_PUBLIC_NAKAMA_HOST=your-app.sevalla.com
NEXT_PUBLIC_NAKAMA_PORT=7350
NEXT_PUBLIC_NAKAMA_SERVER_KEY=your-secure-32-character-key
NEXT_PUBLIC_NAKAMA_USE_SSL=true
```

### Step 2.2: Test Frontend Build Locally

```bash
cd client
npm install
npm run build
npm start

# Test at http://localhost:3000
# Verify it connects to your Sevalla backend
```

### Step 2.3: Push to GitHub

```bash
# From project root
git add .
git commit -m "Configure for hybrid deployment"
git push origin main
```

### Step 2.4: Deploy to Vercel

1. **Go to** [vercel.com](https://vercel.com)
2. **Sign up/Login** with GitHub
3. **Click "New Project"**
4. **Import** your LILA repository
5. **Configure Project**:
   - Framework Preset: `Next.js`
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `.next`

6. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_NAKAMA_HOST = your-app.sevalla.com
   NEXT_PUBLIC_NAKAMA_PORT = 7350
   NEXT_PUBLIC_NAKAMA_SERVER_KEY = your-secure-32-character-key
   NEXT_PUBLIC_NAKAMA_USE_SSL = true
   ```

7. **Click "Deploy"**
8. **Wait 3-5 minutes** for deployment

### Step 2.5: Verify Frontend Deployment

1. **Access your Vercel URL**: `https://your-project.vercel.app`
2. **Test game functionality**:
   - Open two browser tabs
   - Create accounts in both
   - Start matchmaking
   - Play a game to verify real-time sync

---

## ✅ Phase 3: Final Configuration & Testing (5-10 minutes)

### Step 3.1: Configure CORS (if needed)

If you get CORS errors, update your Nakama configuration:

1. **Access Sevalla Admin Console**: `https://your-app.sevalla.com:7351`
2. **Go to Configuration**
3. **Add CORS settings**:
   ```json
   {
     "cors": {
       "allowed_origins": ["https://your-project.vercel.app"],
       "allowed_methods": ["GET", "POST", "PUT", "DELETE"],
       "allowed_headers": ["*"]
     }
   }
   ```

### Step 3.2: Set Up Custom Domain (Optional)

**For Vercel:**
1. **Go to Vercel Dashboard** → Your Project → Settings → Domains
2. **Add your domain**: `yourgame.com`
3. **Configure DNS** as instructed

**For Sevalla:**
1. **Go to Sevalla Dashboard** → Your App → Domains
2. **Add subdomain**: `api.yourgame.com`
3. **Update Vercel environment variables** to use custom domain

### Step 3.3: Complete End-to-End Testing

**Test Checklist:**
- [ ] Frontend loads on Vercel URL
- [ ] Backend API responds on Sevalla URL
- [ ] Admin console accessible
- [ ] User registration works
- [ ] Matchmaking connects players
- [ ] Real-time gameplay functions
- [ ] Game completion updates stats
- [ ] Leaderboard displays correctly

### Step 3.4: Set Up Monitoring

**Vercel Monitoring:**
- Built-in analytics available in dashboard
- Set up alerts for deployment failures

**Sevalla Monitoring:**
- Monitor CPU/memory usage in dashboard
- Set up health check alerts
- Monitor database performance

---

## 🎯 Final URLs & Access Points

After successful deployment:

**🎮 Game (Frontend)**: `https://your-project.vercel.app`
**🔧 API (Backend)**: `https://your-app.sevalla.com:7350`
**⚙️ Admin Console**: `https://your-app.sevalla.com:7351`
**📊 Database**: `https://your-app.sevalla.com:8080` (CockroachDB UI)

---

## 🔄 Automatic Deployments

### Frontend Auto-Deploy (Vercel)
- **Automatic**: Every push to `main` branch
- **Preview**: Every pull request gets preview URL
- **Rollback**: One-click rollback in Vercel dashboard

### Backend Auto-Deploy (Sevalla)
Set up GitHub Actions for backend:

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend to Sevalla

on:
  push:
    branches: [main]
    paths: ['server/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Build Backend
        run: |
          cd server/typescript
          npm install
          npm run build
          
      - name: Deploy to Sevalla
        run: |
          # Add Sevalla deployment commands
          echo "Deploy to Sevalla"
```

---

## 💰 Cost Breakdown

**Vercel (Frontend):**
- Free tier: 100GB bandwidth, unlimited deployments
- Pro: $20/month for team features

**Sevalla (Backend):**
- Free tier: Basic resources for testing
- Paid plans: Scale based on usage

**Total Monthly Cost (Small Scale):**
- Development/Testing: **$0** (free tiers)
- Production (low traffic): **$10-30/month**
- Production (high traffic): **$50-100/month**

---

## 🚀 Performance Benefits

**Frontend (Vercel):**
- ⚡ Global CDN with edge caching
- 🔄 Automatic image optimization
- 📱 Perfect Lighthouse scores
- 🌍 Sub-100ms response times globally

**Backend (Sevalla):**
- 🎮 Optimized for real-time gaming
- 📊 Built-in monitoring and scaling
- 🔒 Enterprise-grade security
- ⚡ Low-latency WebSocket connections

---

## 🆘 Troubleshooting

### Common Issues & Solutions

**❌ Frontend can't connect to backend**
```bash
# Check environment variables
vercel env ls

# Update if needed
vercel env add NEXT_PUBLIC_NAKAMA_HOST
```

**❌ CORS errors**
- Add Vercel domain to Nakama CORS settings
- Verify SSL settings match (both HTTPS)

**❌ WebSocket connection fails**
- Check firewall settings on Sevalla
- Verify ports 7350/7351 are open
- Test with `wss://` protocol

**❌ Database connection issues**
- Check CockroachDB service status in Sevalla
- Verify database URL format
- Check connection limits

### Getting Help

**Vercel Support:**
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Discord](https://vercel.com/discord)

**Sevalla Support:**
- [Sevalla Documentation](https://docs.sevalla.com)
- [Sevalla Support](https://sevalla.com/support)

---

## 🎉 Congratulations!

Your LILA Tic-Tac-Toe game is now deployed with:

✅ **Optimal Performance**: Global CDN + specialized game server
✅ **Cost Effective**: Generous free tiers + pay-as-you-scale
✅ **Auto Deployments**: Push to deploy automatically
✅ **Professional Monitoring**: Built-in analytics and alerts
✅ **Scalable Architecture**: Ready for thousands of players

**Share your game and start collecting feedback!** 🎮✨

---

## 📚 Next Steps

1. **Monitor Performance**: Watch analytics in both dashboards
2. **Gather Feedback**: Share with friends and collect user feedback
3. **Add Features**: Use the scalable architecture to add new game modes
4. **Optimize**: Use performance data to optimize bottlenecks
5. **Scale**: Upgrade plans as your player base grows

**Your multiplayer game is now live and ready for the world!** 🌍