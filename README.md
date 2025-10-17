# LILA Tic-Tac-Toe

A modern, multiplayer Tic-Tac-Toe game built with Next.js and Nakama, featuring real-time matchmaking and server-authoritative gameplay.

## 🎮 Features

- **Real-time Multiplayer** - Server-authoritative game logic with Nakama
- **Matchmaking System** - Automatic player matching and queue management  
- **Leaderboard** - Player rankings, stats, and achievements
- **Responsive Design** - Works on desktop and mobile devices
- **Cloud Ready** - Configured for production deployment

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/grajrb/LILA.git
   cd LILA
   ```

2. **Start Nakama server**
   ```bash
   docker-compose -f docker-compose.local.yml up -d
   ```

3. **Start the frontend**
   ```bash
   cd client
   npm install
   npm run dev
   ```

4. **Open the game**
   - Game: http://localhost:3000
   - Nakama Console: http://localhost:7352 (admin/password)

### Environment Variables

Create `client/.env.local`:
```bash
NEXT_PUBLIC_NAKAMA_HOST=127.0.0.1
NEXT_PUBLIC_NAKAMA_PORT=7350
NEXT_PUBLIC_NAKAMA_SERVER_KEY=defaultkey
NEXT_PUBLIC_NAKAMA_USE_SSL=false
```

## 🏗️ Architecture

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Nakama server with TypeScript match handler
- **Database**: CockroachDB for persistence
- **Real-time**: WebSocket connections for live gameplay

## 🎯 How to Play

1. **Create Account** - Enter username to join
2. **Find Match** - Click "Find Game" to join matchmaking
3. **Play Game** - Take turns placing X or O
4. **View Stats** - Check leaderboard for rankings

## 🚀 Deployment

### Railway (Backend)
1. Connect your GitHub repository
2. Deploy the Nakama server
3. Add PostgreSQL database
4. Set environment variables

### Vercel (Frontend)
1. Connect your GitHub repository  
2. Deploy from `client` folder
3. Set environment variables pointing to your backend

## 📖 Game Rules

- Standard Tic-Tac-Toe rules
- First player to get 3 in a row wins
- Real-time turn-based gameplay
- Automatic win/draw detection
- Stats tracking for all players

## 🛠️ Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run type-check` - Run TypeScript checks
- `docker-compose -f docker-compose.local.yml up` - Start local Nakama

## 📝 License

This project is open source and available under the MIT License.
- Check server logs for match handler errors
- Verify TypeScript compilation succeeded

**"Game state not syncing"**
- Check WebSocket connection in browser dev tools
- Verify match handler is loaded in Nakama console
- Look for JavaScript errors in server logs

## 📚 **API Reference**

### **Client Events**
- `GAME_STATE` (opcode 1): Receive updated game state
- `MOVE` (opcode 2): Send player move
- `GAME_OVER` (opcode 3): Game completion notification
- `ERROR` (opcode 4): Error messages

### **RPC Functions**
- `get_leaderboard`: Fetch global rankings
- `get_player_stats`: Get individual player statistics
- `update_player_stats`: Update stats after game

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test locally
4. Commit: `git commit -m "Add feature"`
5. Push: `git push origin feature-name`
6. Create Pull Request

## 📄 **License**

This project is created for the LILA Engineering assignment.

## 👨‍💻 **Author**

Created as part of the LILA Engineering technical assessment.

---

**Ready to play? Deploy the game and challenge your friends to a match!** 🎮
" 
