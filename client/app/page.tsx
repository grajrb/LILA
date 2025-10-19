// client/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Session, Socket, Notification } from "@heroiclabs/nakama-js";
import nakamaClient from "./nakama";
import Leaderboard from "./leaderboard";
import ConnectionStatus from "./components/connection-status";
import DebugPanel from "./components/debug-panel";
import { ErrorClassifier, ErrorClassification, ConnectionError } from "./utils/error-classifier";
import { ConnectionMonitor } from "./utils/connection-monitor";

interface Player {
  symbol: 'X' | 'O';
  username: string;
}

interface GameState {
  board: (string | null)[];
  currentPlayer: string;
  players: { [userId: string]: Player };
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  moveCount: number;
  lastMove?: {
    position: number;
    symbol: string;
    player: string;
  };
}

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    board: Array(9).fill(null),
    currentPlayer: '',
    players: {},
    gameStatus: 'waiting',
    winner: null,
    moveCount: 0
  });
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [connectionError, setConnectionError] = useState<ErrorClassification | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastConnectionTime, setLastConnectionTime] = useState<Date | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMonitor] = useState(() => new ConnectionMonitor());
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);

  // Helper function to handle connection errors with classification
  const handleConnectionError = (error: Error | string, context: 'websocket' | 'authentication' | 'matchmaking' | 'general', url?: string, protocol?: string) => {
    // Mark the current attempt as failed in the monitor
    if (currentAttemptId) {
      const errorObj = typeof error === 'string' ? new Error(error) : error;
      connectionMonitor.markFailure(currentAttemptId, errorObj, { context, url, protocol });
      setCurrentAttemptId(null);
    }

    const connectionError: ConnectionError = {
      originalError: error,
      context,
      timestamp: new Date(),
      url,
      protocol
    };
    
    const classification = ErrorClassifier.classifyError(connectionError);
    setConnectionError(classification);
    setConnectionAttempts(prev => prev + 1);
    
    // Also set the legacy error message for backward compatibility
    setErrorMessage(classification.userMessage);
    
    console.error(`Connection error (${context}):`, {
      classification,
      originalError: error,
      url,
      protocol
    });
  };

  // Helper function to clear errors
  const clearErrors = () => {
    setConnectionError(null);
    setErrorMessage('');
  };

  // Retry connection function
  const retryConnection = async () => {
    clearErrors();
    setIsConnecting(true);
    
    try {
      await authenticate();
    } catch (error) {
      // Error will be handled by authenticate function
    } finally {
      setIsConnecting(false);
    }
  };

  // 1. Authenticate and connect socket on component mount
  const authenticate = async () => {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("deviceId", deviceId);
    }

    try {
      setIsConnecting(true);
      clearErrors();
      
      const newSession = await nakamaClient.authenticateDevice(deviceId, true);
      
      // Log WebSocket connection details for debugging
      console.log(`🔗 WebSocket Connection Details:`);
      console.log(`   - Protocol: ${nakamaClient.getWebSocketProtocol()}`);
      console.log(`   - URL: ${nakamaClient.getWebSocketUrl()}`);
      
      const newSocket = nakamaClient.createSocket();
      const wsUrl = nakamaClient.getWebSocketUrl();
      const wsProtocol = nakamaClient.getWebSocketProtocol();
      
      // Set up connection event handlers before connecting
      newSocket.onnotification = (notification: Notification) => {
        console.log("Socket notification:", notification);
      };

      newSocket.ondisconnect = () => {
        console.log("Socket disconnected");
        setSocketConnected(false);
        setLastConnectionTime(null);
      };

      newSocket.onerror = (error: Event | Error) => {
        console.error("WebSocket error:", error);
        
        const errorObj = error instanceof Error ? error : new Error(error.toString());
        handleConnectionError(errorObj, 'websocket', wsUrl, wsProtocol);
      };

      await newSocket.connect(newSession, true);
      
      // Mark as connected after successful connection
      setSocketConnected(true);
      setLastConnectionTime(new Date());
      clearErrors();
      console.log("✅ WebSocket connected successfully");

      setSession(newSession);
      setSocket(newSocket);
    } catch (error) {
      console.error("Authentication or connection failed:", error);
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const context = errorObj.message.toLowerCase().includes('authenticate') ? 'authentication' : 'websocket';
      
      handleConnectionError(errorObj, context, nakamaClient.getWebSocketUrl(), nakamaClient.getWebSocketProtocol());
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    authenticate();
  }, []);

  // 2. Set up socket event listeners
  useEffect(() => {
    if (socket) {
      socket.onmatchmakermatched = (match) => {
        console.log("Matched!", match);
        setMatchId(match.match_id);
        setIsSearching(false);
        // Join the match with our custom handler
        socket.joinMatch(match.match_id);
      };

      socket.onmatchdata = (matchData) => {
        console.log("Received match data:", matchData);
        setErrorMessage('');
        
        try {
          const dataString = new TextDecoder().decode(matchData.data);
          const data = JSON.parse(dataString);
          
          switch (matchData.op_code) {
            case 1: // GAME_STATE
              setGameState(data);
              break;
            case 3: // GAME_OVER
              console.log("Game Over:", data);
              setGameState(prev => ({
                ...prev,
                gameStatus: 'finished',
                winner: data.winner
              }));
              break;
            case 4: // ERROR
              setErrorMessage(data.error || 'An error occurred');
              break;
          }
        } catch (error) {
          console.error('Failed to parse match data:', error);
        }
      };

      socket.onmatchpresence = (presence) => {
        console.log("Match presence update:", presence);
      };
    }
  }, [socket]);

  // 3. Function to find a match
  const findMatch = async () => {
    if (socket && socketConnected) {
      setIsSearching(true);
      clearErrors();
      try {
        await socket.addMatchmaker("tictactoe", 2, 2);
        console.log("Searching for a match...");
      } catch (error) {
        console.error('Matchmaking failed:', error);
        setIsSearching(false);
        
        const errorObj = error instanceof Error ? error : new Error(String(error));
        handleConnectionError(errorObj, 'matchmaking');
      }
    } else {
      handleConnectionError(new Error('Not connected to server'), 'general');
    }
  };

  // 4. Function to send a move
  const makeMove = (index: number) => {
    if (socket && matchId && gameState.board[index] === null && 
        gameState.gameStatus === 'playing' && 
        session?.user_id && gameState.currentPlayer === session.user_id) {
      
      const moveData = JSON.stringify({ position: index });
      socket.sendMatchState(matchId, 2, moveData);
    }
  };

  // Helper functions
  const getCurrentPlayer = (): Player | null => {
    return gameState.players[gameState.currentPlayer] || null;
  };

  const getMySymbol = (): string => {
    if (!session?.user_id) return '';
    return gameState.players[session.user_id]?.symbol || '';
  };

  const isMyTurn = (): boolean => {
    return Boolean(session?.user_id && session.user_id === gameState.currentPlayer);
  };

  const getGameStatusText = (): string => {
    switch (gameState.gameStatus) {
      case 'waiting':
        return 'Waiting for players...';
      case 'playing':
        const currentPlayer = getCurrentPlayer();
        if (isMyTurn()) {
          return `Your turn (${getMySymbol()})`;
        } else {
          return `${currentPlayer?.username || 'Opponent'}'s turn (${currentPlayer?.symbol || ''})`;
        }
      case 'finished':
        if (gameState.winner === 'tie') {
          return "It's a tie!";
        } else if (gameState.winner === session?.user_id) {
          return 'You won! 🎉';
        } else {
          const winnerPlayer = gameState.players[gameState.winner || ''];
          return `${winnerPlayer?.username || 'Opponent'} won!`;
        }
      default:
        return '';
    }
  };

  const resetGame = () => {
    setMatchId(null);
    setGameState({
      board: Array(9).fill(null),
      currentPlayer: '',
      players: {},
      gameStatus: 'waiting',
      winner: null,
      moveCount: 0
    });
    setErrorMessage('');
    setIsSearching(false);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-8">LILA Tic-Tac-Toe</h1>
      
      {/* Connection Status */}
      {!session && !connectionError && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Connecting to server...</p>
        </div>
      )}

      {/* Enhanced Connection Status */}
      <div className="mb-6 max-w-md mx-auto">
        <ConnectionStatus
          isConnected={socketConnected}
          isConnecting={isConnecting || (!session && !connectionError)}
          error={connectionError}
          onRetry={retryConnection}
          onDismissError={clearErrors}
          showDebugInfo={process.env.NODE_ENV === 'development'}
          connectionAttempts={connectionAttempts}
          lastConnectionTime={lastConnectionTime}
        />
      </div>

      {/* Legacy Error Message (for backward compatibility) */}
      {errorMessage && !connectionError && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-4 max-w-md text-center mx-auto">
          {errorMessage}
          <button 
            onClick={() => setErrorMessage('')}
            className="ml-4 text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Game Status and Controls */}
      {session && (
        <div className="text-center mb-6">
          <div className="text-2xl font-semibold mb-4">{getGameStatusText()}</div>
          
          {/* Player Info */}
          {Object.keys(gameState.players).length > 0 && (
            <div className="flex justify-center gap-8 mb-4">
              {Object.entries(gameState.players).map(([userId, player]) => (
                <div 
                  key={userId}
                  className={`p-3 rounded-lg ${
                    userId === session?.user_id ? 'bg-blue-600' : 'bg-gray-600'
                  } ${userId === gameState.currentPlayer ? 'ring-2 ring-yellow-400' : ''}`}
                >
                  <div className="font-bold">{player.symbol}</div>
                  <div className="text-sm">
                    {userId === session?.user_id ? 'You' : player.username}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {!matchId && !isSearching && (
            <div className="space-y-4">
              <button
                onClick={findMatch}
                disabled={!socketConnected}
                className={`px-8 py-4 rounded-lg text-xl font-semibold transition-colors block mx-auto ${
                  socketConnected 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                {socketConnected ? 'Find Match' : 'Connecting...'}
              </button>
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="px-6 py-2 bg-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
              </button>
            </div>
          )}

          {isSearching && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p>Searching for opponent...</p>
            </div>
          )}

          {gameState.gameStatus === 'finished' && (
            <button
              onClick={resetGame}
              className="px-6 py-3 bg-purple-600 rounded-lg text-lg hover:bg-purple-700 transition-colors mt-4"
            >
              Play Again
            </button>
          )}
        </div>
      )}

      {/* Game Board */}
      {matchId && (
        <div className="game-board">
          <div className="grid grid-cols-3 gap-3 mb-6">
            {gameState.board.map((cell: string | null, index: number) => (
              <button
                key={index}
                onClick={() => makeMove(index)}
                disabled={
                  cell !== null || 
                  gameState.gameStatus !== 'playing' || 
                  !isMyTurn()
                }
                className={`
                  w-20 h-20 sm:w-24 sm:h-24 
                  flex items-center justify-center 
                  text-4xl sm:text-5xl font-bold 
                  rounded-lg transition-colors
                  ${cell !== null 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : gameState.gameStatus === 'playing' && isMyTurn()
                      ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                      : 'bg-gray-800 cursor-not-allowed'
                  }
                  ${gameState.lastMove?.position === index 
                    ? 'ring-2 ring-blue-400' 
                    : ''
                  }
                `}
              >
                <span className={`
                  ${cell === 'X' ? 'text-blue-400' : cell === 'O' ? 'text-red-400' : 'text-gray-400'}
                `}>
                  {cell || ''}
                </span>
              </button>
            ))}
          </div>

          {/* Game Stats */}
          <div className="text-center text-sm text-gray-400">
            Move #{gameState.moveCount}
            {gameState.lastMove && (
              <div className="mt-1">
                Last move: {gameState.lastMove.symbol} at position {gameState.lastMove.position + 1}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Section */}
      {showLeaderboard && (
        <div className="mt-8 w-full max-w-6xl">
          <Leaderboard session={session} />
        </div>
      )}
    </main>
  );
}