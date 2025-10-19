// client/app/__tests__/connection-monitor.test.ts

import { ConnectionMonitor } from '../utils/connection-monitor';

// Mock performance and navigator APIs
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false
  }
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
});

describe('ConnectionMonitor', () => {
  let monitor: ConnectionMonitor;

  beforeEach(() => {
    monitor = new ConnectionMonitor({
      maxLogEntries: 50,
      enableNetworkInfo: true,
      enablePerformanceTracking: true,
      logLevel: 'debug'
    });
  });

  afterEach(() => {
    monitor.clearLogs();
  });

  describe('Connection Attempt Tracking', () => {
    it('should start and track connection attempts', () => {
      const attemptId = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      
      expect(attemptId).toBeDefined();
      expect(attemptId).toMatch(/^attempt_\d+_[a-z0-9]+$/);
      
      const debugInfo = monitor.getDebugInfo();
      expect(debugInfo.activeAttempts).toHaveLength(1);
      expect(debugInfo.activeAttempts[0].type).toBe('websocket');
      expect(debugInfo.activeAttempts[0].url).toBe('wss://example.com/ws');
      expect(debugInfo.activeAttempts[0].protocol).toBe('wss');
    });

    it('should track multiple concurrent attempts', () => {
      const wsAttemptId = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      const authAttemptId = monitor.startAttempt('authentication');
      const matchAttemptId = monitor.startAttempt('matchmaking');
      
      const debugInfo = monitor.getDebugInfo();
      expect(debugInfo.activeAttempts).toHaveLength(3);
      
      const attemptTypes = debugInfo.activeAttempts.map(a => a.type);
      expect(attemptTypes).toContain('websocket');
      expect(attemptTypes).toContain('authentication');
      expect(attemptTypes).toContain('matchmaking');
    });

    it('should include network information when enabled', () => {
      const attemptId = monitor.startAttempt('websocket');
      
      const debugInfo = monitor.getDebugInfo();
      const attempt = debugInfo.activeAttempts[0];
      
      expect(attempt.networkInfo).toBeDefined();
      expect(attempt.networkInfo.effectiveType).toBe('4g');
      expect(attempt.networkInfo.downlink).toBe(10);
      expect(attempt.networkInfo.rtt).toBe(50);
      expect(attempt.userAgent).toBe('Mozilla/5.0 (Test Browser)');
    });

    it('should handle retry attempts correctly', () => {
      const attemptId = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss', 2);
      
      const debugInfo = monitor.getDebugInfo();
      const attempt = debugInfo.activeAttempts[0];
      
      expect(attempt.retryAttempt).toBe(2);
    });
  });

  describe('Success Tracking', () => {
    it('should mark attempts as successful and calculate duration', async () => {
      const attemptId = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      
      // Wait a small amount to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 10));
      
      monitor.markSuccess(attemptId, { sessionId: 'test-session' });
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalAttempts).toBe(1);
      expect(metrics.successfulConnections).toBe(1);
      expect(metrics.failedConnections).toBe(0);
      expect(metrics.averageConnectionTime).toBeGreaterThan(0);
      expect(metrics.currentStreak.type).toBe('success');
      expect(metrics.currentStreak.count).toBe(1);
      
      const recentLogs = monitor.getRecentLogs(1);
      expect(recentLogs[0].status).toBe('success');
      expect(recentLogs[0].duration).toBeGreaterThan(0);
    });

    it('should remove successful attempts from active tracking', () => {
      const attemptId = monitor.startAttempt('websocket');
      monitor.markSuccess(attemptId);
      
      const debugInfo = monitor.getDebugInfo();
      expect(debugInfo.activeAttempts).toHaveLength(0);
    });

    it('should track last successful connection time', () => {
      const beforeTime = new Date();
      const attemptId = monitor.startAttempt('websocket');
      
      monitor.markSuccess(attemptId);
      
      const metrics = monitor.getMetrics();
      expect(metrics.lastSuccessfulConnection).toBeDefined();
      expect(metrics.lastSuccessfulConnection!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('Failure Tracking', () => {
    it('should mark attempts as failed and track error details', () => {
      const attemptId = monitor.startAttempt('websocket', 'ws://example.com/ws', 'ws');
      const error = new Error('Mixed Content Policy violation');
      
      monitor.markFailure(attemptId, error, { context: 'security' });
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalAttempts).toBe(1);
      expect(metrics.successfulConnections).toBe(0);
      expect(metrics.failedConnections).toBe(1);
      expect(metrics.currentStreak.type).toBe('failure');
      expect(metrics.currentStreak.count).toBe(1);
      
      const recentLogs = monitor.getRecentLogs(1);
      expect(recentLogs[0].status).toBe('failed');
      expect(recentLogs[0].error).toBe('Mixed Content Policy violation');
    });

    it('should handle string errors correctly', () => {
      const attemptId = monitor.startAttempt('websocket');
      
      monitor.markFailure(attemptId, 'Connection timeout');
      
      const recentLogs = monitor.getRecentLogs(1);
      expect(recentLogs[0].error).toBe('Connection timeout');
    });

    it('should track error frequency by category', () => {
      // Create multiple failed attempts with different error types
      const attempt1 = monitor.startAttempt('websocket');
      monitor.markFailure(attempt1, new Error('Mixed Content Policy violation'));
      
      const attempt2 = monitor.startAttempt('websocket');
      monitor.markFailure(attempt2, new Error('Connection timeout'));
      
      const attempt3 = monitor.startAttempt('websocket');
      monitor.markFailure(attempt3, new Error('Mixed Content: blocked'));
      
      const metrics = monitor.getMetrics();
      expect(metrics.errorFrequency.security).toBe(2); // Two mixed content errors
      expect(metrics.errorFrequency.timeout).toBe(1); // One timeout error
    });

    it('should track last failed connection time', () => {
      const beforeTime = new Date();
      const attemptId = monitor.startAttempt('websocket');
      
      monitor.markFailure(attemptId, new Error('Test error'));
      
      const metrics = monitor.getMetrics();
      expect(metrics.lastFailedConnection).toBeDefined();
      expect(metrics.lastFailedConnection!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('Timeout Tracking', () => {
    it('should mark attempts as timed out', () => {
      const attemptId = monitor.startAttempt('websocket');
      
      monitor.markTimeout(attemptId, 5000);
      
      const metrics = monitor.getMetrics();
      expect(metrics.failedConnections).toBe(1);
      
      const recentLogs = monitor.getRecentLogs(1);
      expect(recentLogs[0].status).toBe('timeout');
      expect(recentLogs[0].duration).toBe(5000);
      expect(recentLogs[0].error).toContain('timed out after 5000ms');
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate comprehensive metrics correctly', () => {
      // Create a mix of successful and failed attempts
      const success1 = monitor.startAttempt('websocket');
      monitor.markSuccess(success1);
      
      const success2 = monitor.startAttempt('authentication');
      monitor.markSuccess(success2);
      
      const failure1 = monitor.startAttempt('websocket');
      monitor.markFailure(failure1, new Error('Network error'));
      
      const timeout1 = monitor.startAttempt('matchmaking');
      monitor.markTimeout(timeout1, 3000);
      
      const metrics = monitor.getMetrics();
      
      expect(metrics.totalAttempts).toBe(4);
      expect(metrics.successfulConnections).toBe(2);
      expect(metrics.failedConnections).toBe(2); // failure + timeout
      expect(metrics.currentStreak.type).toBe('failure'); // Last attempt was timeout
      expect(metrics.currentStreak.count).toBe(2); // failure + timeout
    });

    it('should calculate current success streak correctly', () => {
      // Create multiple successful attempts
      for (let i = 0; i < 3; i++) {
        const attemptId = monitor.startAttempt('websocket');
        monitor.markSuccess(attemptId);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.currentStreak.type).toBe('success');
      expect(metrics.currentStreak.count).toBe(3);
    });

    it('should calculate current failure streak correctly', () => {
      // Start with success, then failures
      const success = monitor.startAttempt('websocket');
      monitor.markSuccess(success);
      
      const failure1 = monitor.startAttempt('websocket');
      monitor.markFailure(failure1, new Error('Error 1'));
      
      const failure2 = monitor.startAttempt('websocket');
      monitor.markFailure(failure2, new Error('Error 2'));
      
      const metrics = monitor.getMetrics();
      expect(metrics.currentStreak.type).toBe('failure');
      expect(metrics.currentStreak.count).toBe(2);
    });

    it('should calculate average connection time for successful attempts only', () => {
      // Mock setTimeout to control timing
      jest.useFakeTimers();
      
      const attempt1 = monitor.startAttempt('websocket');
      jest.advanceTimersByTime(100);
      monitor.markSuccess(attempt1);
      
      const attempt2 = monitor.startAttempt('websocket');
      jest.advanceTimersByTime(200);
      monitor.markSuccess(attempt2);
      
      const attempt3 = monitor.startAttempt('websocket');
      jest.advanceTimersByTime(300);
      monitor.markFailure(attempt3, new Error('Failed')); // Should not affect average
      
      const metrics = monitor.getMetrics();
      expect(metrics.averageConnectionTime).toBe(150); // (100 + 200) / 2
      
      jest.useRealTimers();
    });
  });

  describe('Log Filtering and Querying', () => {
    beforeEach(() => {
      // Create test data
      const ws1 = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      monitor.markSuccess(ws1);
      
      const auth1 = monitor.startAttempt('authentication');
      monitor.markFailure(auth1, new Error('Auth failed'));
      
      const ws2 = monitor.startAttempt('websocket', 'ws://example.com/ws', 'ws');
      monitor.markFailure(ws2, new Error('Mixed content'));
      
      const match1 = monitor.startAttempt('matchmaking');
      monitor.markSuccess(match1);
    });

    it('should filter logs by connection type', () => {
      const websocketLogs = monitor.getFilteredLogs({ type: 'websocket' });
      const authLogs = monitor.getFilteredLogs({ type: 'authentication' });
      const matchLogs = monitor.getFilteredLogs({ type: 'matchmaking' });
      
      expect(websocketLogs).toHaveLength(2);
      expect(authLogs).toHaveLength(1);
      expect(matchLogs).toHaveLength(1);
    });

    it('should filter logs by status', () => {
      const successLogs = monitor.getFilteredLogs({ status: 'success' });
      const failedLogs = monitor.getFilteredLogs({ status: 'failed' });
      
      expect(successLogs).toHaveLength(2);
      expect(failedLogs).toHaveLength(2);
    });

    it('should filter logs by protocol', () => {
      const wssLogs = monitor.getFilteredLogs({ protocol: 'wss' });
      const wsLogs = monitor.getFilteredLogs({ protocol: 'ws' });
      
      expect(wssLogs).toHaveLength(1);
      expect(wsLogs).toHaveLength(1);
    });

    it('should filter logs by time range', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      const recentLogs = monitor.getFilteredLogs({ since: oneMinuteAgo });
      expect(recentLogs).toHaveLength(4); // All logs should be recent
      
      const futureLogs = monitor.getFilteredLogs({ since: new Date(now.getTime() + 60000) });
      expect(futureLogs).toHaveLength(0); // No logs from the future
    });

    it('should combine multiple filter criteria', () => {
      const failedWebSocketLogs = monitor.getFilteredLogs({ 
        type: 'websocket', 
        status: 'failed' 
      });
      
      expect(failedWebSocketLogs).toHaveLength(1);
      expect(failedWebSocketLogs[0].error).toContain('Mixed content');
    });
  });

  describe('Data Export', () => {
    beforeEach(() => {
      const attempt1 = monitor.startAttempt('websocket', 'wss://example.com/ws', 'wss');
      monitor.markSuccess(attempt1);
      
      const attempt2 = monitor.startAttempt('authentication');
      monitor.markFailure(attempt2, new Error('Auth failed'));
    });

    it('should export logs as JSON', () => {
      const jsonExport = monitor.exportLogs('json');
      const parsedLogs = JSON.parse(jsonExport);
      
      expect(Array.isArray(parsedLogs)).toBe(true);
      expect(parsedLogs).toHaveLength(2);
      expect(parsedLogs[0]).toHaveProperty('id');
      expect(parsedLogs[0]).toHaveProperty('timestamp');
      expect(parsedLogs[0]).toHaveProperty('type');
      expect(parsedLogs[0]).toHaveProperty('status');
    });

    it('should export logs as CSV', () => {
      const csvExport = monitor.exportLogs('csv');
      const lines = csvExport.split('\n');
      
      expect(lines[0]).toContain('timestamp,type,status,url,protocol,duration,error,retryAttempt');
      expect(lines).toHaveLength(3); // Header + 2 data rows
      expect(lines[1]).toContain('websocket');
      expect(lines[2]).toContain('authentication');
    });
  });

  describe('Memory Management', () => {
    it('should limit log entries to prevent memory leaks', () => {
      const smallMonitor = new ConnectionMonitor({ maxLogEntries: 3 });
      
      // Create more logs than the limit
      for (let i = 0; i < 5; i++) {
        const attemptId = smallMonitor.startAttempt('websocket');
        smallMonitor.markSuccess(attemptId);
      }
      
      const logs = smallMonitor.getRecentLogs(10);
      expect(logs).toHaveLength(3); // Should be limited to maxLogEntries
    });

    it('should clear all logs and reset state', () => {
      const attempt1 = monitor.startAttempt('websocket');
      monitor.markSuccess(attempt1);
      
      const attempt2 = monitor.startAttempt('authentication');
      monitor.markFailure(attempt2, new Error('Test'));
      
      monitor.clearLogs();
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalAttempts).toBe(0);
      expect(metrics.successfulConnections).toBe(0);
      expect(metrics.failedConnections).toBe(0);
      
      const logs = monitor.getRecentLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle marking success for non-existent attempts gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      monitor.markSuccess('non-existent-id');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt non-existent-id not found when marking success'),
        undefined
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle marking failure for non-existent attempts gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      monitor.markFailure('non-existent-id', new Error('Test'));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt non-existent-id not found when marking failure'),
        undefined
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle marking timeout for non-existent attempts gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      monitor.markTimeout('non-existent-id', 5000);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt non-existent-id not found when marking timeout'),
        undefined
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Debug Information', () => {
    it('should provide comprehensive debug information', () => {
      const attempt1 = monitor.startAttempt('websocket');
      monitor.markSuccess(attempt1);
      
      const attempt2 = monitor.startAttempt('authentication');
      // Leave this one active
      
      const debugInfo = monitor.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('timestamp');
      expect(debugInfo).toHaveProperty('metrics');
      expect(debugInfo).toHaveProperty('recentLogs');
      expect(debugInfo).toHaveProperty('networkInfo');
      expect(debugInfo).toHaveProperty('activeAttempts');
      expect(debugInfo).toHaveProperty('config');
      expect(debugInfo).toHaveProperty('userAgent');
      
      expect(debugInfo.activeAttempts).toHaveLength(1);
      expect(debugInfo.recentLogs).toHaveLength(1);
      expect(debugInfo.metrics.totalAttempts).toBe(1);
    });
  });
});