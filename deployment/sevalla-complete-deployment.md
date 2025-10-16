# Complete LILA Deployment on Sevalla

This guide will help you deploy the entire LILA Tic-Tac-Toe application (frontend + backend) on Sevalla.

## 📋 Prerequisites

1. **Sevalla Account**: Sign up at [sevalla.com](https://sevalla.com)
2. **Docker**: Ensure Docker is installed locally for building
3. **Git**: For version control and deployment

## 🚀 Deployment Methods

### Method 1: Docker Compose Deployment (Recommended)

#### 1. Prepare the Application

```bash
# Build the TypeScript match handler
cd server/typescript
npm run build

# Verify build output exists
ls dist/  # Should contain index.js and other files
```

#### 2. Environment Configuration

Create `.env.sevalla` file in the root directory:

```bash
# Sevalla Production Environment Variables
NAKAMA_HOST=your-app.sevalla.com
NAKAMA_SERVER_KEY=your-production-server-key
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=your-secure-password
NODE_ENV=production
```

#### 3. Deploy to Sevalla

**Option A: Using Sevalla CLI**
```bash
# Install Sevalla CLI
npm install -g @sevalla/cli

# Login to Sevalla
sevalla login

# Deploy the application
sevalla deploy --compose docker-compose.sevalla.yml
```

**Option B: Using Sevalla Dashboard**
1. Login to [Sevalla Dashboard](https://dashboard.sevalla.com)
2. Create New Application → Docker Compose
3. Upload `docker-compose.sevalla.yml`
4. Set environment variables
5. Deploy

### Method 2: Separate Service Deployment

#### Frontend Deployment (Next.js)

1. **Create Next.js Service on Sevalla**
   - Service Type: Node.js
   - Runtime: Node.js 18+
   - Build Command: `npm run build`
   - Start Command: `npm start`

2. **Environment Variables**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_NAKAMA_HOST=your-nakama-service.sevalla.com
   NEXT_PUBLIC_NAKAMA_PORT=7350
   NEXT_PUBLIC_NAKAMA_SERVER_KEY=your-server-key
   NEXT_PUBLIC_NAKAMA_USE_SSL=true
   ```

#### Backend Deployment (Nakama)

1. **Create Nakama Service on Sevalla**
   - Service Type: Nakama Game Server
   - Runtime: JavaScript
   - Entry Point: `index.js`

2. **Upload Match Handler**
   - Upload files from `server/typescript/dist/`
   - Ensure `index.js` is in the root modules directory

3. **Configure Database**
   - Add CockroachDB or PostgreSQL addon
   - Set database connection string

## 🔧 Configuration Files

### docker-compose.sevalla.yml
```yaml
version: '3.8'
services:
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_NAKAMA_HOST=${NAKAMA_HOST}
      - NEXT_PUBLIC_NAKAMA_PORT=7350
      - NEXT_PUBLIC_NAKAMA_SERVER_KEY=${NAKAMA_SERVER_KEY}
      - NEXT_PUBLIC_NAKAMA_USE_SSL=true
    depends_on:
      - nakama

  nakama:
    image: registry.heroiclabs.com/heroiclabs/nakama:3.20.0
    ports:
      - "7349:7349"
      - "7350:7350" 
      - "7351:7351"
    volumes:
      - ./server/typescript/dist:/nakama/data/modules:ro
    environment:
      - NAKAMA_DATABASE_ADDRESS=${DATABASE_URL}
      - NAKAMA_SERVER_KEY=${NAKAMA_SERVER_KEY}
```

## 🌐 Domain Configuration

### Custom Domain Setup

1. **Add Domain in Sevalla Dashboard**
   - Go to your app settings
   - Add custom domain: `your-game.com`
   - Configure DNS records as instructed

2. **SSL Certificate**
   - Sevalla automatically provisions SSL certificates
   - Ensure `NEXT_PUBLIC_NAKAMA_USE_SSL=true`

### Subdomain Strategy
- Frontend: `https://your-game.com`
- Backend API: `https://api.your-game.com` 
- Admin Console: `https://admin.your-game.com`

## 🔒 Security Configuration

### Production Security Settings

1. **Environment Variables**
   ```bash
   NAKAMA_SERVER_KEY=<generate-secure-32-char-key>
   NAKAMA_CONSOLE_PASSWORD=<strong-admin-password>
   DATABASE_URL=<secure-database-connection>
   ```

2. **Firewall Rules**
   - Allow ports: 3000 (frontend), 7350 (API), 7351 (console)
   - Restrict console access to admin IPs only

3. **Rate Limiting**
   - Configure in Sevalla dashboard
   - Set limits for API endpoints and matchmaking

## 📊 Monitoring & Scaling

### Health Checks
- Frontend: `GET /api/health`
- Backend: `GET :7350/healthcheck`
- Console: `GET :7351/health`

### Auto-scaling Configuration
```yaml
scaling:
  frontend:
    min_instances: 1
    max_instances: 5
    cpu_threshold: 70%
  
  nakama:
    min_instances: 1
    max_instances: 3
    memory_threshold: 80%
```

### Monitoring Endpoints
- Application metrics: Available in Sevalla dashboard
- Game metrics: Nakama console at `https://admin.your-game.com`
- Frontend performance: Next.js analytics

## 🚦 Deployment Checklist

### Pre-deployment
- [ ] Build TypeScript match handler (`npm run build`)
- [ ] Test locally with production environment
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy
- [ ] Review security settings

### Deployment
- [ ] Deploy database service first
- [ ] Deploy Nakama backend
- [ ] Deploy Next.js frontend
- [ ] Verify all services are running
- [ ] Test matchmaking functionality

### Post-deployment
- [ ] Configure custom domain
- [ ] Set up SSL certificates
- [ ] Test from multiple locations
- [ ] Monitor performance metrics
- [ ] Document connection endpoints

## 🎯 Final URLs

After successful deployment:

- **Game Application**: `https://your-app.sevalla.com`
- **Admin Console**: `https://your-app.sevalla.com:7351`
- **API Endpoint**: `https://your-app.sevalla.com:7350`

## 🆘 Troubleshooting

### Common Issues

1. **Connection Errors**
   - Verify environment variables are set correctly
   - Check firewall and port configurations
   - Ensure SSL settings match between frontend/backend

2. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review build logs in Sevalla dashboard

3. **Database Issues**
   - Confirm database service is running
   - Check connection string format
   - Verify migration completed successfully

### Support Resources
- Sevalla Documentation: [docs.sevalla.com](https://docs.sevalla.com)
- Nakama Documentation: [heroiclabs.com/docs](https://heroiclabs.com/docs)
- Community Support: GitHub Issues

---

**Ready to deploy!** Follow the steps above to get your LILA Tic-Tac-Toe game running on Sevalla! 🎮