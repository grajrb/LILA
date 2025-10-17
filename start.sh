#!/bin/bash

# Railway start script for Nakama server
echo "🚂 Starting Nakama server on Railway..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set!"
    echo "Please add a PostgreSQL database service in Railway dashboard"
    exit 1
fi

echo "✅ Database URL found: ${DATABASE_URL:0:20}..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 15

# Test database connection
echo "🔍 Testing database connection..."
until pg_isready -d "$DATABASE_URL" 2>/dev/null; do
    echo "⏳ Database not ready, waiting 5 seconds..."
    sleep 5
done

echo "✅ Database is ready!"

# Run database migrations
echo "🗄️ Running database migrations..."
/nakama/nakama migrate up --database.address "$DATABASE_URL"

if [ $? -ne 0 ]; then
    echo "❌ Database migration failed!"
    exit 1
fi

echo "✅ Database migrations completed"

# Start Nakama server
echo "🎮 Starting Nakama game server..."
exec /nakama/nakama \
  --name nakama1 \
  --database.address "$DATABASE_URL" \
  --logger.level INFO \
  --runtime.path /nakama/data/modules \
  --runtime.js_entrypoint index.js