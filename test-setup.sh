#!/bin/bash
# Test script to verify local development setup

echo "🧪 LILA Tic-Tac-Toe Development Test"
echo "===================================="

# Check if required tools are installed
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm: $(npm --version)"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker: $(docker --version)"

echo ""
echo "🏗️ Building server components..."

# Build TypeScript match handler
cd "$(dirname "$0")/server/typescript"
if [ ! -f package.json ]; then
    echo "❌ Server package.json not found"
    exit 1
fi

npm install --silent
npm run build

if [ ! -f build/index.js ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi
echo "✅ Server build successful"

cd ../..

echo ""
echo "🎯 Installing client dependencies..."

cd client
npm install --silent

if [ $? -ne 0 ]; then
    echo "❌ Client dependency installation failed"
    exit 1
fi
echo "✅ Client dependencies installed"

echo ""
echo "🚀 Verification complete!"
echo ""
echo "To start development:"
echo "1. Terminal 1: cd server && docker-compose up"  
echo "2. Terminal 2: cd client && npm run dev"
echo "3. Open http://localhost:3000 in two browser tabs"
echo "4. Test matchmaking and gameplay"
echo ""
echo "Happy coding! 🎮"