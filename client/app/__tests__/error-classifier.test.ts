// client/app/__tests__/error-classifier.test.ts

import { ErrorClassifier, ConnectionError } from '../utils/error-classifier';

describe('ErrorClassifier', () => {
  const createConnectionError = (
    error: Error | string,
    context: 'websocket' | 'authentication' | 'matchmaking' | 'general' = 'websocket',
    url?: string,
    protocol?: string
  ): ConnectionError => ({
    originalError: error,
    context,
    timestamp: new Date(),
    url,
    protocol
  });

  describe('Security Error Classification', () => {
    it('should classify Mixed Content Policy violations correctly', () => {
      const error = new Error('Mixed Content: The page at https://example.com was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint ws://localhost:7350/ws');
      const connectionError = createConnectionError(error, 'websocket', 'ws://localhost:7350/ws', 'ws');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('security');
      expect(classification.severity).toBe('high');
      expect(classification.retryable).toBe(true);
      expect(classification.userMessage).toContain('Security Error');
      expect(classification.userMessage).toContain('insecure WebSocket');
      expect(classification.suggestedAction).toContain('automatically retry');
    });

    it('should classify SSL certificate errors correctly', () => {
      const error = new Error('WebSocket connection failed: SSL certificate verification failed');
      const connectionError = createConnectionError(error, 'websocket', 'wss://localhost:7350/ws', 'wss');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('security');
      expect(classification.severity).toBe('high');
      expect(classification.retryable).toBe(true);
      expect(classification.technicalMessage).toContain('SSL certificate');
    });

    it('should classify CORS errors as security issues', () => {
      const error = new Error('CORS policy: Cross origin requests are only supported for protocol schemes');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('security');
      expect(classification.severity).toBe('high');
    });
  });

  describe('Network Error Classification', () => {
    it('should classify connection timeout errors correctly', () => {
      const error = new Error('WebSocket connection timeout after 5000ms');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('network');
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBe(true);
      expect(classification.userMessage).toContain('Connection Timeout');
      expect(classification.suggestedAction).toContain('internet connection');
    });

    it('should classify connection refused errors correctly', () => {
      const error = new Error('Connection refused - server not reachable');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('network');
      expect(classification.severity).toBe('high');
      expect(classification.userMessage).toContain('Connection Refused');
      expect(classification.suggestedAction).toContain('server might be down');
    });

    it('should classify general network errors correctly', () => {
      const error = new Error('Network error: Unable to reach server');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('network');
      expect(classification.severity).toBe('medium');
      expect(classification.userMessage).toContain('Network Error');
    });
  });

  describe('Authentication Error Classification', () => {
    it('should classify authentication failures correctly', () => {
      const error = new Error('Authentication failed: Invalid credentials');
      const connectionError = createConnectionError(error, 'authentication');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('authentication');
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBe(true);
      expect(classification.userMessage).toContain('Authentication Error');
      expect(classification.suggestedAction).toContain('refreshing the page');
    });

    it('should classify unauthorized access correctly', () => {
      const error = new Error('Unauthorized: Access denied');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('authentication');
      expect(classification.userMessage).toContain('Authentication Error');
    });
  });

  describe('Server Error Classification', () => {
    it('should classify 500 server errors correctly', () => {
      const error = new Error('Internal server error (500)');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('server');
      expect(classification.severity).toBe('high');
      expect(classification.retryable).toBe(true);
      expect(classification.userMessage).toContain('Server Error');
      expect(classification.suggestedAction).toContain('server team has been notified');
    });

    it('should classify service unavailable errors correctly', () => {
      const error = new Error('Service unavailable - server overloaded');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('server');
      expect(classification.severity).toBe('high');
    });
  });

  describe('WebSocket Specific Error Classification', () => {
    it('should classify WebSocket handshake failures correctly', () => {
      const error = new Error('WebSocket handshake failed: Unexpected response code 404');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('network');
      expect(classification.userMessage).toContain('Connection Error');
      expect(classification.suggestedAction).toContain('automatically retry');
    });

    it('should classify WebSocket connection closed errors correctly', () => {
      const error = new Error('WebSocket connection closed unexpectedly');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('network');
      expect(classification.retryable).toBe(true);
    });
  });

  describe('Unknown Error Classification', () => {
    it('should classify unknown errors with fallback classification', () => {
      const error = new Error('Some unknown error occurred');
      const connectionError = createConnectionError(error, 'general');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('unknown');
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBe(true);
      expect(classification.userMessage).toContain('Unexpected Error');
      expect(classification.suggestedAction).toContain('refresh the page');
    });

    it('should handle string errors correctly', () => {
      const error = 'Connection failed for unknown reason';
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('unknown');
      expect(classification.technicalMessage).toBe(error);
    });
  });

  describe('Retry Logic', () => {
    it('should provide appropriate retry delays for different error types', () => {
      const securityDelay = ErrorClassifier.getRetryDelay('security', 0);
      const networkDelay = ErrorClassifier.getRetryDelay('network', 0);
      const serverDelay = ErrorClassifier.getRetryDelay('server', 0);
      
      expect(securityDelay).toBe(1000); // Quick retry for security upgrades
      expect(networkDelay).toBe(2000); // Longer delay for network issues
      expect(serverDelay).toBe(3000); // Longest delay for server issues
    });

    it('should implement exponential backoff for retry delays', () => {
      const firstDelay = ErrorClassifier.getRetryDelay('network', 0);
      const secondDelay = ErrorClassifier.getRetryDelay('network', 1);
      const thirdDelay = ErrorClassifier.getRetryDelay('network', 2);
      
      expect(secondDelay).toBeGreaterThan(firstDelay);
      expect(thirdDelay).toBeGreaterThan(secondDelay);
    });

    it('should determine retry eligibility correctly', () => {
      const retryableError = {
        type: 'network' as const,
        severity: 'medium' as const,
        userMessage: 'Network error',
        technicalMessage: 'Connection failed',
        retryable: true
      };

      const nonRetryableError = {
        type: 'authentication' as const,
        severity: 'high' as const,
        userMessage: 'Auth error',
        technicalMessage: 'Invalid token',
        retryable: false
      };

      expect(ErrorClassifier.shouldRetry(retryableError, 0)).toBe(true);
      expect(ErrorClassifier.shouldRetry(retryableError, 5)).toBe(false); // Too many attempts
      expect(ErrorClassifier.shouldRetry(nonRetryableError, 0)).toBe(false);
    });

    it('should respect maximum retry limits for different error types', () => {
      const securityError = {
        type: 'security' as const,
        severity: 'high' as const,
        userMessage: 'Security error',
        technicalMessage: 'Mixed content',
        retryable: true
      };

      expect(ErrorClassifier.shouldRetry(securityError, 0)).toBe(true);
      expect(ErrorClassifier.shouldRetry(securityError, 1)).toBe(true);
      expect(ErrorClassifier.shouldRetry(securityError, 2)).toBe(false); // Max 2 retries for security
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors with empty messages', () => {
      const error = new Error('');
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('unknown');
      expect(classification.technicalMessage).toBe('');
    });

    it('should handle null/undefined error objects gracefully', () => {
      const error = null as any;
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('unknown');
      expect(classification.retryable).toBe(true);
      expect(classification.technicalMessage).toBe('Unknown error occurred');
    });

    it('should handle complex error objects', () => {
      const error = {
        message: 'Mixed Content Policy violation',
        name: 'SecurityError',
        code: 18
      } as any;
      
      const connectionError = createConnectionError(error, 'websocket');
      
      const classification = ErrorClassifier.classifyError(connectionError);
      
      expect(classification.type).toBe('security');
      expect(classification.technicalMessage).toContain('Mixed Content');
    });
  });
});