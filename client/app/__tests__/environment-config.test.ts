// client/app/__tests__/environment-config.test.ts

import { EnvironmentConfig } from '../utils/EnvironmentConfig';

// Mock environment variables
const mockEnv = (env: Record<string, string | undefined>) => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...env };
  return () => {
    process.env = originalEnv;
  };
};

// Mock window.location
const mockLocation = (protocol: string) => {
  const originalLocation = global.window?.location;
  Object.defineProperty(global.window, 'location', {
    value: { protocol },
    writable: true,
  });
  return () => {
    if (originalLocation) {
      Object.defineProperty(global.window, 'location', {
        value: originalLocation,
        writable: true,
      });
    }
  };
};

describe('EnvironmentConfig', () => {
  let restoreEnv: () => void;
  let restoreLocation: () => void;

  beforeEach(() => {
    // Reset singleton instance
    (EnvironmentConfig as any).instance = undefined;
    
    // Default environment setup
    restoreEnv = mockEnv({
      NEXT_PUBLIC_NAKAMA_HOST: '127.0.0.1',
      NEXT_PUBLIC_NAKAMA_PORT: '7350',
      NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'testkey',
      NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
      NODE_ENV: 'development',
    });
  });

  afterEach(() => {
    restoreEnv();
    if (restoreLocation) {
      restoreLocation();
    }
  });

  describe('Environment Detection', () => {
    it('should detect development environment correctly', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'development',
        NEXT_PUBLIC_NAKAMA_HOST: '127.0.0.1',
        NEXT_PUBLIC_NAKAMA_PORT: '7350',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'testkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
      });

      const config = EnvironmentConfig.getInstance();
      expect(config.isDevelopment()).toBe(true);
      expect(config.isProduction()).toBe(false);
    });

    it('should detect production environment correctly', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_NAKAMA_HOST: 'lila-backend.up.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'prodkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      expect(config.isProduction()).toBe(true);
      expect(config.isDevelopment()).toBe(false);
    });

    it('should detect Railway environment from RAILWAY_ENVIRONMENT', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        RAILWAY_ENVIRONMENT: 'production',
        NEXT_PUBLIC_NAKAMA_HOST: 'test.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'railwaykey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      expect(config.isProduction()).toBe(true);
    });

    it('should detect Vercel production environment', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_NAKAMA_HOST: 'lila-backend.up.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'vercelkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      expect(config.isProduction()).toBe(true);
    });
  });

  describe('Railway.app Detection', () => {
    it('should detect Railway.app deployment from host URL', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NEXT_PUBLIC_NAKAMA_HOST: 'lila-backend.up.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'railwaykey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      const wsConfig = config.getWebSocketConfig();
      
      // Railway deployments should force SSL
      expect(wsConfig.useSSL).toBe(true);
      expect(wsConfig.protocol).toBe('wss');
    });

    it('should detect Railway.app deployment from .railway.app domain', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NEXT_PUBLIC_NAKAMA_HOST: 'myapp.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '80',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'railwaykey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
      });

      const config = EnvironmentConfig.getInstance();
      const wsConfig = config.getWebSocketConfig();
      
      // Should force SSL even if configured as false
      expect(wsConfig.useSSL).toBe(true);
      expect(wsConfig.protocol).toBe('wss');
    });

    it('should adjust port for Railway deployments', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NEXT_PUBLIC_NAKAMA_HOST: 'lila-backend.up.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '7350',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'railwaykey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      const nakamaConfig = config.getNakamaConfig();
      
      // Railway should use standard HTTPS port
      expect(nakamaConfig.port).toBe('443');
    });
  });

  describe('SSL Configuration', () => {
    it('should force SSL in production', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_NAKAMA_HOST: 'production.example.com',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'prodkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'false', // Even if configured as false
      });

      const config = EnvironmentConfig.getInstance();
      expect(config.shouldForceSSL()).toBe(true);
      expect(config.getWebSocketProtocol()).toBe('wss');
    });

    it('should force SSL when page is served over HTTPS', () => {
      restoreLocation = mockLocation('https:');
      
      const config = EnvironmentConfig.getInstance();
      expect(config.shouldForceSSL()).toBe(true);
      expect(config.getWebSocketProtocol()).toBe('wss');
    });

    it('should allow insecure connections in development over HTTP', () => {
      restoreLocation = mockLocation('http:');
      
      const config = EnvironmentConfig.getInstance();
      expect(config.shouldForceSSL()).toBe(false);
      expect(config.getWebSocketProtocol()).toBe('ws');
    });

    it('should use configured SSL setting when no forcing conditions apply', () => {
      // Mock to simulate server-side rendering (no window object)
      const originalWindow = global.window;
      delete (global as any).window;
      
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'development',
        NEXT_PUBLIC_NAKAMA_HOST: '127.0.0.1', // Not a Railway deployment
        NEXT_PUBLIC_NAKAMA_PORT: '7350',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'testkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      expect(config.shouldForceSSL()).toBe(true);
      expect(config.getWebSocketProtocol()).toBe('wss');
      
      // Restore window
      global.window = originalWindow;
    });
  });

  describe('URL Generation', () => {
    it('should generate correct HTTP URL for development', () => {
      const config = EnvironmentConfig.getInstance();
      const httpUrl = config.getHttpUrl();
      
      expect(httpUrl).toBe('http://127.0.0.1:7350');
    });

    it('should generate correct WebSocket URL for development', () => {
      const config = EnvironmentConfig.getInstance();
      const wsUrl = config.getWebSocketUrl();
      
      expect(wsUrl).toBe('ws://127.0.0.1:7350/ws');
    });

    it('should generate correct URLs for Railway deployment', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NEXT_PUBLIC_NAKAMA_HOST: 'lila-backend.up.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'railwaykey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      const httpUrl = config.getHttpUrl();
      const wsUrl = config.getWebSocketUrl();
      
      // Should not include port for Railway deployments
      expect(httpUrl).toBe('https://lila-backend.up.railway.app');
      expect(wsUrl).toBe('wss://lila-backend.up.railway.app/ws');
    });

    it('should not include standard ports in URLs', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'production', // Force production to enable SSL
        NEXT_PUBLIC_NAKAMA_HOST: 'example.com',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'testkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      const config = EnvironmentConfig.getInstance();
      const httpUrl = config.getHttpUrl();
      const wsUrl = config.getWebSocketUrl();
      
      expect(httpUrl).toBe('https://example.com');
      expect(wsUrl).toBe('wss://example.com/ws');
    });

    it('should include non-standard ports in URLs', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NEXT_PUBLIC_NAKAMA_HOST: 'example.com',
        NEXT_PUBLIC_NAKAMA_PORT: '8080',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'testkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
      });

      const config = EnvironmentConfig.getInstance();
      const httpUrl = config.getHttpUrl();
      const wsUrl = config.getWebSocketUrl();
      
      expect(httpUrl).toBe('http://example.com:8080');
      expect(wsUrl).toBe('ws://example.com:8080/ws');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required environment variables', () => {
      // Test with invalid port to trigger validation error
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'development',
        NEXT_PUBLIC_NAKAMA_HOST: '127.0.0.1',
        NEXT_PUBLIC_NAKAMA_PORT: 'invalid-port', // This will trigger validation error
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'testkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
      });

      // Should not throw in development, but log errors
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => EnvironmentConfig.getInstance()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should throw validation errors in production', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'production',
        // Missing required variables
      });

      expect(() => EnvironmentConfig.getInstance()).toThrow();
    });

    it('should validate port numbers', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'development',
        NEXT_PUBLIC_NAKAMA_HOST: '127.0.0.1',
        NEXT_PUBLIC_NAKAMA_PORT: 'invalid',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'testkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      EnvironmentConfig.getInstance();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid port number')
      );
      
      consoleSpy.mockRestore();
    });

    it('should warn about default server key in production', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_NAKAMA_HOST: 'production.example.com',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'defaultkey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
      });

      expect(() => EnvironmentConfig.getInstance()).toThrow(
        /Using default server key in production/
      );
    });
  });

  describe('Configuration Summary', () => {
    it('should generate comprehensive configuration summary', () => {
      const config = EnvironmentConfig.getInstance();
      const summary = config.getConfigSummary();
      
      expect(summary).toContain('Nakama Configuration Summary');
      expect(summary).toContain('Environment: Development');
      expect(summary).toContain('Railway Deployment: No');
      expect(summary).toContain('Host: 127.0.0.1');
      expect(summary).toContain('Port: 7350');
      expect(summary).toContain('WebSocket Protocol: WS');
      expect(summary).toContain('HTTP URL: http://127.0.0.1:7350');
      expect(summary).toContain('WebSocket URL: ws://127.0.0.1:7350/ws');
    });

    it('should show Railway deployment in summary', () => {
      restoreEnv();
      restoreEnv = mockEnv({
        NEXT_PUBLIC_NAKAMA_HOST: 'lila-backend.up.railway.app',
        NEXT_PUBLIC_NAKAMA_PORT: '443',
        NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'railwaykey',
        NEXT_PUBLIC_NAKAMA_USE_SSL: 'true',
        NODE_ENV: 'production',
      });

      const config = EnvironmentConfig.getInstance();
      const summary = config.getConfigSummary();
      
      expect(summary).toContain('Environment: Production');
      expect(summary).toContain('Railway Deployment: Yes');
      expect(summary).toContain('WebSocket Protocol: WSS');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const config1 = EnvironmentConfig.getInstance();
      const config2 = EnvironmentConfig.getInstance();
      
      expect(config1).toBe(config2);
    });
  });
});