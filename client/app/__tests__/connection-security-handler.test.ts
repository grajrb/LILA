// client/app/__tests__/connection-security-handler.test.ts
import { ConnectionSecurityHandler } from '../connection-security-handler';

describe('ConnectionSecurityHandler', () => {
  let handler: ConnectionSecurityHandler;

  beforeEach(() => {
    handler = new ConnectionSecurityHandler();
    
    // Clean up any existing window mock
    delete (global as any).window;
  });

  describe('validateProtocol', () => {
    it('should reject WS protocol on HTTPS pages', () => {
      const result = handler.validateProtocol('https:', 'ws');
      expect(result).toBe(false);
    });

    it('should accept WSS protocol on HTTPS pages', () => {
      const result = handler.validateProtocol('https:', 'wss');
      expect(result).toBe(true);
    });

    it('should accept WS protocol on HTTP pages', () => {
      const result = handler.validateProtocol('http:', 'ws');
      expect(result).toBe(true);
    });

    it('should accept WSS protocol on HTTP pages', () => {
      const result = handler.validateProtocol('http:', 'wss');
      expect(result).toBe(true);
    });

    it('should handle case-insensitive protocols', () => {
      expect(handler.validateProtocol('HTTPS:', 'WSS')).toBe(true);
      expect(handler.validateProtocol('HTTP:', 'WS')).toBe(true);
      expect(handler.validateProtocol('HTTPS:', 'WS')).toBe(false);
    });

    it('should reject unknown page protocols', () => {
      const result = handler.validateProtocol('ftp:', 'ws');
      expect(result).toBe(false);
    });

    it('should handle protocols with and without colons', () => {
      expect(handler.validateProtocol('https', 'wss')).toBe(true);
      expect(handler.validateProtocol('https:', 'wss')).toBe(true);
    });
  });

  describe('upgradeToSecure', () => {
    it('should upgrade ws:// URLs to wss://', () => {
      const result = handler.upgradeToSecure('ws://localhost:7350/ws');
      expect(result).toBe('wss://localhost:7350/ws');
    });

    it('should return wss:// URLs unchanged', () => {
      const url = 'wss://localhost:7350/ws';
      const result = handler.upgradeToSecure(url);
      expect(result).toBe(url);
    });

    it('should handle URLs without protocol prefix', () => {
      const result = handler.upgradeToSecure('//localhost:7350/ws');
      expect(result).toBe('wss://localhost:7350/ws');
    });

    it('should add wss:// to URLs without any protocol', () => {
      const result = handler.upgradeToSecure('localhost:7350/ws');
      expect(result).toBe('wss://localhost:7350/ws');
    });

    it('should throw error for invalid URLs', () => {
      expect(() => handler.upgradeToSecure('')).toThrow('Invalid URL provided');
      expect(() => handler.upgradeToSecure(null as any)).toThrow('Invalid URL provided');
    });

    it('should throw error for non-WebSocket protocols', () => {
      expect(() => handler.upgradeToSecure('http://localhost:8080')).toThrow('Cannot upgrade URL with non-WebSocket protocol');
      expect(() => handler.upgradeToSecure('https://localhost:8080')).toThrow('Cannot upgrade URL with non-WebSocket protocol');
    });
  });

  describe('detectMixedContentViolation', () => {
    it('should detect Mixed Content Policy errors', () => {
      const mixedContentError = new Error('Mixed Content: The page at https://example.com was not allowed to connect to ws://localhost:7350');
      expect(handler.detectMixedContentViolation(mixedContentError)).toBe(true);
    });

    it('should detect insecure WebSocket errors', () => {
      const insecureError = new Error('Insecure WebSocket connection blocked');
      expect(handler.detectMixedContentViolation(insecureError)).toBe(true);
    });

    it('should detect blocked mixed active content errors', () => {
      const blockedError = new Error('Blocked loading mixed active content');
      expect(handler.detectMixedContentViolation(blockedError)).toBe(true);
    });

    it('should detect WebSocket connection errors with ws:// URLs', () => {
      const wsError = new Error("WebSocket connection to 'ws://localhost:7350/ws' failed");
      expect(handler.detectMixedContentViolation(wsError)).toBe(true);
    });

    it('should detect security-related errors by name', () => {
      const securityError = new Error('Connection failed');
      securityError.name = 'SecurityError';
      expect(handler.detectMixedContentViolation(securityError)).toBe(true);
    });

    it('should not detect regular connection errors', () => {
      const regularError = new Error('Connection timeout');
      expect(handler.detectMixedContentViolation(regularError)).toBe(false);
    });

    it('should not detect network errors', () => {
      const networkError = new Error('Network error: ECONNREFUSED');
      expect(handler.detectMixedContentViolation(networkError)).toBe(false);
    });

    it('should handle errors without messages', () => {
      const emptyError = new Error('');
      expect(handler.detectMixedContentViolation(emptyError)).toBe(false);
    });

    it('should handle null/undefined errors', () => {
      expect(handler.detectMixedContentViolation(null as any)).toBe(false);
      expect(handler.detectMixedContentViolation(undefined as any)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const upperCaseError = new Error('MIXED CONTENT POLICY VIOLATION');
      expect(handler.detectMixedContentViolation(upperCaseError)).toBe(true);
    });
  });

  describe('handleMixedContentViolation', () => {
    it('should upgrade URL when Mixed Content Policy violation is detected', () => {
      const mixedContentError = new Error('Mixed Content: blocked ws:// connection');
      const result = handler.handleMixedContentViolation('ws://localhost:7350/ws', mixedContentError);
      
      expect(result.wasUpgraded).toBe(true);
      expect(result.newUrl).toBe('wss://localhost:7350/ws');
      expect(result.reason).toContain('Mixed Content Policy violation');
    });

    it('should not upgrade URL for non-Mixed Content errors', () => {
      const regularError = new Error('Connection timeout');
      const result = handler.handleMixedContentViolation('ws://localhost:7350/ws', regularError);
      
      expect(result.wasUpgraded).toBe(false);
      expect(result.newUrl).toBeUndefined();
      expect(result.reason).toContain('not related to Mixed Content Policy');
    });

    it('should handle upgrade failures gracefully', () => {
      const mixedContentError = new Error('Mixed Content Policy violation');
      const result = handler.handleMixedContentViolation('http://invalid-url', mixedContentError);
      
      expect(result.wasUpgraded).toBe(false);
      expect(result.newUrl).toBeUndefined();
      expect(result.reason).toContain('Failed to upgrade URL');
    });
  });

  describe('getPageProtocol', () => {
    it('should return page protocol when window is available', () => {
      (global as any).window = {
        location: { protocol: 'https:' }
      };
      
      const protocol = handler.getPageProtocol();
      expect(protocol).toBe('https:');
    });

    it('should return "unknown" when window is not available', () => {
      const protocol = handler.getPageProtocol();
      expect(protocol).toBe('unknown');
    });

    it('should handle missing location object', () => {
      (global as any).window = {};
      
      const protocol = handler.getPageProtocol();
      expect(protocol).toBe('unknown');
    });
  });

  describe('requiresSecureConnection', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should require secure connection for HTTPS pages', () => {
      (global as any).window = {
        location: { protocol: 'https:' }
      };
      
      const result = handler.requiresSecureConnection();
      expect(result).toBe(true);
    });

    it('should not require secure connection for HTTP pages in development', () => {
      (global as any).window = {
        location: { protocol: 'http:' }
      };
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';
      
      const result = handler.requiresSecureConnection();
      expect(result).toBe(false);
    });

    it('should require secure connection in production with SSL enabled', () => {
      (global as any).window = {
        location: { protocol: 'http:' }
      };
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'true';
      
      const result = handler.requiresSecureConnection();
      expect(result).toBe(true);
    });

    it('should not require secure connection in production with SSL disabled', () => {
      (global as any).window = {
        location: { protocol: 'http:' }
      };
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';
      
      const result = handler.requiresSecureConnection();
      expect(result).toBe(false);
    });
  });

  describe('validateAndUpgradeUrl', () => {
    it('should validate compatible URLs without upgrade', () => {
      (global as any).window = {
        location: { protocol: 'http:' }
      };
      
      const result = handler.validateAndUpgradeUrl('ws://localhost:7350/ws');
      expect(result.isValid).toBe(true);
      expect(result.upgradedUrl).toBe('ws://localhost:7350/ws');
      expect(result.reason).toContain('compatible');
    });

    it('should upgrade incompatible URLs', () => {
      (global as any).window = {
        location: { protocol: 'https:' }
      };
      
      const result = handler.validateAndUpgradeUrl('ws://localhost:7350/ws');
      expect(result.isValid).toBe(true);
      expect(result.upgradedUrl).toBe('wss://localhost:7350/ws');
      expect(result.reason).toContain('upgraded');
    });

    it('should reject invalid URL formats', () => {
      const result = handler.validateAndUpgradeUrl('http://localhost:8080');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Invalid WebSocket URL format');
    });

    it('should handle URLs that cannot be upgraded', () => {
      // Mock upgradeToSecure to throw an error
      const originalUpgrade = handler.upgradeToSecure;
      handler.upgradeToSecure = jest.fn().mockImplementation(() => {
        throw new Error('Cannot upgrade this URL');
      });
      
      (global as any).window = {
        location: { protocol: 'https:' }
      };
      
      const result = handler.validateAndUpgradeUrl('ws://localhost:7350/ws');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Cannot upgrade URL');
      
      // Restore original method
      handler.upgradeToSecure = originalUpgrade;
    });

    it('should handle wss:// URLs correctly', () => {
      (global as any).window = {
        location: { protocol: 'https:' }
      };
      
      const result = handler.validateAndUpgradeUrl('wss://localhost:7350/ws');
      expect(result.isValid).toBe(true);
      expect(result.upgradedUrl).toBe('wss://localhost:7350/ws');
    });
  });
});