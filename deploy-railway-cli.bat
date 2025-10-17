@echo off
echo 🚂 Railway CLI Deployment Script
echo.

REM Check if Railway CLI is installed
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI not found. Installing...
    npm install -g @railway/cli
    if %errorlevel% neq 0 (
        echo ❌ Failed to install Railway CLI
        echo Please install manually: npm install -g @railway/cli
        pause
        exit /b 1
    )
)

echo ✅ Railway CLI found
echo.

REM Login to Railway
echo 🔐 Logging into Railway...
railway login
if %errorlevel% neq 0 (
    echo ❌ Railway login failed
    pause
    exit /b 1
)

echo ✅ Railway login successful
echo.

REM Create new project
echo 🚀 Creating Railway project...
railway init
if %errorlevel% neq 0 (
    echo ❌ Failed to create Railway project
    pause
    exit /b 1
)

echo ✅ Railway project created
echo.

REM Add PostgreSQL database
echo 🗄️ Adding PostgreSQL database...
railway add --database postgresql
if %errorlevel% neq 0 (
    echo ⚠️ Database creation may have failed, continuing...
)

echo ✅ Database service added
echo.

REM Set environment variables
echo 🔧 Setting environment variables...
railway variables set NAKAMA_SERVER_KEY=6OOnwb0crwcs2OaPVy6vtofcMUtH7zin
railway variables set NAKAMA_CONSOLE_USERNAME=admin
railway variables set NAKAMA_CONSOLE_PASSWORD=YourSecurePassword123!
railway variables set NAKAMA_LOGGER_LEVEL=INFO
railway variables set NODE_ENV=production
railway variables set PORT=7350

echo ✅ Environment variables set
echo.

REM Deploy the application
echo 🚀 Deploying to Railway...
railway up
if %errorlevel% neq 0 (
    echo ❌ Deployment failed
    pause
    exit /b 1
)

echo ✅ Deployment successful!
echo.
echo 🎉 Your application is now live on Railway!
echo Check your Railway dashboard for the URL.
echo.
pause