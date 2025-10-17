# Railway Nakama Deployment Guide

## Quick Railway Deployment

### Method 1: Deploy from GitHub
1. Go to [railway.app](https://railway.app)
2. Click "Deploy from GitHub repo"
3. Select your LILA repository
4. Choose the root directory (contains Dockerfile)
5. Railway will automatically detect and deploy using the Dockerfile

### Method 2: Deploy Manually
1. Go to Railway dashboard
2. Create new project
3. Add PostgreSQL database
4. Add new service from GitHub
5. Set these environment variables:
   ```
   NAKAMA_SERVER_KEY=6OOnwb0crwcs2OaPVy6vtofcMUtH7zin
   NAKAMA_CONSOLE_USERNAME=admin
   NAKAMA_CONSOLE_PASSWORD=YourSecurePassword123
   NODE_ENV=production
   PORT=7350
   ```

### Expected Result
After deployment, you should get a URL like:
`https://your-new-app.up.railway.app`

Update your Vercel environment variables with this new URL.

## Alternative: Use Local Development

If Railway deployment is complex, you can test locally:

1. Start local Nakama server
2. Use ngrok to expose it publicly
3. Update Vercel to point to ngrok URL

Would you like me to help with any of these approaches?