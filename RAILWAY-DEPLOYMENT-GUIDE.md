# 🚂 Railway Deployment Guide: Complete Step-by-Step

**Deploy LILA Tic-Tac-Toe Backend to Railway + Frontend to Vercel**

## 🎯 Why Railway?

- ✅ **Excellent for game servers** - optimized for real-time applications
- ✅ **Simple deployment** - connect GitHub and deploy
- ✅ **Great free tier** - $5 credit monthly, perfect for testing
- ✅ **Auto-scaling** - handles traffic spikes automatically
- ✅ **Built-in database** - PostgreSQL included

## ⏱️ Total Time: 20-30 minutes

---

## 📋 Prerequisites

- ✅ GitHub account with LILA repository
- ✅ Railway account (we'll create this)
- ✅ Generate a secure 32-character key (we'll show you how)

---

## 🚂 Phase 1: Deploy Backend to Railway (15-20 minutes)

### Step 1.1: Create Railway Account

1. **Go to** [railway.app](https://railway.app)
2. **Click "Start a New Project"**
3. **Sign up with GitHub** (recommended for easy deployment)
4. **Verify your account**
5. **You get $5 free credit** to start

### Step 1.2: Prepare Backend Configuration

First, let's create Railway-specific configuration files:

**Create `railway.json`:**```json
{

  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.railway"
  },
  "deploy": {
    "startCommand": "/nakama/nakama --name nakama1 --database.address $DATABASE_URL --logger.level INFO --runtime.path /nakama/data/modules --runtime.js_entrypoint index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Create `Dockerfile.railway`:**

```dockerfile
# Railway-optimized Dockerfile for Nakama + TypeScript
FROM registry.heroiclabs.com/heroiclabs/nakama:3.20.0

# Create modules directory
RUN mkdir -p /nakama/data/modules

# Copy built TypeScript match handler
COPY server/typescript/dist/ /nakama/data/modules/

# Set working directory
WORKDIR /nakama

# Expose ports
EXPOSE 7349 7350 7351

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:7350/healthcheck || exit 1

# Default command (will be overridden by Railway)
CMD ["/nakama/nakama", "--name", "nakama1", "--logger.level", "INFO", "--runtime.path", "/nakama/data/modules", "--runtime.js_entrypoint", "index.js"]
```

**Create `.env.railway`:**

```bash
# Railway Environment Variables
NAKAMA_SERVER_KEY=your-secure-32-character-key-here
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=your-secure-password-here
NAKAMA_LOGGER_LEVEL=INFO
NODE_ENV=production
PORT=7350
```

### Step 1.3: Build Backend Match Handler

```bash
# Navigate to your project
cd "path/to/your/LILA"

# Build TypeScript match handler
cd server/typescript
npm install
npm run build

# Verify build
ls dist/
# Should show: index.js and other files

# Return to project root
cd ../..
```

### Step 1.4: Create Railway Project

1. **Login to Railway Dashboard**: [railway.app/dashboard](https://railway.app/dashboard)
2. **Click "New Project"**
3. **Choose "Deploy from GitHub repo"**
4. **Select your LILA repository**
5. **Choose "Deploy Now"** (Railway will detect your Dockerfile)

### Step 1.5: Add Database Service

1. **In your Railway project**, click **"+ New Service"**
2. **Choose "Database"**
3. **Select "PostgreSQL"**
4. **Railway will provision** a PostgreSQL database
5. **Note the connection details** (automatically available as `DATABASE_URL`)

### Step 1.6: Configure Environment Variables

1. **Go to your Nakama service** in Railway
2. **Click "Variables" tab**
3. **Add these variables**:

```bash
NAKAMA_SERVER_KEY=your-secure-32-character-key-here
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=your-secure-password-here
NAKAMA_LOGGER_LEVEL=INFO
NODE_ENV=production
PORT=7350
```

**Note**: `DATABASE_URL` is automatically provided by Railway when you add PostgreSQL.

### Step 1.7: Deploy and Verify

1. **Railway will automatically deploy** after you add variables
2. **Wait 5-10 minutes** for deployment
3. **Check deployment logs** in Railway dashboard
4. **Get your Railway URLs**:
   - API: `https://your-app.up.railway.app`
   - Console: `https://your-app.up.railway.app:7351` (if exposed)

### Step 1.8: Test Backend Deployment

```bash
# Test API health (replace with your Railway URL)
curl https://your-app.up.railway.app/healthcheck

# Should return server status
```

---

## 🌐 Phase 2: Deploy Frontend to Vercel (10-15 minutes)

### Step 2.1: Update Frontend Configuration

Update `client/.env.local`:

```bash
# Production environment for Railway backend
NEXT_PUBLIC_NAKAMA_HOST=your-app.up.railway.app
NEXT_PUBLIC_NAKAMA_PORT=443
NEXT_PUBLIC_NAKAMA_SERVER_KEY=your-secure-32-character-key-here
NEXT_PUBLIC_NAKAMA_USE_SSL=true
```

**Note**: Railway uses port 443 (HTTPS) for external connections.

### Step 2.2: Test Frontend Locally

```bash
cd client
npm install
npm run build
npm start

# Test at http://localhost:3000
# Verify connection to Railway backend
```

### Step 2.3: Deploy to Vercel

1. **Go to** [vercel.com](https://vercel.com)
2. **Sign up/Login** with GitHub
3. **Click "New Project"**
4. **Import your LILA repository**
5. **Configure Project**:
   - Framework: `Next.js`
   - Root Directory: `client`
   - Build Command: `npm run build`

6. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_NAKAMA_HOST = your-app.up.railway.app
   NEXT_PUBLIC_NAKAMA_PORT = 443
   NEXT_PUBLIC_NAKAMA_SERVER_KEY = your-secure-32-character-key-here
   NEXT_PUBLIC_NAKAMA_USE_SSL = true
   ```

7. **Click "Deploy"**
8. **Wait 3-5 minutes** for deployment

---

## ✅ Phase 3: Final Configuration & Testing

### Step 3.1: Configure Railway Networking

1. **In Railway Dashboard**, go to your Nakama service
2. **Click "Settings" tab**
3. **Scroll to "Networking"**
4. **Add custom ports** if needed:
   - Port 7350 (HTTP API)
   - Port 7351 (Console) - optional

### Step 3.2: Update CORS Settings

If you get CORS errors:

1. **Access Railway logs** to check for CORS issues
2. **Add CORS configuration** to your Nakama setup
3. **Redeploy** if needed

### Step 3.3: Complete Testing

**Test Checklist:**
- [ ] Railway backend responds: `https://your-app.up.railway.app/healthcheck`
- [ ] Vercel frontend loads: `https://your-project.vercel.app`
- [ ] User registration works
- [ ] Matchmaking connects players
- [ ] Real-time gameplay functions
- [ ] Database stores game data

### Step 3.4: Monitor Performance

**Railway Monitoring:**
- Built-in metrics in Railway dashboard
- CPU, memory, and network usage
- Deployment logs and error tracking

**Vercel Monitoring:**
- Analytics in Vercel dashboard
- Performance insights
- Error tracking

---

## 🎯 Final URLs & Access

After successful deployment:

**🎮 Game (Frontend)**: `https://your-project.vercel.app`
**🔧 API (Backend)**: `https://your-app.up.railway.app`
**📊 Database**: Available via Railway dashboard
**📈 Monitoring**: Railway + Vercel dashboards

---

## 💰 Cost Breakdown

**Railway (Backend + Database):**
- **Free tier**: $5 credit monthly (covers small apps)
- **Usage-based**: ~$0.10/hour for basic resources
- **Estimated**: $10-20/month for moderate usage

**Vercel (Frontend):**
- **Free tier**: 100GB bandwidth, unlimited deployments
- **Pro**: $20/month for team features

**Total Monthly Cost:**
- **Development**: $0-5 (within free credits)
- **Production (low traffic)**: $10-25/month
- **Production (high traffic)**: $30-50/month

---

## 🚀 Automatic Deployments

### Frontend (Vercel)
- **Automatic**: Every push to `main` branch
- **Preview**: Every pull request

### Backend (Railway)
- **Automatic**: Every push to `main` branch
- **Rollback**: One-click rollback in Railway dashboard

---

## 🔧 Railway-Specific Tips

### **Environment Variables**
- Railway automatically provides `DATABASE_URL`
- Use Railway's built-in secrets management
- Variables are encrypted and secure

### **Scaling**
- Railway auto-scales based on CPU/memory usage
- Set scaling limits in service settings
- Monitor usage in dashboard

### **Logs & Debugging**
- Real-time logs in Railway dashboard
- Filter by service and time range
- Export logs for analysis

### **Custom Domains**
- Add custom domain in Railway settings
- Automatic SSL certificate provisioning
- CNAME setup required

---

## 🆘 Troubleshooting

### **Common Railway Issues**

**❌ Build fails**
```bash
# Check Dockerfile.railway is in project root
# Verify TypeScript build completed
# Check Railway build logs
```

**❌ Database connection fails**
```bash
# Verify PostgreSQL service is running
# Check DATABASE_URL is automatically set
# Ensure Nakama can connect to database
```

**❌ Port issues**
```bash
# Railway expects app to listen on PORT environment variable
# Default Railway port is what's in PORT env var
# External access is via Railway's proxy
```

### **Getting Help**

**Railway Support:**
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Community](https://help.railway.app)

---

## 🎉 Success!

Your LILA Tic-Tac-Toe game is now deployed with:

✅ **Railway Backend**: Optimized for real-time gaming
✅ **Vercel Frontend**: Global CDN performance  
✅ **PostgreSQL Database**: Managed and scalable
✅ **Auto Deployments**: Push to deploy
✅ **Monitoring**: Built-in analytics and logs

## 📚 Next Steps

1. **Test thoroughly** with multiple players
2. **Monitor performance** in both dashboards
3. **Set up alerts** for downtime or errors
4. **Scale resources** as player base grows
5. **Add custom domains** for professional URLs

**Your multiplayer game is live and ready for players!** 🎮🚂

---

## 🔗 Quick Reference

**Railway Dashboard**: [railway.app/dashboard](https://railway.app/dashboard)
**Vercel Dashboard**: [vercel.com/dashboard](https://vercel.com/dashboard)
**Your Game**: `https://your-project.vercel.app`
**Your API**: `https://your-app.up.railway.app`

**Environment Key**: Generate your own secure 32-character key