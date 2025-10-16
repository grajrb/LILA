@echo off
REM Build script for TypeScript Nakama match handler (Windows)

echo Building Nakama TypeScript match handler...

cd /d "%~dp0..\server\typescript"

REM Install dependencies
echo Installing dependencies...
call npm install

REM Build TypeScript to JavaScript  
echo Compiling TypeScript...
call npm run build

echo Build completed! Output in ./build/
echo Files ready for Sevalla deployment:
dir build\