#!/bin/bash
# Build script for TypeScript Nakama match handler

set -e

echo "Building Nakama TypeScript match handler..."

cd "$(dirname "$0")/../server/typescript"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript to JavaScript
echo "Compiling TypeScript..."
npm run build

echo "Build completed! Output in ./build/"
echo "Files ready for Sevalla deployment:"
ls -la build/