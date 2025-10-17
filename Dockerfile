# Railway Dockerfile for Nakama deployment
FROM registry.heroiclabs.com/heroiclabs/nakama:3.20.0

# Install required tools
RUN apt-get update && apt-get install -y postgresql-client curl && rm -rf /var/lib/apt/lists/*

# Create modules directory
RUN mkdir -p /nakama/data/modules

# Copy built TypeScript match handler
COPY server/typescript/dist/ /nakama/data/modules/

# Copy startup script
COPY railway-start.sh /nakama/railway-start.sh
RUN chmod +x /nakama/railway-start.sh

# Set working directory
WORKDIR /nakama

# Expose port (Railway will set PORT env var)
EXPOSE $PORT

# Health check on dynamic port
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:$PORT/healthcheck || exit 1

# Use startup script
CMD ["./railway-start.sh"]