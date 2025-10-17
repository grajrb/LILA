# Sevalla Individual Services Deployment

## 🎯 Alternative Deployment Method for Sevalla

Since Docker Compose isn't available, we'll deploy services individually.

## 📋 Step 1: Create Database Service

1. **In Sevalla Dashboard**, click "Create New Application"
2. **Choose available options** (likely "Database" or "PostgreSQL/CockroachDB")
3. **Configure Database**:
   - Name: `lila-database`
   - Type: PostgreSQL or CockroachDB
   - Plan: Free tier for testing
4. **Note the connection details** provided

## 📋 Step 2: Create Nakama Game Server

1. **Create another application**
2. **Look for these options**:
   - "Game Server"
   - "Nakama"
   - "Custom Container"
   - "Node.js Application"

### If "Nakama" template is available:
- Choose Nakama template
- Upload your match handler files from `server/typescript/dist/`
- Configure environment variables

### If only "Custom Container" is available:
- Use Docker image: `registry.heroiclabs.com/heroiclabs/nakama:3.20.0`
- Upload match handler files
- Configure startup command

### If only "Node.js" is available:
- We'll need to create a wrapper Node.js application

## 📋 Step 3: Environment Variables for Nakama Service

```bash
NAKAMA_SERVER_KEY=6OOnwb0crwcs2OaPVy6vtofcMUtH7zin
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=YourSecurePassword123!
NAKAMA_DATABASE_ADDRESS=[database-connection-from-step-1]
NAKAMA_LOGGER_LEVEL=INFO
NODE_ENV=production
```

## 📋 Step 4: Upload Match Handler

Upload these files from `server/typescript/dist/`:
- `index.js`
- Any other compiled files

Configure runtime path: `/nakama/data/modules/index.js`