# Deployment Scripts for LILA Tic-Tac-Toe

This directory contains deployment scripts and configurations for both frontend (Vercel) and backend (Sevalla).

## Quick Deployment Guide

### 1. Deploy Backend to Sevalla

1. Go to [sevalla.com](https://sevalla.com) and create a new Nakama service
2. Upload the compiled TypeScript files from `server/typescript/build/` 
3. Configure the Nakama service with the custom match handler
4. Note the Host/IP address and connection details

### 2. Deploy Frontend to Vercel  

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_NAKAMA_HOST`: Your Sevalla Nakama host
   - `NEXT_PUBLIC_NAKAMA_PORT`: 7350
   - `NEXT_PUBLIC_NAKAMA_SERVER_KEY`: defaultkey
   - `NEXT_PUBLIC_NAKAMA_USE_SSL`: true
4. Deploy!

## Build Commands

- Frontend build: `cd client && npm run build`
- Backend build: `cd server/typescript && npm run build`
- Local development: `cd server && docker-compose up` + `cd client && npm run dev`