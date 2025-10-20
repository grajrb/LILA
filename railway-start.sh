#!/bin/bash

echo "🚂 Starting Nakama on Railway..."

# Print environment info for debugging
echo "Environment variables:"
echo "DATABASE_URL: ${DATABASE_URL:0:50}..."
echo "PORT: ${PORT:-not set}"
echo "NAKAMA_SERVER_KEY: ${NAKAMA_SERVER_KEY:-not set}"

# Check if DATABASE_URL is set (should be provided by Railway)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set!"
    echo "Please configure DATABASE_URL in your Railway environment variables."
    exit 1
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
echo "🔑 Using server key: ${NAKAMA_SERVER_KEY:0:16}..."
echo "🔧 Full startup command preview:"
echo "   --server.key='${NAKAMA_SERVER_KEY:-defaultkey}'"
echo "🔍 Environment variable check: NAKAMA_SERVER_KEY is ${#NAKAMA_SERVER_KEY} characters long"

# Additional diagnostics for server key issues
EXPECTED_LENGTH=64
if [ -z "$NAKAMA_SERVER_KEY" ]; then
    echo "⚠️ WARNING: NAKAMA_SERVER_KEY is empty. Nakama will fall back to 'defaultkey' (INSECURE)."
elif [ ${#NAKAMA_SERVER_KEY} -ne $EXPECTED_LENGTH ]; then
    echo "⚠️ WARNING: NAKAMA_SERVER_KEY length is ${#NAKAMA_SERVER_KEY}, expected $EXPECTED_LENGTH. Double-check for copy/paste errors."
else
    echo "✅ NAKAMA_SERVER_KEY length looks correct ($EXPECTED_LENGTH)."
fi

FIRST_FOUR=${NAKAMA_SERVER_KEY:0:4}
LAST_FOUR=${NAKAMA_SERVER_KEY: -4}
echo "🔐 Masked server key for verification: ${FIRST_FOUR}********${LAST_FOUR}"

# Hex and base64 diagnostics to detect hidden characters (spaces/newlines)
if command -v od >/dev/null 2>&1; then
    echo "🔎 Server key hex bytes: $(echo -n "$NAKAMA_SERVER_KEY" | od -An -tx1 | tr -s ' ' | tr '\n' ' ')"
fi
echo "🔎 Server key base64: $(echo -n "$NAKAMA_SERVER_KEY" | base64 2>/dev/null || echo 'base64 unavailable')"
echo -n "$NAKAMA_SERVER_KEY" | wc -c | xargs echo "🔎 Byte length (wc -c):" || true

echo -n "$NAKAMA_SERVER_KEY" | grep -q '\s' && echo "⚠️ Detected whitespace characters in server key!" || echo "✅ No whitespace detected in server key."

if [ "${NAKAMA_SERVER_KEY}" = "defaultkey" ]; then
    echo "🚨 CRITICAL: NAKAMA_SERVER_KEY is set literally to 'defaultkey'. This indicates the env var did not inject. Verify Railway variable name EXACTLY matches 'NAKAMA_SERVER_KEY'."
fi

echo "🛠 Effective server key passed to Nakama: ${NAKAMA_SERVER_KEY:-defaultkey}"
exec /nakama/nakama \
    --name nakama1 \
    --database.address "$DATABASE_URL" \
    --logger.level DEBUG \
    --runtime.path /nakama/data/modules \
    --runtime.js_entrypoint index.js \
    --runtime.js_read_only_globals false \
    --socket.server_key "${NAKAMA_SERVER_KEY:-defaultkey}" \
    --console.username "${NAKAMA_CONSOLE_USERNAME:-admin}" \
    --console.password "${NAKAMA_CONSOLE_PASSWORD:-password}" \
    --socket.port "$PORT" \
    --socket.address 0.0.0.0 \
    --console.port "$PORT" \
    --console.address 0.0.0.0