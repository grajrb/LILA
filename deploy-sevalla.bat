@echo off
REM LILA Complete Deployment Script for Sevalla (Windows)
REM This script prepares and deploys both frontend and backend

setlocal enabledelayedexpansion

echo 🚀 Starting LILA deployment preparation...

REM Check prerequisites
echo 📋 Checking prerequisites...

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install Node.js and npm first.
    exit /b 1
)

REM Build backend (TypeScript match handler)
echo 🔨 Building backend match handler...
cd server\typescript

if not exist "package.json" (
    echo ❌ Backend package.json not found!
    exit /b 1
)

call npm install
call npm run build

if not exist "dist\index.js" (
    echo ❌ Backend build failed - index.js not found!
    exit /b 1
)

echo ✅ Backend build complete

REM Return to root directory
cd ..\..

REM Install frontend dependencies
echo 🔨 Installing frontend dependencies...
cd client

if not exist "package.json" (
    echo ❌ Frontend package.json not found!
    exit /b 1
)

call npm install

REM Build frontend for production
echo 🔨 Building frontend for production...
call npm run build

if not exist ".next" (
    echo ❌ Frontend build failed - .next directory not found!
    exit /b 1
)

echo ✅ Frontend build complete

REM Return to root directory
cd ..

REM Create environment file template
echo 📝 Creating environment template...
echo # Sevalla Production Environment Variables > .env.sevalla.template
echo # Copy this to .env.sevalla and update with your values >> .env.sevalla.template
echo. >> .env.sevalla.template
echo NAKAMA_HOST=your-app.sevalla.com >> .env.sevalla.template
echo NAKAMA_SERVER_KEY=generate-secure-32-char-key >> .env.sevalla.template
echo NAKAMA_CONSOLE_USERNAME=admin >> .env.sevalla.template
echo NAKAMA_CONSOLE_PASSWORD=your-secure-password >> .env.sevalla.template
echo NODE_ENV=production >> .env.sevalla.template
echo DATABASE_URL=postgresql://user:password@db.sevalla.com:5432/nakama >> .env.sevalla.template

REM Check if .env.sevalla exists
if not exist ".env.sevalla" (
    echo ⚠️  .env.sevalla not found. Creating from template...
    copy .env.sevalla.template .env.sevalla
    echo 📝 Please edit .env.sevalla with your production values before deploying!
)

REM Validate deployment files
echo 🔍 Validating deployment files...

if not exist "docker-compose.sevalla.yml" (
    echo ❌ Required file missing: docker-compose.sevalla.yml
    exit /b 1
)

if not exist "client\Dockerfile.prod" (
    echo ❌ Required file missing: client\Dockerfile.prod
    exit /b 1
)

if not exist "server\typescript\dist\index.js" (
    echo ❌ Required file missing: server\typescript\dist\index.js
    exit /b 1
)

if not exist ".env.sevalla" (
    echo ❌ Required file missing: .env.sevalla
    exit /b 1
)

echo ✅ All required files present

REM Create deployment package
echo 📦 Creating deployment package...
set deployment_dir=lila-deployment-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set deployment_dir=!deployment_dir: =0!

mkdir "%deployment_dir%"

REM Copy necessary files
copy docker-compose.sevalla.yml "%deployment_dir%\"
copy .env.sevalla "%deployment_dir%\"
xcopy /E /I client "%deployment_dir%\client"
mkdir "%deployment_dir%\server\typescript"
xcopy /E /I server\typescript\dist "%deployment_dir%\server\typescript\dist"

REM Create deployment README
echo # LILA Deployment Package > "%deployment_dir%\README.md"
echo. >> "%deployment_dir%\README.md"
echo Generated on: %date% %time% >> "%deployment_dir%\README.md"
echo. >> "%deployment_dir%\README.md"
echo ## Files Included: >> "%deployment_dir%\README.md"
echo - docker-compose.sevalla.yml: Main deployment configuration >> "%deployment_dir%\README.md"
echo - .env.sevalla: Environment variables (edit before deploying) >> "%deployment_dir%\README.md"
echo - client/: Frontend application with production Dockerfile >> "%deployment_dir%\README.md"
echo - server/typescript/dist/: Built backend match handler >> "%deployment_dir%\README.md"
echo. >> "%deployment_dir%\README.md"
echo ## Deployment Instructions: >> "%deployment_dir%\README.md"
echo. >> "%deployment_dir%\README.md"
echo ### Method 1: Sevalla CLI >> "%deployment_dir%\README.md"
echo ```bash >> "%deployment_dir%\README.md"
echo sevalla login >> "%deployment_dir%\README.md"
echo sevalla deploy --compose docker-compose.sevalla.yml >> "%deployment_dir%\README.md"
echo ``` >> "%deployment_dir%\README.md"

echo ✅ Deployment package created: %deployment_dir%

REM Display summary
echo.
echo 🎉 LILA deployment preparation complete!
echo.
echo 📋 Summary:
echo    • Backend build: ✅ Complete
echo    • Frontend build: ✅ Complete
echo    • Deployment package: ✅ %deployment_dir%
echo.
echo 📝 Next Steps:
echo    1. Edit %deployment_dir%\.env.sevalla with your production values
echo    2. Deploy using Sevalla CLI or Dashboard
echo    3. Configure custom domain (optional)
echo    4. Test the deployment
echo.
echo 📚 Documentation:
echo    • Full guide: deployment\sevalla-complete-deployment.md
echo    • Package README: %deployment_dir%\README.md
echo.
echo Ready to deploy! 🚀

pause