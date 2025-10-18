// client/app/__tests__/websocket-manager.test.ts
import { WebSocketManager, RetryConfig } from '../websocket-manager';
import { Client, Session } from '@heroiclabs/nakama-js';

// Mock the Nakama client
jest.mock('@heroiclabs/nakama-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    createSocket: jest.fn().mockReturnValue({
      connect: jest.fn(),
      ondisconnect: null,
    }),
  })),
}));

// Mock environment variables
const originalEnv = process.env;

describe('WebSocketManager', () => {
  let mockClient: jest.Mocked<Client>;
  let webSocketManager: WebSocketManager;
  let mockSocket: any;

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_NAKAMA_HOST: 'localhost',
      NEXT_PUBLIC_NAKAMA_PORT: '7350',
      NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
    };

    // Create mock client and socket
    mockSocket = {
      connect: jest.fn().mockResolvedValue(undefined),
      ondisconnect: null,
    };

    mockClient = {
      createSocket: jest.fn().mockReturnValue(mockSocket),
    } as any;

    webSocketManager = new WebSocketManager(mockClient);

    // Mock window.location for browser environment tests
    delete (global as any).window;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Protocol Detection', () => {
    it('should use WSS when page is served over HTTPS', () => {
      // Mock HTTPS environment
      (global as any).window = {
        location: { protocol: 'https:' }
      };

      const protocol = webSocketManager.getCurrentProtocol();
      expect(protocol).toBe('wss');
    });

    it('should use configured SSL setting when page is served over HTTP', () => {
      // Mock HTTP environment
      (global as any).window = {
        location: { protocol: 'http:' }
      };

      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'true';
      const manager = new WebSocketManager(mockClient);
      
      const protocol = manager.getCurrentProtocol();
      expect(protocol).toBe('wss');
    });

    it('should use WS when page is HTTP and SSL is disabled', () => {
      // Mock HTTP environment
      (global as any).window = {
        location: { protocol: 'http:' }
      };

      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';
      const manager = new WebSocketManager(mockClient);
      
      const protocol = manager.getCurrentProtocol();
      expect(protocol).toBe('ws');
    });

    it('should use configured SSL setting in server-side environment', () => {
      // No window object (server-side)
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'true';
      const manager = new WebSocketManager(mockClient);
      
      const protocol = manager.getCurrentProtocol();
      expect(protocol).toBe('wss');
    });
  });

  describe('URL Construction', () => {
    it('should construct WS URL correctly', () => {
      const url = webSocketManager.getWebSocketUrl('localhost', '7350', false);
      expect(url).toBe('ws://localhost:7350/ws');
    });

    it('should construct WSS URL correctly', () => {
      const url = webSocketManager.getWebSocketUrl('localhost', '7350', true);
      expect(url).toBe('wss://localhost:7350/ws');
    });

    it('should handle Railway deployment URLs correctly', () => {
      const url = webSocketManager.getWebSocketUrl('myapp.railway.app', '7350', true);
      expect(url).toBe('wss://myapp.railway.app/ws');
    });

    it('should include port for non-Railway deployments with SSL', () => {
      const url = webSocketManager.getWebSocketUrl('example.com', '7350', true);
      expect(url).toBe('wss://example.com:7350/ws');
    });
  });

  describe('Connection Validation', () => {
    it('should validate successful WebSocket connection', async () => {
      const result = await webSocketManager.validateConnection('ws://localhost:7350/ws');
      
      expect(result.isValid).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should detect failed WebSocket connection', async () => {
      const result = await webSocketManager.validateConnection('ws://invalid:7350/ws');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should timeout on slow connections', async () => {
      // Mock a slow WebSocket that never connects
      const originalWebSocket = global.WebSocket;
      global.WebSocket = class SlowWebSocket {
        constructor(url: string) {
          this.url = url;
          // Never call onopen, onerror, or onclose to simulate timeout
        }
        close() {}
      } as any;

      const result = await webSocketManager.validateConnection('ws://slow:7350/ws', 100);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('timeout');
      
      // Restore original WebSocket
      global.WebSocket = originalWebSocket;
    });
  });

  describe('Secure Socket Creation', () => {
    it('should create socket with correct SSL setting based on page protocol', () => {
      // Mock HTTPS environment
      (global as any).window = {
        location: { protocol: 'https:' }
      };

      const mockSession = { user_id: 'test-user' } as Session;
      const socket = webSocketManager.createSecureSocket(mockSession);

      expect(mockClient.createSocket).toHaveBeenCalledWith(true, undefined, undefined);
      expect(socket).toBeDefined();
    });

    it('should track connection attempts', async () => {
      const mockSession = { user_id: 'test-user' } as Session;
      const socket = webSocketManager.createSecureSocket(mockSession);

      // Simulate successful connection
      await socket.connect(mockSession, true);

      const status = webSocketManager.getConnectionStatus();
      expect(status.attempts).toHaveLength(1);
      expect(status.attempts[0].success).toBe(true);
      expect(status.connected).toBe(true);
    });

    it('should track connection failures', async () => {
      const mockSession = { user_id: 'test-user' } as Session;
      mockSocket.connect.mockRejectedValue(new Error('Connection failed'));
      
      const socket = webSocketManager.createSecureSocket(mockSession);

      try {
        await socket.connect(mockSession, true);
      } catch (error) {
        // Expected to fail
      }

      const status = webSocketManager.getConnectionStatus();
      expect(status.attempts).toHaveLength(1);
      expect(status.attempts[0].success).toBe(false);
      expect(status.attempts[0].error).toBe('Connection failed');
      expect(status.connected).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should use default retry configuration', () => {
      const config = webSocketManager.getRetryConfig();
      
      expect(config.maxAttempts).toBe(3);
      expect(config.delays).toEqual([1000, 2000, 4000]);
      expect(config.protocols).toEqual(['wss', 'ws']);
    });

    it('should allow custom retry configuration', () => {
      const customConfig: Partial<RetryConfig> = {
        maxAttempts: 5,
        delays: [500, 1000],
      };
      
      const manager = new WebSocketManager(mockClient, customConfig);
      const config = manager.getRetryConfig();
      
      expect(config.maxAttempts).toBe(5);
      expect(config.delays).toEqual([500, 1000]);
      expect(config.protocols).toEqual(['wss', 'ws']); // Should keep default
    });

    it('should update retry configuration', () => {
      webSocketManager.updateRetryConfig({ maxAttempts: 2 });
      
      const config = webSocketManager.getRetryConfig();
      expect(config.maxAttempts).toBe(2);
    });

    it('should retry with different protocols on failure', async () => {
      const mockSession = { user_id: 'test-user' } as Session;
      
      // Mock validation to fail for WSS but succeed for WS
      const originalValidateConnection = webSocketManager.validateConnection;
      webSocketManager.validateConnection = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith('wss://')) {
          return Promise.resolve({ isValid: false, error: 'SSL error' });
        }
        return Promise.resolve({ isValid: true, responseTime: 100 });
      });

      // Mock successful connection on second attempt
      mockSocket.connect.mockResolvedValue(undefined);

      const socket = await webSocketManager.createSecureSocketWithRetry(mockSession);
      
      expect(socket).toBeDefined();
      expect(webSocketManager.validateConnection).toHaveBeenCalledTimes(2);
      
      // Restore original method
      webSocketManager.validateConnection = originalValidateConnection;
    });
  });

  describe('Connection Status Management', () => {
    it('should provide connection status', () => {
      const status = webSocketManager.getConnectionStatus();
      
      expect(status.connected).toBe(false);
      expect(status.protocol).toBe('');
      expect(status.attempts).toEqual([]);
      expect(status.lastError).toBeUndefined();
    });

    it('should clear connection history', () => {
      // Add some fake history
      const mockSession = { user_id: 'test-user' } as Session;
      webSocketManager.createSecureSocket(mockSession);
      
      let status = webSocketManager.getConnectionStatus();
      expect(status.attempts).toHaveLength(0); // No attempts until connect is called
      
      webSocketManager.clearConnectionHistory();
      
      status = webSocketManager.getConnectionStatus();
      expect(status.attempts).toEqual([]);
      expect(status.lastError).toBeUndefined();
    });

    it('should limit connection attempt history to 10 entries', async () => {
      const mockSession = { user_id: 'test-user' } as Session;
      mockSocket.connect.mockRejectedValue(new Error('Connection failed'));
      
      // Create 15 failed connection attempts
      for (let i = 0; i < 15; i++) {
        const socket = webSocketManager.createSecureSocket(mockSession);
        try {
          await socket.connect(mockSession, true);
        } catch (error) {
          // Expected to fail
        }
      }
      
      const status = webSocketManager.getConnectionStatus();
      expect(status.attempts).toHaveLength(10);
    });
  });
});