// Server-authoritative Tic-Tac-Toe match handler for Nakama
// Implements game state management, turn validation, and win conditions

interface GameState {
  board: (string | null)[];
  currentPlayer: string; // userId of current player
  players: { [userId: string]: { symbol: 'X' | 'O'; username: string } };
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null; // userId of winner, 'tie' for draw, null for ongoing
  moveCount: number;
}

interface MoveData {
  position: number;
}

const OPCODES = {
  GAME_STATE: 1,
  MOVE: 2,
  GAME_OVER: 3,
  ERROR: 4
};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns  
  [0, 4, 8], [2, 4, 6]             // diagonals
];

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
  initializer.registerMatch('tictactoe', {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchSignal,
    matchTerminate
  });

  // Register RPC functions for leaderboard and stats
  initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);
  initializer.registerRpc('get_player_stats', rpcGetPlayerStats);
  initializer.registerRpc('update_player_stats', rpcUpdatePlayerStats);

  logger.info('Tic-Tac-Toe match handler and RPC functions registered');
}

function matchInit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: string}): {state: nkruntime.MatchState, tickRate: number, label: string} {
  const gameState: GameState = {
    board: Array(9).fill(null),
    currentPlayer: '',
    players: {},
    gameStatus: 'waiting',
    winner: null,
    moveCount: 0
  };

  return {
    state: gameState,
    tickRate: 1, // 1 tick per second
    label: 'Tic-Tac-Toe Match'
  };
}

function matchJoinAttempt(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}): {state: nkruntime.MatchState, accept: boolean, rejectMessage?: string} {
  const gameState = state as GameState;
  
  // Only allow 2 players max
  if (Object.keys(gameState.players).length >= 2) {
    return {
      state: gameState,
      accept: false,
      rejectMessage: 'Match is full'
    };
  }

  return {
    state: gameState,
    accept: true
  };
}

function matchJoin(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]): {state: nkruntime.MatchState} {
  let gameState = { ...state } as GameState;
  
  for (const presence of presences) {
    // Assign symbol based on join order
    const playerCount = Object.keys(gameState.players).length;
    const symbol = playerCount === 0 ? 'X' : 'O';
    
    gameState.players[presence.userId] = {
      symbol: symbol,
      username: presence.username
    };

    logger.info(`Player ${presence.username} joined as ${symbol}`);

    // If we have 2 players, start the game
    if (Object.keys(gameState.players).length === 2) {
      gameState.gameStatus = 'playing';
      // X always goes first
      gameState.currentPlayer = Object.keys(gameState.players).find(
        userId => gameState.players[userId].symbol === 'X'
      ) || '';
      
      logger.info(`Game started! Current player: ${gameState.currentPlayer}`);
    }
  }

  // Broadcast updated game state to all players
  const stateMessage = {
    board: gameState.board,
    currentPlayer: gameState.currentPlayer,
    players: gameState.players,
    gameStatus: gameState.gameStatus,
    winner: gameState.winner,
    moveCount: gameState.moveCount
  };

  dispatcher.broadcastMessage(OPCODES.GAME_STATE, JSON.stringify(stateMessage));

  return { state: gameState };
}

function matchLeave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]): {state: nkruntime.MatchState} {
  let gameState = { ...state } as GameState;
  
  for (const presence of presences) {
    delete gameState.players[presence.userId];
    logger.info(`Player ${presence.username} left the match`);
  }

  // If a player leaves during an active game, end it
  if (gameState.gameStatus === 'playing' && Object.keys(gameState.players).length < 2) {
    gameState.gameStatus = 'finished';
    // Declare remaining player as winner, or end game if no players left
    const remainingPlayers = Object.keys(gameState.players);
    gameState.winner = remainingPlayers.length > 0 ? remainingPlayers[0] : null;
    
    dispatcher.broadcastMessage(OPCODES.GAME_OVER, JSON.stringify({
      reason: 'Player disconnected',
      winner: gameState.winner
    }));
  }

  return { state: gameState };
}

function matchLoop(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]): {state: nkruntime.MatchState} {
  let gameState = { ...state } as GameState;

  for (const message of messages) {
    switch (message.opCode) {
      case OPCODES.MOVE:
        gameState = handleMove(gameState, message, dispatcher, logger);
        break;
      default:
        logger.warn(`Unexpected message opCode: ${message.opCode}`);
    }
  }

  return { state: gameState };
}

function handleMove(gameState: GameState, message: nkruntime.MatchMessage, dispatcher: nkruntime.MatchDispatcher, logger: nkruntime.Logger): GameState {
  const newState = { ...gameState };
  
  // Validate game is in playing state
  if (newState.gameStatus !== 'playing') {
    dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
      error: 'Game is not in playing state'
    }));
    return newState;
  }

  // Validate it's the player's turn
  if (message.sender.userId !== newState.currentPlayer) {
    dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
      error: 'Not your turn'
    }));
    return newState;
  }

  let moveData: MoveData;
  try {
    moveData = JSON.parse(nkruntime.binaryToString(message.data));
  } catch (error) {
    logger.error('Failed to parse move data:', error);
    return newState;
  }

  // Validate move position
  if (moveData.position < 0 || moveData.position > 8) {
    dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
      error: 'Invalid move position'
    }));
    return newState;
  }

  // Validate position is empty
  if (newState.board[moveData.position] !== null) {
    dispatcher.broadcastMessage(OPCODES.ERROR, JSON.stringify({
      error: 'Position already occupied'
    }));
    return newState;
  }

  // Make the move
  const playerSymbol = newState.players[message.sender.userId].symbol;
  newState.board[moveData.position] = playerSymbol;
  newState.moveCount++;

  logger.info(`Player ${message.sender.userId} (${playerSymbol}) moved to position ${moveData.position}`);

  // Check for win condition
  const winner = checkWinner(newState.board);
  if (winner) {
    newState.gameStatus = 'finished';
    newState.winner = winner === 'tie' ? 'tie' : message.sender.userId;
    
    // Update player stats (in a real implementation, this would be done via RPC calls)
    logger.info(`Game finished. Winner: ${newState.winner}, Players: ${Object.keys(newState.players).join(', ')}`);
    
    dispatcher.broadcastMessage(OPCODES.GAME_OVER, JSON.stringify({
      winner: newState.winner,
      winningSymbol: winner === 'tie' ? null : playerSymbol,
      board: newState.board,
      gameStats: {
        totalMoves: newState.moveCount,
        players: Object.keys(newState.players).map(id => ({
          userId: id,
          symbol: newState.players[id].symbol,
          result: winner === 'tie' ? 'draw' : (id === newState.winner ? 'win' : 'loss')
        }))
      }
    }));
  } else {
    // Switch turns
    const playerIds = Object.keys(newState.players);
    newState.currentPlayer = playerIds.find(id => id !== newState.currentPlayer) || '';
  }

  // Broadcast updated game state
  const stateMessage = {
    board: newState.board,
    currentPlayer: newState.currentPlayer,
    players: newState.players,
    gameStatus: newState.gameStatus,
    winner: newState.winner,
    moveCount: newState.moveCount,
    lastMove: {
      position: moveData.position,
      symbol: playerSymbol,
      player: message.sender.userId
    }
  };

  dispatcher.broadcastMessage(OPCODES.GAME_STATE, JSON.stringify(stateMessage));

  return newState;
}

function checkWinner(board: (string | null)[]): string | null {
  // Check for winning combinations
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // Return winning symbol
    }
  }
  
  // Check for tie (board full, no winner)
  if (board.every(cell => cell !== null)) {
    return 'tie';
  }
  
  // Game continues
  return null;
}

function matchSignal(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, data: string): {state: nkruntime.MatchState, data?: string} {
  return { state };
}

function matchTerminate(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, graceSeconds: number): {state: nkruntime.MatchState} {
  return { state };
}

// RPC Functions for Leaderboard and Player Stats

function rpcGetLeaderboard(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  try {
    // In a real implementation, you would query the database
    // For this demo, return mock leaderboard data
    const leaderboard = [
      { userId: "user1", username: "Player1", wins: 15, losses: 3, draws: 2, rating: 1250 },
      { userId: "user2", username: "Player2", wins: 12, losses: 5, draws: 3, rating: 1180 },
      { userId: "user3", username: "Player3", wins: 8, losses: 7, draws: 5, rating: 1050 },
      { userId: "user4", username: "Player4", wins: 5, losses: 10, draws: 2, rating: 920 },
      { userId: "user5", username: "Player5", wins: 3, losses: 12, draws: 1, rating: 850 }
    ];

    return JSON.stringify({ leaderboard });
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    return JSON.stringify({ error: 'Failed to get leaderboard' });
  }
}

function rpcGetPlayerStats(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  try {
    const request = JSON.parse(payload);
    const userId = request.userId;

    // In a real implementation, query the database for user stats
    // For this demo, return mock data
    const stats = {
      userId: userId,
      username: `Player_${userId.substring(0, 8)}`,
      totalGames: 25,
      wins: 12,
      losses: 8,
      draws: 5,
      winRate: 0.48,
      rating: 1150,
      rank: 42,
      achievements: [
        { id: 'first_win', name: 'First Victory', description: 'Win your first game' },
        { id: 'streak_3', name: 'Hat Trick', description: 'Win 3 games in a row' }
      ]
    };

    return JSON.stringify(stats);
  } catch (error) {
    logger.error('Error getting player stats:', error);
    return JSON.stringify({ error: 'Failed to get player stats' });
  }
}

function rpcUpdatePlayerStats(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  try {
    const request = JSON.parse(payload);
    const { userId, result } = request; // result: 'win', 'loss', 'draw'

    logger.info(`Updating stats for user ${userId}: ${result}`);

    // In a real implementation:
    // 1. Update user stats in database
    // 2. Recalculate rating using ELO or similar system
    // 3. Update leaderboard rankings
    // 4. Check for new achievements

    const updatedStats = {
      userId: userId,
      result: result,
      newRating: 1150 + (result === 'win' ? 25 : result === 'loss' ? -20 : 0),
      message: `Stats updated: ${result}`
    };

    return JSON.stringify(updatedStats);
  } catch (error) {
    logger.error('Error updating player stats:', error);
    return JSON.stringify({ error: 'Failed to update player stats' });
  }
}

// Register the module
InitModule;