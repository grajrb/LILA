#!/bin/bash

echo "🚂 Starting Nakama on Railway (Simple Config)..."

# Use Railway's PORT or default to 7350
export NAKAMA_PORT=${PORT:-7350}

echo "Using port: $NAKAMA_PORT"
echo "Database: ${DATABASE_URL:0:50}..."

# Wait for database
sleep 5

# Run migrations
/nakama/nakama migrate up --database.address "$DATABASE_URL" || echo "Migration failed, continuing..."

# Start Nakama with all services on the same port
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DATABASE_URL" \
  --logger.level INFO \
  --runtime.path /nakama/data/modules \
  --runtime.js_entrypoint index.js \
  --socket.server_key "${NAKAMA_SERVER_KEY:-defaultkey}" \
  --console.username "${NAKAMA_CONSOLE_USERNAME:-admin}" \
  --console.password "${NAKAMA_CONSOLE_PASSWORD:-password}" \
  --socket.port "$NAKAMA_PORT" \
  --console.port "$NAKAMA_PORT" \
  --session.token_expiry_sec 7200