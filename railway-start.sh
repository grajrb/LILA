#!/bin/bash

echo "🚂 Starting Nakama on Railway..."

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set"
    exit 1
fi

if [ -z "$PORT" ]; then
    echo "⚠️ PORT not set, using default 7350"
    export PORT=7350
fi

echo "✅ Database URL: ${DATABASE_URL:0:30}..."
echo "✅ Port: $PORT"

# Wait a moment for database to be ready
sleep 5

# Run database migrations
echo "🗄️ Running database migrations..."
/nakama/nakama migrate up --database.address "$DATABASE_URL"

if [ $? -ne 0 ]; then
    echo "❌ Database migration failed"
    exit 1
fi

echo "✅ Database migrations completed"

# Start Nakama server
echo "🎮 Starting Nakama server on port $PORT..."
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DATABASE_URL" \
  --logger.level INFO \
  --runtime.path /nakama/data/modules \
  --runtime.js_entrypoint index.js \
  --socket.server_key "${NAKAMA_SERVER_KEY:-defaultkey}" \
  --console.username "${NAKAMA_CONSOLE_USERNAME:-admin}" \
  --console.password "${NAKAMA_CONSOLE_PASSWORD:-password}" \
  --socket.port "$PORT" \
  --console.port "$((PORT + 1))"