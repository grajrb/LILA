# Dockerfile for building TypeScript Nakama match handler
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# The build output will be in /app/build directory
# This will be mounted as a volume to the Nakama container