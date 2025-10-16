# Sevalla Nakama Deployment Configuration

## Pre-deployment Steps

1. Build the TypeScript match handler:
   ```bash
   # Windows
   deployment/build-server.bat
   
   # Linux/Mac  
   deployment/build-server.sh
   ```

2. The built files will be in `server/typescript/build/`

## Sevalla Configuration

### Service Settings
- **Service Type**: Nakama
- **Region**: Choose closest to your users
- **Plan**: Based on expected concurrent users

### Runtime Configuration
- **JavaScript Runtime**: Enabled
- **Entry Point**: `/nakama/data/modules/index.js`
- **Server Key**: `defaultkey` (or generate new for production)

### File Upload
Upload the entire contents of `server/typescript/build/` to the Nakama modules directory.

### Environment Variables
Set in Sevalla dashboard if needed:
- `NAKAMA_DATABASE_ADDRESS`: (auto-configured)
- `NAKAMA_LOGGER_LEVEL`: `INFO` or `DEBUG`

## Connection Details

After deployment, you'll receive:
- **Host**: `your-service.sevalla.com`
- **Ports**: 
  - 7349 (gRPC)
  - 7350 (HTTP)
  - 7351 (Console)

Use these values in your Vercel environment variables.

## Testing

1. Test the console: `https://your-service.sevalla.com:7351`
2. Login with: `admin` / `password` (or your configured credentials)
3. Verify the match handler is loaded in the Runtime Modules section