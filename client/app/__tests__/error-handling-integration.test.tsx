// client/app/__tests__/error-handling-integration.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConnectionStatus from '../components/connection-status';
import DebugPanel from '../components/debug-panel';
import { ErrorClassifier, ConnectionError } from '../utils/error-classifier';
import { ConnectionMonitor } from '../utils/connection-monitor';

// Mock console methods to avoid noise in tests
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

describe('Error Handling Integration Tests', () => {
  describe('ConnectionStatus Component', () => {
    const defaultProps = {
      isConnected: false,
      isConnecting: false,
      onRetry: jest.fn(),
      onDismissError: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should display connecting state correctly', () => {
      render(
        <ConnectionStatus
          {...defaultProps}
          isConnecting={true}
        />
      );

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(screen.getByRole('status', { hidden: true })).toHaveClass('animate-spin');
    });

    it('should display connected state correctly', () => {
      render(
        <ConnectionStatus
          {...defaultProps}
          isConnected={true}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should display security error with appropriate styling and actions', () => {
      const securityError = {
        type: 'security' as const,
        severity: 'high' as const,
        userMessage: '🔒 Security Error: Cannot connect using insecure WebSocket from a secure page.',
        technicalMessage: 'Mixed Content Policy violation',
        retryable: true,
        suggestedAction: 'The app will automatically retry with a secure connection (WSS).'
      };

      render(
        <ConnectionStatus
          {...defaultProps}
          error={securityError}
        />
      );

      expect(screen.getByText('Security Issue')).toBeInTheDocument();
      expect(screen.getByText(securityError.userMessage)).toBeInTheDocument();
      expect(screen.getByText(/The app will automatically retry/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should display network error with retry functionality', () => {
      const networkError = {
        type: 'network' as const,
        severity: 'medium' as const,
        userMessage: '🌐 Network Error: There was a problem connecting to the server.',
        technicalMessage: 'Connection timeout',
        retryable: true,
        suggestedAction: 'Check your internet connection and try again.'
      };

      render(
        <ConnectionStatus
          {...defaultProps}
          error={networkError}
        />
      );

      expect(screen.getByText('Network Issue')).toBeInTheDocument();
      expect(screen.getByText(networkError.userMessage)).toBeInTheDocument();
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(defaultProps.onRetry).toHaveBeenCalledTimes(1);
    });

    it('should handle dismiss error functionality', () => {
      const error = {
        type: 'unknown' as const,
        severity: 'medium' as const,
        userMessage: 'Something went wrong',
        technicalMessage: 'Unknown error',
        retryable: false
      };

      render(
        <ConnectionStatus
          {...defaultProps}
          error={error}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);
      
      expect(defaultProps.onDismissError).toHaveBeenCalledTimes(1);
    });

    it('should show debug information in development mode', () => {
      const error = {
        type: 'server' as const,
        severity: 'high' as const,
        userMessage: 'Server Error',
        technicalMessage: 'Internal server error (500)',
        retryable: true
      };

      render(
        <ConnectionStatus
          {...defaultProps}
          error={error}
          showDebugInfo={true}
          connectionAttempts={3}
          lastConnectionTime={new Date('2023-01-01T12:00:00Z')}
        />
      );

      // Check for debug details
      const detailsElement = screen.getByText('Technical Details');
      expect(detailsElement).toBeInTheDocument();
      
      fireEvent.click(detailsElement);
      
      expect(screen.getByText('server')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should implement auto-retry countdown for retryable errors', async () => {
      jest.useFakeTimers();
      
      const retryableError = {
        type: 'security' as const,
        severity: 'high' as const,
        userMessage: 'Security Error',
        technicalMessage: 'Mixed content',
        retryable: true
      };

      render(
        <ConnectionStatus
          {...defaultProps}
          error={retryableError}
        />
      );

      // Should show countdown
      expect(screen.getByText(/Retry \(3s\)/)).toBeInTheDocument();
      
      // Advance timer
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText(/Retry \(2s\)/)).toBeInTheDocument();
      
      // Advance to trigger auto-retry
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(defaultProps.onRetry).toHaveBeenCalledTimes(1);
      });
      
      jest.useRealTimers();
    });
  });

  describe('DebugPanel Component', () => {
    let monitor: ConnectionMonitor;

    beforeEach(() => {
      monitor = new ConnectionMonitor({
        maxLogEntries: 10,
        enableNetworkInfo: true,
        logLevel: 'debug'
      });
    });

    it('should render debug button when not visible', () => {
      render(
        <DebugPanel
          monitor={monitor}
          isVisible={false}
          onToggle={jest.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /debug/i })).toBeInTheDocument();
    });

    it('should render debug panel when visible', () => {
      render(
        <DebugPanel
          monitor={monitor}
          isVisible={true}
          onToggle={jest.fn()}
        />
      );

      expect(screen.getByText('Connection Debug')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /logs/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /debug/i })).toBeInTheDocument();
    });

    it('should display metrics correctly', async () => {
      // Add some test data to monitor
      const attempt1 = monitor.startAttempt('websocket');
      monitor.markSuccess(attempt1);
      
      const attempt2 = monitor.startAttempt('authentication');
      monitor.markFailure(attempt2, new Error('Auth failed'));

      render(
        <DebugPanel
          monitor={monitor}
          isVisible={true}
          onToggle={jest.fn()}
        />
      );

      // Should be on metrics tab by default
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Total attempts
        expect(screen.getByText('50%')).toBeInTheDocument(); // Success rate
      });
    });

    it('should display logs in logs tab', async () => {
      // Add test data
      const attempt1 = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      monitor.markSuccess(attempt1);
      
      const attempt2 = monitor.startAttempt('authentication');
      monitor.markFailure(attempt2, new Error('Authentication failed'));

      render(
        <DebugPanel
          monitor={monitor}
          isVisible={true}
          onToggle={jest.fn()}
        />
      );

      // Switch to logs tab
      fireEvent.click(screen.getByRole('tab', { name: /logs/i }));

      await waitFor(() => {
        expect(screen.getByText('websocket')).toBeInTheDocument();
        expect(screen.getByText('authentication')).toBeInTheDocument();
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      });
    });

    it('should handle auto-refresh toggle', () => {
      render(
        <DebugPanel
          monitor={monitor}
          isVisible={true}
          onToggle={jest.fn()}
        />
      );

      const autoRefreshButton = screen.getByRole('button', { name: /auto/i });
      expect(autoRefreshButton).toHaveTextContent('🔄 Auto');
      
      fireEvent.click(autoRefreshButton);
      expect(autoRefreshButton).toHaveTextContent('⏸️ Manual');
    });

    it('should handle manual refresh', () => {
      render(
        <DebugPanel
          monitor={monitor}
          isVisible={true}
          onToggle={jest.fn()}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      // Should not throw any errors
      expect(refreshButton).toBeInTheDocument();
    });

    it('should export logs functionality', async () => {
      // Mock clipboard API
      const mockWriteText = jest.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText
        }
      });

      // Add test data
      const attempt1 = monitor.startAttempt('websocket');
      monitor.markSuccess(attempt1);

      render(
        <DebugPanel
          monitor={monitor}
          isVisible={true}
          onToggle={jest.fn()}
        />
      );

      // Switch to debug tab
      fireEvent.click(screen.getByRole('tab', { name: /debug/i }));

      await waitFor(() => {
        const copyJsonButton = screen.getByRole('button', { name: /copy json/i });
        fireEvent.click(copyJsonButton);
        
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('"type":"websocket"')
        );
      });
    });

    it('should clear logs functionality', async () => {
      // Add test data
      const attempt1 = monitor.startAttempt('websocket');
      monitor.markSuccess(attempt1);

      render(
        <DebugPanel
          monitor={monitor}
          isVisible={true}
          onToggle={jest.fn()}
        />
      );

      // Switch to debug tab
      fireEvent.click(screen.getByRole('tab', { name: /debug/i }));

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /clear/i });
        fireEvent.click(clearButton);
        
        // Verify logs are cleared
        const metrics = monitor.getMetrics();
        expect(metrics.totalAttempts).toBe(0);
      });
    });
  });

  describe('Error Classification Integration', () => {
    it('should classify and handle Mixed Content Policy errors end-to-end', () => {
      const mixedContentError: ConnectionError = {
        originalError: new Error('Mixed Content: The page at https://example.com was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint ws://localhost:7350/ws'),
        context: 'websocket',
        timestamp: new Date(),
        url: 'ws://localhost:7350/ws',
        protocol: 'ws'
      };

      const classification = ErrorClassifier.classifyError(mixedContentError);

      render(
        <ConnectionStatus
          isConnected={false}
          isConnecting={false}
          error={classification}
          onRetry={jest.fn()}
          onDismissError={jest.fn()}
        />
      );

      expect(screen.getByText('Security Issue')).toBeInTheDocument();
      expect(screen.getByText(/Security Error.*insecure WebSocket/)).toBeInTheDocument();
      expect(screen.getByText(/automatically retry.*secure connection/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle connection timeout errors with appropriate retry logic', () => {
      const timeoutError: ConnectionError = {
        originalError: new Error('WebSocket connection timeout after 5000ms'),
        context: 'websocket',
        timestamp: new Date()
      };

      const classification = ErrorClassifier.classifyError(timeoutError);

      render(
        <ConnectionStatus
          isConnected={false}
          isConnecting={false}
          error={classification}
          onRetry={jest.fn()}
          onDismissError={jest.fn()}
        />
      );

      expect(screen.getByText('Network Issue')).toBeInTheDocument();
      expect(screen.getByText(/Connection Timeout.*taking too long/)).toBeInTheDocument();
      expect(screen.getByText(/Check your internet connection/)).toBeInTheDocument();
    });

    it('should handle authentication errors with proper user guidance', () => {
      const authError: ConnectionError = {
        originalError: new Error('Authentication failed: Invalid credentials'),
        context: 'authentication',
        timestamp: new Date()
      };

      const classification = ErrorClassifier.classifyError(authError);

      render(
        <ConnectionStatus
          isConnected={false}
          isConnecting={false}
          error={classification}
          onRetry={jest.fn()}
          onDismissError={jest.fn()}
        />
      );

      expect(screen.getByText('Auth Issue')).toBeInTheDocument();
      expect(screen.getByText(/Authentication Error.*verifying your identity/)).toBeInTheDocument();
      expect(screen.getByText(/refresh the page.*authentication token/)).toBeInTheDocument();
    });
  });

  describe('Connection Recovery Mechanisms', () => {
    it('should implement proper retry delays for different error types', () => {
      const securityDelay = ErrorClassifier.getRetryDelay('security', 0);
      const networkDelay = ErrorClassifier.getRetryDelay('network', 0);
      const serverDelay = ErrorClassifier.getRetryDelay('server', 0);

      expect(securityDelay).toBe(1000); // Quick retry for protocol upgrades
      expect(networkDelay).toBe(2000); // Standard delay for network issues
      expect(serverDelay).toBe(3000); // Longer delay for server issues
    });

    it('should respect maximum retry limits', () => {
      const retryableError = {
        type: 'network' as const,
        severity: 'medium' as const,
        userMessage: 'Network error',
        technicalMessage: 'Connection failed',
        retryable: true
      };

      // Should allow retries within limit
      expect(ErrorClassifier.shouldRetry(retryableError, 0)).toBe(true);
      expect(ErrorClassifier.shouldRetry(retryableError, 2)).toBe(true);
      
      // Should not allow retries beyond limit
      expect(ErrorClassifier.shouldRetry(retryableError, 3)).toBe(false);
    });

    it('should not retry non-retryable errors', () => {
      const nonRetryableError = {
        type: 'authentication' as const,
        severity: 'high' as const,
        userMessage: 'Auth error',
        technicalMessage: 'Invalid token',
        retryable: false
      };

      expect(ErrorClassifier.shouldRetry(nonRetryableError, 0)).toBe(false);
    });
  });

  describe('Monitoring Integration', () => {
    it('should track connection attempts through the full lifecycle', () => {
      const monitor = new ConnectionMonitor();
      
      // Simulate a complete connection flow
      const wsAttemptId = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      monitor.markSuccess(wsAttemptId, { sessionId: 'test-session' });
      
      const authAttemptId = monitor.startAttempt('authentication');
      monitor.markFailure(authAttemptId, new Error('Invalid credentials'));
      
      const retryAttemptId = monitor.startAttempt('authentication', undefined, undefined, 1);
      monitor.markSuccess(retryAttemptId, { userId: 'user123' });

      const metrics = monitor.getMetrics();
      
      expect(metrics.totalAttempts).toBe(3);
      expect(metrics.successfulConnections).toBe(2);
      expect(metrics.failedConnections).toBe(1);
      expect(metrics.currentStreak.type).toBe('success');
      expect(metrics.currentStreak.count).toBe(1);
      
      const logs = monitor.getRecentLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].type).toBe('authentication'); // Most recent
      expect(logs[0].status).toBe('success');
      expect(logs[0].retryAttempt).toBe(1);
    });

    it('should provide comprehensive debug information for troubleshooting', () => {
      const monitor = new ConnectionMonitor();
      
      const attemptId = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      monitor.markFailure(attemptId, new Error('Mixed Content Policy violation'));

      const debugInfo = monitor.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('timestamp');
      expect(debugInfo).toHaveProperty('metrics');
      expect(debugInfo).toHaveProperty('recentLogs');
      expect(debugInfo).toHaveProperty('config');
      
      expect(debugInfo.metrics.totalAttempts).toBe(1);
      expect(debugInfo.metrics.failedConnections).toBe(1);
      expect(debugInfo.recentLogs[0].error).toContain('Mixed Content Policy');
    });
  });
});