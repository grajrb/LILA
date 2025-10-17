# 🚀 Quick Sevalla Deployment Steps for LILA

## Before You Start
- ✅ You have a GitHub account with LILA repository
- ✅ Your CI/CD pipeline is set up (already done!)
- ✅ You need a Sevalla account

## Step 1: Create Sevalla Account (5 minutes)

1. **Go to** [sevalla.com](https://sevalla.com)
2. **Click "Sign Up"** 
3. **Choose Free Plan** (perfect for testing)
4. **Verify your email**
5. **Complete profile setup**

## Step 2: Get Your Sevalla API Token (2 minutes)

1. **Login to** [Sevalla Dashboard](https://dashboard.sevalla.com)
2. **Go to Settings** → **API Keys**
3. **Click "Generate New Token"**
4. **Copy the token** (you'll need this for GitHub)
5. **Name it**: "LILA-GitHub-Actions"

## Step 3: Configure GitHub Secrets (3 minutes)

1. **Go to your GitHub repository**: https://github.com/grajrb/LILA
2. **Click Settings** → **Secrets and variables** → **Actions**
3. **Add these secrets** (click "New repository secret" for each):

```
SEVALLA_API_TOKEN = [paste token from Step 2]
SEVALLA_NAKAMA_HOST = lila-tictactoe.sevalla.com
SEVALLA_NAKAMA_SERVER_KEY = your-secure-32-character-random-key
SEVALLA_NAKAMA_CONSOLE_USERNAME = admin
SEVALLA_NAKAMA_CONSOLE_PASSWORD = YourSecurePassword123!
SEVALLA_DATABASE_URL = postgresql://user:pass@db.sevalla.com:5432/nakama
```

**Generate a secure server key:**
```
Use any 32-character random string like:
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## Step 4: Trigger Deployment (1 minute)

### Option A: Make a Small Change
1. **Edit any file** (like add a comment)
2. **Commit and push**:
   ```bash
   git add .
   git commit -m "Deploy to Sevalla"
   git push origin main
   ```

### Option B: Manual Trigger
1. **Go to GitHub** → **Actions tab**
2. **Click "Auto Deploy to Sevalla"**
3. **Click "Run workflow"**
4. **Click green "Run workflow" button**

## Step 5: Watch Deployment (10-15 minutes)

1. **Go to Actions tab** in your GitHub repository
2. **Click on the running workflow**
3. **Watch the deployment progress**
4. **Wait for all green checkmarks**

## Step 6: Access Your Live Game! 🎮

**Your game will be available at:**
```
https://lila-tictactoe.sevalla.com
```

**Admin console:**
```
https://lila-tictactoe.sevalla.com:7351
```

## Step 7: Test Everything Works

1. **Open the game URL** in two browser tabs
2. **Create an account** in each tab
3. **Start matchmaking** in both tabs
4. **Play a game** to verify multiplayer works!

---

## 🎯 That's It!

Your LILA Tic-Tac-Toe game is now:
- ✅ **Live on the internet**
- ✅ **Automatically deploys** on every code change
- ✅ **Supports real-time multiplayer**
- ✅ **Has professional monitoring**

## 🔧 If Something Goes Wrong

### Common Issues & Quick Fixes:

**❌ GitHub Actions failing?**
- Check all secrets are set correctly
- Verify no typos in secret names

**❌ Can't access the game?**
- Wait 5-10 more minutes for DNS propagation
- Try accessing with `https://` prefix

**❌ Game loads but no matchmaking?**
- Check Sevalla dashboard for service status
- Verify database is running

**❌ Need help?**
- Check the deployment logs in GitHub Actions
- Look at Sevalla dashboard for error messages
- Review the detailed guide: `SEVALLA-DEPLOYMENT-GUIDE.md`

---

## 🎉 Success!

Once working, you can:
- **Share your game URL** with friends
- **Make changes** and they auto-deploy
- **Monitor performance** in Sevalla dashboard
- **Scale up** as you get more players

**Your game is now live and ready for the world!** 🌍🎮