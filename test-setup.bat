@echo off
REM Test script to verify local development setup (Windows)

echo 🧪 LILA Tic-Tac-Toe Development Test
echo ====================================

REM Check if required tools are installed
echo 📋 Checking prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js: %%i

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do echo ✅ npm: %%i

where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('docker --version') do echo ✅ Docker: %%i

echo.
echo 🏗️ Building server components...

REM Build TypeScript match handler
cd /d "%~dp0server\typescript"
if not exist package.json (
    echo ❌ Server package.json not found
    exit /b 1
)

call npm install --silent
call npm run build

if not exist build\index.js (
    echo ❌ TypeScript compilation failed
    exit /b 1
)
echo ✅ Server build successful

cd /d "%~dp0"

echo.
echo 🎯 Installing client dependencies...

cd client
call npm install --silent

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Client dependency installation failed
    exit /b 1
)
echo ✅ Client dependencies installed

echo.
echo 🚀 Verification complete!
echo.
echo To start development:
echo 1. Terminal 1: cd server ^&^& docker-compose up
echo 2. Terminal 2: cd client ^&^& npm run dev  
echo 3. Open http://localhost:3000 in two browser tabs
echo 4. Test matchmaking and gameplay
echo.
echo Happy coding! 🎮