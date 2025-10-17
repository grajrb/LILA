#!/bin/bash

# LILA Complete Deployment Script for Sevalla
# This script prepares and deploys both frontend and backend

set -e

echo "🚀 Starting LILA deployment preparation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Build backend (TypeScript match handler)
echo -e "${YELLOW}🔨 Building backend match handler...${NC}"
cd server/typescript

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Backend package.json not found!${NC}"
    exit 1
fi

npm install
npm run build

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ Backend build failed - index.js not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend build complete${NC}"

# Return to root directory
cd ../..

# Install frontend dependencies
echo -e "${YELLOW}🔨 Installing frontend dependencies...${NC}"
cd client

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Frontend package.json not found!${NC}"
    exit 1
fi

npm install

# Build frontend for production
echo -e "${YELLOW}🔨 Building frontend for production...${NC}"
npm run build

if [ ! -d ".next" ]; then
    echo -e "${RED}❌ Frontend build failed - .next directory not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend build complete${NC}"

# Return to root directory
cd ..

# Create environment file template
echo -e "${YELLOW}📝 Creating environment template...${NC}"
cat > .env.sevalla.template << EOF
# Sevalla Production Environment Variables
# Copy this to .env.sevalla and update with your values

NAKAMA_HOST=your-app.sevalla.com
NAKAMA_SERVER_KEY=generate-secure-32-char-key
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=your-secure-password
NODE_ENV=production
DATABASE_URL=postgresql://user:password@db.sevalla.com:5432/nakama
EOF

# Check if .env.sevalla exists
if [ ! -f ".env.sevalla" ]; then
    echo -e "${YELLOW}⚠️  .env.sevalla not found. Creating from template...${NC}"
    cp .env.sevalla.template .env.sevalla
    echo -e "${YELLOW}📝 Please edit .env.sevalla with your production values before deploying!${NC}"
fi

# Validate deployment files
echo -e "${YELLOW}🔍 Validating deployment files...${NC}"

required_files=(
    "docker-compose.sevalla.yml"
    "client/Dockerfile.prod"
    "server/typescript/dist/index.js"
    ".env.sevalla"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Required file missing: $file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required files present${NC}"

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
deployment_dir="lila-deployment-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$deployment_dir"

# Copy necessary files
cp docker-compose.sevalla.yml "$deployment_dir/"
cp .env.sevalla "$deployment_dir/"
cp -r client "$deployment_dir/"
mkdir -p "$deployment_dir/server/typescript"
cp -r server/typescript/dist "$deployment_dir/server/typescript/"

# Create deployment README
cat > "$deployment_dir/README.md" << EOF
# LILA Deployment Package

Generated on: $(date)

## Files Included:
- docker-compose.sevalla.yml: Main deployment configuration
- .env.sevalla: Environment variables (edit before deploying)
- client/: Frontend application with production Dockerfile
- server/typescript/dist/: Built backend match handler

## Deployment Instructions:

### Method 1: Sevalla CLI
\`\`\`bash
sevalla login
sevalla deploy --compose docker-compose.sevalla.yml
\`\`\`

### Method 2: Sevalla Dashboard
1. Login to dashboard.sevalla.com
2. Create New Application -> Docker Compose
3. Upload docker-compose.sevalla.yml
4. Set environment variables from .env.sevalla
5. Deploy

## Required Environment Variables:
- NAKAMA_HOST: Your Sevalla app domain
- NAKAMA_SERVER_KEY: Secure server key (32+ characters)
- NAKAMA_CONSOLE_USERNAME: Admin username
- NAKAMA_CONSOLE_PASSWORD: Secure admin password
- DATABASE_URL: Database connection string

## Post-deployment URLs:
- Game: https://your-app.sevalla.com
- Console: https://your-app.sevalla.com:7351
- API: https://your-app.sevalla.com:7350
EOF

echo -e "${GREEN}✅ Deployment package created: $deployment_dir${NC}"

# Display summary
echo -e "\n${GREEN}🎉 LILA deployment preparation complete!${NC}"
echo -e "\n${YELLOW}📋 Summary:${NC}"
echo -e "   • Backend build: ✅ Complete"
echo -e "   • Frontend build: ✅ Complete"
echo -e "   • Deployment package: ✅ $deployment_dir"
echo -e "\n${YELLOW}📝 Next Steps:${NC}"
echo -e "   1. Edit ${deployment_dir}/.env.sevalla with your production values"
echo -e "   2. Deploy using Sevalla CLI or Dashboard"
echo -e "   3. Configure custom domain (optional)"
echo -e "   4. Test the deployment"
echo -e "\n${YELLOW}📚 Documentation:${NC}"
echo -e "   • Full guide: deployment/sevalla-complete-deployment.md"
echo -e "   • Package README: ${deployment_dir}/README.md"
echo -e "\n${GREEN}Ready to deploy! 🚀${NC}"