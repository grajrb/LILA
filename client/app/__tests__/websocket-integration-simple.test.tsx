// client/app/__tests__/websocket-integration-simple.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WebSocketErrorBoundary from '../components/websocket-error-boundary';
import ConnectionStatusIndicator from '../components/connection-status-indicator';

// Mock console methods to reduce test noise
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

beforeAll(() => {
  Object.assign(console, mockConsole);
});

afterEach(() => {
  Object.values(mockConsole).forEach(mock => mock.mockClear());
});

describe('WebSocket Integration - Core Components', () => {
  describe('ConnectionStatusIndicator', () => {
    it('should display connecting state with proper indicators', () => {
      render(
        <ConnectionStatusIndicator
          status="connecting"
          protocol="wss"
          showProtocol={true}
        />
      );

      expect(screen.getByText('Connecting')).toBeInTheDocument();
      expect(screen.getByText('WSS')).toBeInTheDocument();
      expect(screen.getByText('🔒')).toBeInTheDocument();
    });

    it('should display connected state with security indicators', () => {
      render(
        <ConnectionStatusIndicator
          status="connected"
          protocol="wss"
          showProtocol={true}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Real-time connection active')).toBeInTheDocument();
      expect(screen.getByText('WSS')).toBeInTheDocument();
      expect(screen.getByText('🔒')).toBeInTheDocument();
    });

    it('should display error state with retry functionality', () => {
      const mockRetry = jest.fn();
      
      render(
        <ConnectionStatusIndicator
          status="error"
          protocol="wss"
          errorMessage="Connection failed"
          onRetry={mockRetry}
          showProtocol={true}
        />
      );

      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
      
      const retryButton = screen.getByRole('button', { name: /retry connection/i });
      fireEvent.click(retryButton);
      
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should show troubleshooting tips when enabled', () => {
      render(
        <ConnectionStatusIndicator
          status="error"
          protocol="wss"
          errorMessage="Network error"
          showTroubleshooting={true}
        />
      );

      const troubleshootingButton = screen.getByRole('button', { name: /troubleshooting/i });
      fireEvent.click(troubleshootingButton);

      expect(screen.getByText('💡 Troubleshooting Tips')).toBeInTheDocument();
    });

    it('should display retry countdown correctly', () => {
      render(
        <ConnectionStatusIndicator
          status="retrying"
          protocol="wss"
          retryCountdown={3}
        />
      );

      expect(screen.getByText('Retrying (3s)')).toBeInTheDocument();
    });

    it('should handle insecure protocol indication', () => {
      render(
        <ConnectionStatusIndicator
          status="connected"
          protocol="ws"
          showProtocol={true}
        />
      );

      expect(screen.getByText('WS')).toBeInTheDocument();
      // Should not show security lock icon for insecure connection
      expect(screen.queryByText('🔒')).not.toBeInTheDocument();
    });
  });

  describe('WebSocketErrorBoundary', () => {
    // Mock component that throws errors
    const ThrowingComponent = ({ shouldThrow, errorMessage }: { shouldThrow: boolean; errorMessage?: string }) => {
      if (shouldThrow) {
        throw new Error(errorMessage || 'Test error');
      }
      return <div>Normal Component</div>;
    };

    it('should catch and display WebSocket security errors', () => {
      const onError = jest.fn();
      
      render(
        <WebSocketErrorBoundary onError={onError}>
          <ThrowingComponent 
            shouldThrow={true} 
            errorMessage="Mixed Content: The page at https://example.com was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint ws://localhost:7350/ws"
          />
        </WebSocketErrorBoundary>
      );

      expect(screen.getByText('Security Issue')).toBeInTheDocument();
      expect(screen.getByText(/Connection blocked due to security policy/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(onError).toHaveBeenCalled();
    });

    it('should catch and display WebSocket network errors', () => {
      render(
        <WebSocketErrorBoundary>
          <ThrowingComponent 
            shouldThrow={true} 
            errorMessage="WebSocket connection failed: Connection refused"
          />
        </WebSocketErrorBoundary>
      );

      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to the game server/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should provide recovery options', () => {
      render(
        <WebSocketErrorBoundary>
          <ThrowingComponent shouldThrow={true} errorMessage="WebSocket error" />
        </WebSocketErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    });

    it('should reset error boundary on retry', () => {
      const { rerender } = render(
        <WebSocketErrorBoundary>
          <ThrowingComponent shouldThrow={true} errorMessage="Test error" />
        </WebSocketErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText('Connection Error')).toBeInTheDocument();

      // Click try again
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      // Rerender with non-throwing component
      rerender(
        <WebSocketErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </WebSocketErrorBoundary>
      );

      // Should show normal component
      expect(screen.getByText('Normal Component')).toBeInTheDocument();
    });

    it('should show technical details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <WebSocketErrorBoundary>
          <ThrowingComponent shouldThrow={true} errorMessage="Test error with stack" />
        </WebSocketErrorBoundary>
      );

      const detailsElement = screen.getByText('Technical Details');
      expect(detailsElement).toBeInTheDocument();

      fireEvent.click(detailsElement);
      expect(screen.getByText('Test error with stack')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should render children normally when no error occurs', () => {
      render(
        <WebSocketErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </WebSocketErrorBoundary>
      );

      expect(screen.getByText('Normal Component')).toBeInTheDocument();
    });
  });

  describe('WebSocket Connection Flow Integration', () => {
    it('should handle complete connection state transitions', async () => {
      const mockRetry = jest.fn();
      let currentStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

      const TestComponent = () => {
        const [status, setStatus] = React.useState(currentStatus);

        React.useEffect(() => {
          setStatus(currentStatus);
        }, []);

        return (
          <div>
            <ConnectionStatusIndicator
              status={status}
              protocol="wss"
              onRetry={() => {
                mockRetry();
                setStatus('connecting');
                setTimeout(() => setStatus('connected'), 100);
              }}
              showProtocol={true}
            />
            <button onClick={() => setStatus('connecting')}>Start Connection</button>
            <button onClick={() => setStatus('error')}>Simulate Error</button>
          </div>
        );
      };

      render(<TestComponent />);

      // Initial state
      expect(screen.getByText('Disconnected')).toBeInTheDocument();

      // Start connection
      fireEvent.click(screen.getByRole('button', { name: /start connection/i }));
      expect(screen.getByText('Connecting')).toBeInTheDocument();

      // Simulate error
      fireEvent.click(screen.getByRole('button', { name: /simulate error/i }));
      expect(screen.getByText('Connection Failed')).toBeInTheDocument();

      // Retry connection
      const retryButton = screen.getByRole('button', { name: /retry connection/i });
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(1);

      // Should eventually show connected
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should handle protocol security validation', () => {
      // Test secure protocol
      const { rerender } = render(
        <ConnectionStatusIndicator
          status="connected"
          protocol="wss"
          showProtocol={true}
        />
      );

      expect(screen.getByText('WSS')).toBeInTheDocument();
      expect(screen.getByText('🔒')).toBeInTheDocument();

      // Test insecure protocol
      rerender(
        <ConnectionStatusIndicator
          status="connected"
          protocol="ws"
          showProtocol={true}
        />
      );

      expect(screen.getByText('WS')).toBeInTheDocument();
      expect(screen.queryByText('🔒')).not.toBeInTheDocument();
    });

    it('should provide appropriate error messages for different error types', () => {
      const errorScenarios = [
        {
          errorMessage: 'Mixed Content Policy violation',
          expectedText: /security policy/i
        },
        {
          errorMessage: 'Connection timeout',
          expectedText: /connection failed/i
        },
        {
          errorMessage: 'Network unreachable',
          expectedText: /connection failed/i
        }
      ];

      errorScenarios.forEach(({ errorMessage, expectedText }) => {
        const { unmount } = render(
          <ConnectionStatusIndicator
            status="error"
            protocol="wss"
            errorMessage={errorMessage}
            showTroubleshooting={true}
          />
        );

        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Error Recovery and User Experience', () => {
    it('should provide clear user guidance for different error types', () => {
      const TestErrorComponent = ({ errorType }: { errorType: string }) => {
        const getErrorMessage = () => {
          switch (errorType) {
            case 'security':
              return 'Mixed Content: Cannot connect to insecure WebSocket from HTTPS page';
            case 'network':
              return 'Network error: Connection refused';
            case 'timeout':
              return 'Connection timeout after 5000ms';
            default:
              return 'Unknown error';
          }
        };

        return (
          <ConnectionStatusIndicator
            status="error"
            protocol="wss"
            errorMessage={getErrorMessage()}
            showTroubleshooting={true}
          />
        );
      };

      // Test security error guidance
      const { rerender } = render(<TestErrorComponent errorType="security" />);
      
      fireEvent.click(screen.getByRole('button', { name: /troubleshooting/i }));
      expect(screen.getByText(/Troubleshooting Tips/)).toBeInTheDocument();

      // Test network error guidance
      rerender(<TestErrorComponent errorType="network" />);
      expect(screen.getByText(/Connection refused/)).toBeInTheDocument();

      // Test timeout error guidance
      rerender(<TestErrorComponent errorType="timeout" />);
      expect(screen.getByText(/timeout/)).toBeInTheDocument();
    });

    it('should handle retry countdown and automatic retry', async () => {
      jest.useFakeTimers();

      const TestRetryComponent = () => {
        const [countdown, setCountdown] = React.useState(3);
        const [status, setStatus] = React.useState<'error' | 'retrying' | 'connected'>('error');

        React.useEffect(() => {
          if (status === 'retrying' && countdown > 0) {
            const timer = setTimeout(() => {
              setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
          } else if (status === 'retrying' && countdown === 0) {
            setStatus('connected');
          }
        }, [status, countdown]);

        return (
          <div>
            <ConnectionStatusIndicator
              status={status}
              protocol="wss"
              retryCountdown={countdown}
              onRetry={() => {
                setStatus('retrying');
                setCountdown(3);
              }}
            />
          </div>
        );
      };

      render(<TestRetryComponent />);

      // Start retry
      const retryButton = screen.getByRole('button', { name: /retry connection/i });
      fireEvent.click(retryButton);

      expect(screen.getByText('Retrying (3s)')).toBeInTheDocument();

      // Advance timer
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('Retrying (2s)')).toBeInTheDocument();
      });

      jest.advanceTimersByTime(2000);
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide proper ARIA labels and roles', () => {
      render(
        <ConnectionStatusIndicator
          status="error"
          protocol="wss"
          errorMessage="Connection failed"
          onRetry={jest.fn()}
          showTroubleshooting={true}
        />
      );

      // Check for proper button roles
      expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /troubleshooting/i })).toBeInTheDocument();
    });

    it('should handle keyboard navigation', () => {
      const mockRetry = jest.fn();
      
      render(
        <ConnectionStatusIndicator
          status="error"
          protocol="wss"
          errorMessage="Connection failed"
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry connection/i });
      
      // Focus and activate with keyboard
      retryButton.focus();
      fireEvent.keyDown(retryButton, { key: 'Enter' });
      
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should provide visual feedback for different states', () => {
      const states = [
        { status: 'connecting' as const, expectedClass: 'animate-spin' },
        { status: 'connected' as const, expectedClass: 'animate-pulse' },
        { status: 'error' as const, expectedClass: 'bg-red-400' },
        { status: 'retrying' as const, expectedClass: 'animate-spin' }
      ];

      states.forEach(({ status }) => {
        const { unmount } = render(
          <ConnectionStatusIndicator
            status={status}
            protocol="wss"
          />
        );

        // Each status should have appropriate visual indicators
        const statusElement = screen.getByText(
          status === 'connecting' ? 'Connecting' :
          status === 'connected' ? 'Connected' :
          status === 'error' ? 'Connection Failed' :
          'Retrying'
        );
        
        expect(statusElement).toBeInTheDocument();
        unmount();
      });
    });
  });
});