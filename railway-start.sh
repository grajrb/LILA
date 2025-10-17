#!/bin/bash

echo "🚂 Starting Nakama on Railway..."

# Print environment info for debugging
echo "Environment variables:"
echo "DATABASE_URL: ${DATABASE_URL:0:50}..."
echo "PORT: ${PORT:-not set}"
echo "NAKAMA_SERVER_KEY: ${NAKAMA_SERVER_KEY:-not set}"

# Use hardcoded database URL if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️ DATABASE_URL not set, using hardcoded connection"
    export DATABASE_URL="postgresql://postgres:IKFaIuUBkxCJMftuLCWJWnGfMEOUEidi@shinkansen.proxy.rlwy.net:57860/railway"
fi

# Set default port if not provided
if [ -z "$PORT" ]; then
    echo "⚠️ PORT not set, using default 7350"
    export PORT=7350
fi

echo "✅ Using Database URL: ${DATABASE_URL:0:50}..."
echo "✅ Using Port: $PORT"

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 10

# Run database migrations
echo "🗄️ Running database migrations..."
/nakama/nakama migrate up --database.address "$DATABASE_URL"

migration_result=$?
if [ $migration_result -ne 0 ]; then
    echo "❌ Database migration failed with code $migration_result"
    echo "Continuing anyway..."
fi

echo "✅ Database setup completed"

# Start Nakama server
echo "🎮 Starting Nakama server..."
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DATABASE_URL" \
  --logger.level INFO \
  --runtime.path /nakama/data/modules \
  --runtime.js_entrypoint index.js \
  --socket.server_key "${NAKAMA_SERVER_KEY:-defaultkey}" \
  --console.username "${NAKAMA_CONSOLE_USERNAME:-admin}" \
  --console.password "${NAKAMA_CONSOLE_PASSWORD:-password}"