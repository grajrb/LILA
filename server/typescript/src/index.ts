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

  logger.info('Tic-Tac-Toe match handler registered');
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
    
    dispatcher.broadcastMessage(OPCODES.GAME_OVER, JSON.stringify({
      winner: newState.winner,
      winningSymbol: winner === 'tie' ? null : playerSymbol,
      board: newState.board
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

// Register the module
InitModule;