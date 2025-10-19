// client/app/__tests__/websocket-integration.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '../page';
import { WebSocketManager } from '../websocket-manager';
import WebSocketErrorBoundary from '../components/websocket-error-boundary';
import ConnectionStatusIndicator from '../components/connection-status-indicator';

// Mock the Nakama client and related modules
jest.mock('../nakama', () => ({
  __esModule: true,
  default: {
    authenticateDevice: jest.fn(),
    createSocket: jest.fn(),
    getWebSocketUrl: jest.fn(() => 'wss://localhost:7350/ws'),
    getWebSocketProtocol: jest.fn(() => 'wss'),
  }
}));

jest.mock('../websocket-manager');
jest.mock('../leaderboard', () => {
  return function MockLeaderboard() {
    return <div data-testid="leaderboard">Leaderboard Component</div>;
  };
});

// Mock environment variables
const originalEnv = process.env;

// Mock console methods to reduce test noise
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock TextEncoder for Node.js environment
global.TextEncoder = class TextEncoder {
  encode(input: string): Uint8Array {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
};

global.TextDecoder = class TextDecoder {
  decode(input: Uint8Array): string {
    return Buffer.from(input).toString('utf8');
  }
};

beforeAll(() => {
  Object.assign(console, mockConsole);
});

afterEach(() => {
  Object.values(mockConsole).forEach(mock => mock.mockClear());
});

describe('WebSocket Integration End-to-End Tests', () => {
  let mockWebSocketManager: jest.Mocked<WebSocketManager>;
  let mockSocket: any;
  let mockSession: any;

  beforeEach(() => {
    // Reset environment
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      NEXT_PUBLIC_NAKAMA_HOST: 'localhost',
      NEXT_PUBLIC_NAKAMA_PORT: '7350',
      NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
    };

    // Mock WebSocket
    global.WebSocket = jest.fn().mockImplementation(() => ({
      close: jest.fn(),
      send: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: WebSocket.OPEN,
    }));

    // Mock session and socket
    mockSession = {
      user_id: 'test-user-123',
      username: 'TestUser',
      token: 'test-token'
    };

    mockSocket = {
      connect: jest.fn().mockResolvedValue(undefined),
      joinMatch: jest.fn(),
      addMatchmaker: jest.fn().mockResolvedValue(undefined),
      sendMatchState: jest.fn(),
      onnotification: null,
      ondisconnect: null,
      onerror: null,
      onmatchmakermatched: null,
      onmatchdata: null,
      onmatchpresence: null,
    };

    // Mock WebSocketManager
    mockWebSocketManager = {
      createSecureSocket: jest.fn().mockReturnValue(mockSocket),
      getCurrentProtocol: jest.fn().mockReturnValue('wss'),
      getConnectionStatus: jest.fn().mockReturnValue({
        connected: true,
        protocol: 'wss',
        attempts: [],
        lastError: undefined
      }),
      getWebSocketUrl: jest.fn().mockReturnValue('wss://localhost:7350/ws'),
      validateConnection: jest.fn().mockResolvedValue({ isValid: true, responseTime: 100 }),
      createSecureSocketWithRetry: jest.fn().mockResolvedValue(mockSocket),
      getRetryConfig: jest.fn().mockReturnValue({
        maxAttempts: 3,
        delays: [1000, 2000, 4000],
        protocols: ['wss', 'ws']
      }),
      updateRetryConfig: jest.fn(),
      clearConnectionHistory: jest.fn(),
    } as any;

    (WebSocketManager as jest.MockedClass<typeof WebSocketManager>).mockImplementation(() => mockWebSocketManager);

    // Mock nakamaClient
    const nakamaClient = require('../nakama').default;
    nakamaClient.authenticateDevice.mockResolvedValue(mockSession);
    nakamaClient.createSocket.mockReturnValue(mockSocket);

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'test-device-id'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: jest.fn(() => 'test-uuid-123'),
      },
      writable: true,
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Complete WebSocket Connection Flow', () => {
    it('should successfully establish WebSocket connection with security handling', async () => {
      render(<HomePage />);

      // Should show connecting state initially
      expect(screen.getByText('Connecting to server...')).toBeInTheDocument();

      // Wait for authentication and connection to complete
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify WebSocketManager was used correctly
      expect(mockWebSocketManager.createSecureSocket).toHaveBeenCalledWith(
        mockSession,
        true
      );

      // Verify socket connection was established
      expect(mockSocket.connect).toHaveBeenCalledWith(mockSession, true);

      // Should show connected state
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should handle Mixed Content Policy violations with automatic protocol upgrade', async () => {
      // Mock Mixed Content Policy error
      const mixedContentError = new Error('Mixed Content: The page at https://example.com was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint ws://localhost:7350/ws');
      mockSocket.connect.mockRejectedValueOnce(mixedContentError);

      // Mock successful retry with WSS
      const retrySocket = { ...mockSocket };
      retrySocket.connect = jest.fn().mockResolvedValue(undefined);
      mockWebSocketManager.createSecureSocket.mockReturnValueOnce(mockSocket).mockReturnValueOnce(retrySocket);

      render(<HomePage />);

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByText(/Security Issue/)).toBeInTheDocument();
      });

      // Should show security error message
      expect(screen.getByText(/Security Error.*insecure WebSocket/)).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Should eventually connect successfully
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });
    });

    it('should handle network connection failures with retry mechanism', async () => {
      // Mock network error
      const networkError = new Error('WebSocket connection failed: Connection refused');
      mockSocket.connect.mockRejectedValueOnce(networkError);

      render(<HomePage />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Network Issue/)).toBeInTheDocument();
      });

      // Should show network error message
      expect(screen.getByText(/Network Error.*connecting to the server/)).toBeInTheDocument();

      // Should show troubleshooting tips
      expect(screen.getByText(/Check your internet connection/)).toBeInTheDocument();

      // Mock successful retry
      mockSocket.connect.mockResolvedValueOnce(undefined);

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Should eventually connect successfully
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });
    });

    it('should display connection status indicators correctly', async () => {
      render(<HomePage />);

      // Should show connecting indicator initially
      await waitFor(() => {
        expect(screen.getByText('Connecting')).toBeInTheDocument();
      });

      // Wait for connection to complete
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Should show protocol indicator
      expect(screen.getByText('WSS')).toBeInTheDocument();
      expect(screen.getByText('🔒')).toBeInTheDocument(); // Security icon
    });
  });

  describe('Error Recovery and User Feedback', () => {
    it('should implement retry countdown for automatic recovery', async () => {
      jest.useFakeTimers();

      // Mock retryable error
      const retryableError = new Error('WebSocket connection timeout');
      mockSocket.connect.mockRejectedValueOnce(retryableError);

      render(<HomePage />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Network Issue/)).toBeInTheDocument();
      });

      // Should show retry countdown
      expect(screen.getByText(/Retry \(3s\)/)).toBeInTheDocument();

      // Advance timer
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByText(/Retry \(2s\)/)).toBeInTheDocument();

      // Mock successful retry
      mockSocket.connect.mockResolvedValueOnce(undefined);

      // Advance to trigger auto-retry
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Should eventually connect
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should show troubleshooting tips for connection errors', async () => {
      // Mock connection error
      const connectionError = new Error('Connection refused');
      mockSocket.connect.mockRejectedValueOnce(connectionError);

      render(<HomePage />);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/Network Issue/)).toBeInTheDocument();
      });

      // Click troubleshooting button
      const troubleshootingButton = screen.getByRole('button', { name: /troubleshooting/i });
      fireEvent.click(troubleshootingButton);

      // Should show troubleshooting tips
      expect(screen.getByText(/Troubleshooting Tips/)).toBeInTheDocument();
      expect(screen.getByText(/Check your internet connection/)).toBeInTheDocument();
      expect(screen.getByText(/Try refreshing the page/)).toBeInTheDocument();
    });

    it('should handle authentication errors with proper user guidance', async () => {
      // Mock authentication error
      const authError = new Error('Authentication failed: Invalid device ID');
      const nakamaClient = require('../nakama').default;
      nakamaClient.authenticateDevice.mockRejectedValueOnce(authError);

      render(<HomePage />);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/Auth Issue/)).toBeInTheDocument();
      });

      // Should show authentication error message
      expect(screen.getByText(/Authentication Error.*verifying your identity/)).toBeInTheDocument();
    });
  });

  describe('Connection Status Monitoring', () => {
    it('should track connection attempts and display metrics in debug mode', async () => {
      // Set development environment
      process.env.NODE_ENV = 'development';

      render(<HomePage />);

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });

      // Should show debug panel toggle in development
      expect(screen.getByRole('button', { name: /debug/i })).toBeInTheDocument();

      // Click debug panel
      fireEvent.click(screen.getByRole('button', { name: /debug/i }));

      // Should show debug information
      await waitFor(() => {
        expect(screen.getByText('Connection Debug')).toBeInTheDocument();
      });
    });

    it('should display WebSocket manager status in development mode', async () => {
      process.env.NODE_ENV = 'development';

      render(<HomePage />);

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });

      // Should show WebSocket manager status
      expect(screen.getByText('WebSocket Protocol:')).toBeInTheDocument();
      expect(screen.getByText('WSS')).toBeInTheDocument();
      expect(screen.getByText('Manager Status:')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should update connection status indicators in real-time', async () => {
      render(<HomePage />);

      // Initially connecting
      expect(screen.getByText('Connecting')).toBeInTheDocument();

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Simulate disconnection
      act(() => {
        if (mockSocket.ondisconnect) {
          mockSocket.ondisconnect();
        }
      });

      // Should update status
      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });
    });
  });

  describe('Game Flow Integration', () => {
    it('should enable matchmaking after successful WebSocket connection', async () => {
      render(<HomePage />);

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });

      // Find Match button should be enabled
      const findMatchButton = screen.getByRole('button', { name: /find match/i });
      expect(findMatchButton).not.toBeDisabled();

      // Click Find Match
      fireEvent.click(findMatchButton);

      // Should call matchmaker
      expect(mockSocket.addMatchmaker).toHaveBeenCalledWith('tictactoe', 2, 2);

      // Should show searching state
      expect(screen.getByText('Searching for opponent...')).toBeInTheDocument();
    });

    it('should handle match found and game state updates', async () => {
      render(<HomePage />);

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });

      // Simulate match found
      const matchData = {
        match_id: 'test-match-123',
        users: [{ user_id: 'test-user-123' }, { user_id: 'opponent-456' }]
      };

      act(() => {
        if (mockSocket.onmatchmakermatched) {
          mockSocket.onmatchmakermatched(matchData);
        }
      });

      // Should join the match
      expect(mockSocket.joinMatch).toHaveBeenCalledWith('test-match-123');

      // Simulate game state update
      const gameStateData = {
        board: Array(9).fill(null),
        currentPlayer: 'test-user-123',
        players: {
          'test-user-123': { symbol: 'X', username: 'TestUser' },
          'opponent-456': { symbol: 'O', username: 'Opponent' }
        },
        gameStatus: 'playing',
        winner: null,
        moveCount: 0
      };

      const matchDataUpdate = {
        op_code: 1, // GAME_STATE
        data: new TextEncoder().encode(JSON.stringify(gameStateData))
      };

      act(() => {
        if (mockSocket.onmatchdata) {
          mockSocket.onmatchdata(matchDataUpdate);
        }
      });

      // Should show game board
      await waitFor(() => {
        expect(screen.getByText('Your turn (X)')).toBeInTheDocument();
      });

      // Should show game board buttons
      const gameButtons = screen.getAllByRole('button');
      const boardButtons = gameButtons.filter(button => 
        button.className.includes('w-20') || button.className.includes('w-24')
      );
      expect(boardButtons).toHaveLength(9);
    });

    it('should handle WebSocket errors during gameplay', async () => {
      render(<HomePage />);

      // Wait for connection and start game
      await waitFor(() => {
        expect(screen.getByText('Find Match')).toBeInTheDocument();
      });

      // Simulate WebSocket error during gameplay
      const wsError = new Error('WebSocket connection lost');
      
      act(() => {
        if (mockSocket.onerror) {
          mockSocket.onerror(wsError);
        }
      });

      // Should show connection error
      await waitFor(() => {
        expect(screen.getByText(/Connection Issue/)).toBeInTheDocument();
      });

      // Should provide retry option
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Error Boundary Integration', () => {
    it('should catch and handle WebSocket-related React errors', () => {
      // Mock a component that throws WebSocket-related error
      const ThrowingComponent = () => {
        throw new Error('WebSocket connection failed: Mixed Content Policy violation');
      };

      const onError = jest.fn();

      render(
        <WebSocketErrorBoundary onError={onError}>
          <ThrowingComponent />
        </WebSocketErrorBoundary>
      );

      // Should show error boundary UI
      expect(screen.getByText('Security Issue')).toBeInTheDocument();
      expect(screen.getByText(/Connection blocked due to security policy/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

      // Should call onError callback
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should provide recovery options in error boundary', () => {
      const ThrowingComponent = () => {
        throw new Error('WebSocket network error');
      };

      render(
        <WebSocketErrorBoundary>
          <ThrowingComponent />
        </WebSocketErrorBoundary>
      );

      // Should show recovery options
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();

      // Test Try Again functionality
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      // Should attempt to recover (error boundary should reset)
      // In a real scenario, this would re-render the children
    });

    it('should show technical details in development mode', () => {
      process.env.NODE_ENV = 'development';

      const ThrowingComponent = () => {
        const error = new Error('WebSocket test error');
        error.stack = 'Error: WebSocket test error\n    at ThrowingComponent';
        throw error;
      };

      render(
        <WebSocketErrorBoundary>
          <ThrowingComponent />
        </WebSocketErrorBoundary>
      );

      // Should show technical details section
      const detailsElement = screen.getByText('Technical Details');
      expect(detailsElement).toBeInTheDocument();

      // Click to expand details
      fireEvent.click(detailsElement);

      // Should show error details
      expect(screen.getByText('WebSocket test error')).toBeInTheDocument();
      expect(screen.getByText(/Error: WebSocket test error/)).toBeInTheDocument();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid connection state changes gracefully', async () => {
      render(<HomePage />);

      // Simulate rapid state changes
      for (let i = 0; i < 5; i++) {
        act(() => {
          // Simulate connection/disconnection cycle
          if (mockSocket.ondisconnect) {
            mockSocket.ondisconnect();
          }
        });

        await act(async () => {
          // Simulate reconnection
          mockSocket.connect.mockResolvedValueOnce(undefined);
        });
      }

      // Should handle gracefully without crashes
      expect(screen.getByText('LILA Tic-Tac-Toe')).toBeInTheDocument();
    });

    it('should cleanup resources properly on component unmount', () => {
      const { unmount } = render(<HomePage />);

      // Unmount component
      unmount();

      // Should not throw any errors or leave hanging promises
      // This test mainly ensures no memory leaks or cleanup issues
    });

    it('should handle concurrent connection attempts correctly', async () => {
      render(<HomePage />);

      // Simulate multiple rapid retry attempts
      const retryButton = await screen.findByRole('button', { name: /retry/i });
      
      // Click retry multiple times rapidly
      fireEvent.click(retryButton);
      fireEvent.click(retryButton);
      fireEvent.click(retryButton);

      // Should handle gracefully without duplicate connections
      await waitFor(() => {
        expect(mockWebSocketManager.createSecureSocket).toHaveBeenCalled();
      });

      // Should not create excessive connection attempts
      expect(mockWebSocketManager.createSecureSocket).toHaveBeenCalledTimes(1);
    });
  });
});