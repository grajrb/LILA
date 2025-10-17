#!/bin/bash

# Railway start script for Nakama server
echo "🚂 Starting Nakama server on Railway..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 5

# Run database migrations
echo "🗄️ Running database migrations..."
/nakama/nakama migrate up --database.address "$DATABASE_URL"

# Start Nakama server
echo "🎮 Starting Nakama game server..."
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DATABASE_URL" \
  --logger.level INFO \
  --runtime.path /nakama/data/modules \
  --runtime.js_entrypoint index.js