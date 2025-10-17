# 🚂 Railway Manual Deployment Guide

## When GitHub Integration Doesn't Work

### **Method 1: Railway CLI Deployment**

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Run the deployment script:**
   ```bash
   # Windows
   deploy-railway-cli.bat
   
   # Or manually:
   railway login
   railway init
   railway add --database postgresql
   railway up
   ```

### **Method 2: Docker Hub + Railway**

1. **Build and push to Docker Hub:**
   ```bash
   # Build the image
   docker build -f Dockerfile.railway -t yourusername/lila-backend .
   
   # Push to Docker Hub
   docker push yourusername/lila-backend
   ```

2. **Deploy from Docker Hub in Railway:**
   - Create new project in Railway
   - Choose "Deploy from Docker Image"
   - Enter: `yourusername/lila-backend`

### **Method 3: Alternative Platforms**

If Railway continues to have issues, try these alternatives:

#### **Render (Excellent Alternative)**
- Go to [render.com](https://render.com)
- Connect GitHub repository
- Choose "Web Service"
- Use Docker deployment

#### **Fly.io (Great for Games)**
- Go to [fly.io](https://fly.io)
- Install Fly CLI: `npm install -g @fly.io/flyctl`
- Deploy with: `fly deploy`

#### **DigitalOcean App Platform**
- Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
- Create new app from GitHub
- Choose Docker deployment

## **Troubleshooting Railway GitHub Issues**

### **Common Problems:**

1. **Repository not visible:**
   - Make repository public temporarily
   - Check Railway GitHub app permissions
   - Re-authorize Railway in GitHub settings

2. **Build fails:**
   - Ensure Dockerfile.railway is in root directory
   - Check build logs in Railway dashboard
   - Verify all files are committed to GitHub

3. **Permission errors:**
   - Go to GitHub → Settings → Applications
   - Find Railway app and grant all permissions
   - Revoke and re-authorize if needed

### **Quick Fix Steps:**

1. **Make repository public** (temporarily)
2. **Push all changes to GitHub:**
   ```bash
   git add .
   git commit -m "Add Railway configuration"
   git push origin main
   ```
3. **Try Railway GitHub connection again**
4. **If still fails, use CLI method above**