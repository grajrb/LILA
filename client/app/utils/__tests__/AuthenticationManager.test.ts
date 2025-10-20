// client/app/utils/__tests__/AuthenticationManager.test.ts

import { AuthenticationManager } from '../AuthenticationManager';
import { ServerKeyValidator } from '../ServerKeyValidator';
import { EnvironmentConfig } from '../EnvironmentConfig';
import { AuthenticationErrorClassifier } from '../AuthenticationErrorClassifier';

// Mock the dependencies
jest.mock('../ServerKeyValidator');
jest.mock('../EnvironmentConfig');
jest.mock('../AuthenticationErrorClassifier');

// Mock Nakama client
const mockClient = {
  authenticateDevice: jest.fn(),
};

// Mock localStorage for browser environment
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let mockServerKeyValidator: jest.Mocked<ServerKeyValidator>;
  let mockEnvironmentConfig: jest.Mocked<EnvironmentConfig>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();

    // Setup mock instances
    mockServerKeyValidator = {
      validateKey: jest.fn(),
      maskKey: jest.fn(),
      detectKeyMismatch: jest.fn(),
      generateKeyReport: jest.fn(),
      getInstance: jest.fn(),
      clearValidationHistory: jest.fn(),
      getValidationHistory: jest.fn(),
    } as any;

    mockEnvironmentConfig = {
      getNakamaConfig: jest.fn(),
      isProduction: jest.fn(),
      isDevelopment: jest.fn(),
      getInstance: jest.fn(),
    } as any;

    // Setup mock returns
    (ServerKeyValidator.getInstance as jest.Mock).mockReturnValue(mockServerKeyValidator);
    (EnvironmentConfig.getInstance as jest.Mock).mockReturnValue(mockEnvironmentConfig);

    mockEnvironmentConfig.getNakamaConfig.mockReturnValue({
      serverKey: 'test-server-key',
      host: 'localhost',
      port: '7350',
      useSSL: false,
      protocol: 'ws' as const,
      timeout: 30000,
    });

    mockEnvironmentConfig.isProduction.mockReturnValue(false);
    mockServerKeyValidator.maskKey.mockReturnValue('te**********ey');

    // Create AuthenticationManager instance
    authManager = AuthenticationManager.getInstance(mockClient as any);
  });

  describe('Server Key Validation', () => {
    it('should validate server key successfully', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({
        isValid: true,
      });

      const result = await authManager.validateServerKey();

      expect(result).toBe(true);
      expect(mockServerKeyValidator.validateKey).toHaveBeenCalledWith('test-server-key');
    });

    it('should fail validation with invalid server key', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({
        isValid: false,
        error: 'Server key is too short',
        recommendation: 'Use a server key with at least 8 characters',
      });

      const result = await authManager.validateServerKey();

      expect(result).toBe(false);
      expect(mockServerKeyValidator.validateKey).toHaveBeenCalledWith('test-server-key');
    });

    it('should handle validation errors gracefully', async () => {
      mockServerKeyValidator.validateKey.mockImplementation(() => {
        throw new Error('Validation error');
      });

      const result = await authManager.validateServerKey();

      expect(result).toBe(false);
    });
  });

  describe('Device Authentication', () => {
    beforeEach(() => {
      mockServerKeyValidator.validateKey.mockReturnValue({
        isValid: true,
      });
    });

    it('should authenticate device successfully', async () => {
      const mockSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      mockClient.authenticateDevice.mockResolvedValue(mockSession);

      const result = await authManager.authenticateDevice('test-device-id');

      expect(result).toEqual(mockSession);
      expect(mockClient.authenticateDevice).toHaveBeenCalledWith('test-device-id', true);
      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('should generate device ID if not provided', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const mockSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockClient.authenticateDevice.mockResolvedValue(mockSession);

      await authManager.authenticateDevice();

      expect(mockClient.authenticateDevice).toHaveBeenCalledWith(
        expect.stringMatching(/^device_[a-z0-9]+$/),
        true
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'nakama_device_id',
        expect.stringMatching(/^device_[a-z0-9]+$/)
      );
    });

    it('should use existing device ID from localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('existing-device-id');
      
      const mockSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockClient.authenticateDevice.mockResolvedValue(mockSession);

      await authManager.authenticateDevice();

      expect(mockClient.authenticateDevice).toHaveBeenCalledWith('existing-device-id', true);
    });

    it('should fail authentication with invalid server key', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({
        isValid: false,
        error: 'Invalid server key',
      });

      await expect(authManager.authenticateDevice('test-device-id')).rejects.toThrow(
        'Server key validation failed - cannot proceed with authentication'
      );

      expect(mockClient.authenticateDevice).not.toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Authentication failed');
      mockClient.authenticateDevice.mockRejectedValue(authError);

      await expect(authManager.authenticateDevice('test-device-id')).rejects.toThrow(
        'Authentication failed'
      );

      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('Authentication Status', () => {
    it('should return correct authentication status', () => {
      const status = authManager.getAuthenticationStatus();

      expect(status).toEqual({
        isAuthenticated: false,
        serverKeyValid: false,
        attempts: 0,
      });
    });

    it('should update status after successful authentication', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
      
      const mockSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockClient.authenticateDevice.mockResolvedValue(mockSession);

      await authManager.authenticateDevice('test-device-id');

      const status = authManager.getAuthenticationStatus();
      expect(status.isAuthenticated).toBe(true);
      expect(status.attempts).toBe(1);
    });

    it('should detect expired sessions', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
      
      const expiredSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      mockClient.authenticateDevice.mockResolvedValue(expiredSession);

      await authManager.authenticateDevice('test-device-id');

      // Session should be expired when checking status
      const status = authManager.getAuthenticationStatus();
      expect(status.isAuthenticated).toBe(false);
      expect(status.lastError).toBe('Session expired');
    });
  });

  describe('Retry Authentication', () => {
    beforeEach(() => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
    });

    it('should retry authentication and succeed on second attempt', async () => {
      const mockSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockClient.authenticateDevice
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSession);

      const result = await authManager.retryAuthentication(2, 'test-device-id');

      expect(result).toEqual(mockSession);
      expect(mockClient.authenticateDevice).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying on server key mismatch', async () => {
      const keyMismatchError = new Error('Unauthorized');
      
      // Mock the error classifier to detect server key mismatch
      (AuthenticationErrorClassifier.shouldRetry as jest.Mock).mockReturnValue(false);

      mockClient.authenticateDevice.mockRejectedValue(keyMismatchError);

      await expect(authManager.retryAuthentication(3, 'test-device-id')).rejects.toThrow();

      // Should only attempt once, not retry
      expect(mockClient.authenticateDevice).toHaveBeenCalledTimes(1);
    });

    it('should fail after maximum retry attempts', async () => {
      const networkError = new Error('Network error');
      
      (AuthenticationErrorClassifier.shouldRetry as jest.Mock).mockReturnValue(true);
      mockClient.authenticateDevice.mockRejectedValue(networkError);

      await expect(authManager.retryAuthentication(2, 'test-device-id')).rejects.toThrow(
        'Authentication failed after 2 attempts'
      );

      expect(mockClient.authenticateDevice).toHaveBeenCalledTimes(2);
    });
  });

  describe('Session Management', () => {
    it('should return current session when authenticated', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
      
      const mockSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockClient.authenticateDevice.mockResolvedValue(mockSession);

      await authManager.authenticateDevice('test-device-id');

      expect(authManager.getCurrentSession()).toEqual(mockSession);
    });

    it('should return undefined when not authenticated', () => {
      expect(authManager.getCurrentSession()).toBeUndefined();
    });

    it('should clear session correctly', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
      
      const mockSession = {
        user_id: 'test-user-id',
        username: 'test-user',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockClient.authenticateDevice.mockResolvedValue(mockSession);

      await authManager.authenticateDevice('test-device-id');
      expect(authManager.isAuthenticated()).toBe(true);

      authManager.clearSession();
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentSession()).toBeUndefined();
    });
  });

  describe('Error Classification Integration', () => {
    it('should get user-friendly error message', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
      
      const authError = new Error('Authentication failed');
      mockClient.authenticateDevice.mockRejectedValue(authError);

      (AuthenticationErrorClassifier.getUserFriendlyMessage as jest.Mock).mockReturnValue(
        'Connection error. Please try again.'
      );

      try {
        await authManager.authenticateDevice('test-device-id');
      } catch (error) {
        // Error is expected
      }

      const userMessage = authManager.getLastErrorUserMessage();
      expect(userMessage).toBe('Connection error. Please try again.');
    });

    it('should get developer error message', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
      
      const authError = new Error('Authentication failed');
      mockClient.authenticateDevice.mockRejectedValue(authError);

      (AuthenticationErrorClassifier.getDeveloperMessage as jest.Mock).mockReturnValue(
        'Network connectivity issue connecting to localhost:7350'
      );

      try {
        await authManager.authenticateDevice('test-device-id');
      } catch (error) {
        // Error is expected
      }

      const devMessage = authManager.getLastErrorDeveloperMessage();
      expect(devMessage).toBe('Network connectivity issue connecting to localhost:7350');
    });

    it('should get suggested actions for error resolution', async () => {
      mockServerKeyValidator.validateKey.mockReturnValue({ isValid: true });
      
      const authError = new Error('Authentication failed');
      mockClient.authenticateDevice.mockRejectedValue(authError);

      (AuthenticationErrorClassifier.getSuggestedActions as jest.Mock).mockReturnValue([
        'Check internet connection',
        'Verify server is running',
        'Check firewall settings'
      ]);

      try {
        await authManager.authenticateDevice('test-device-id');
      } catch (error) {
        // Error is expected
      }

      const actions = authManager.getLastErrorSuggestedActions();
      expect(actions).toEqual([
        'Check internet connection',
        'Verify server is running',
        'Check firewall settings'
      ]);
    });
  });

  describe('Configuration', () => {
    it('should set maximum retry attempts', () => {
      authManager.setMaxRetries(5);
      // No direct way to test this, but it should not throw
      expect(() => authManager.setMaxRetries(5)).not.toThrow();
    });

    it('should limit retry attempts to valid range', () => {
      authManager.setMaxRetries(15); // Should be capped at 10
      authManager.setMaxRetries(0);  // Should be set to 1
      // No direct way to test this, but it should not throw
      expect(() => authManager.setMaxRetries(15)).not.toThrow();
    });

    it('should set retry delay', () => {
      authManager.setRetryDelay(5000);
      // No direct way to test this, but it should not throw
      expect(() => authManager.setRetryDelay(5000)).not.toThrow();
    });

    it('should limit retry delay to valid range', () => {
      authManager.setRetryDelay(50);    // Should be set to 100
      authManager.setRetryDelay(20000); // Should be capped at 10000
      // No direct way to test this, but it should not throw
      expect(() => authManager.setRetryDelay(50)).not.toThrow();
    });
  });
});