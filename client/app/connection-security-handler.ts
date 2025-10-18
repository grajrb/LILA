// client/app/connection-security-handler.ts

/**
 * ConnectionSecurityHandler enforces security policies for WebSocket connections
 * and handles Mixed Content Policy violations automatically.
 */
export class ConnectionSecurityHandler {
  
  /**
   * Validates WebSocket protocol compatibility with page protocol
   * @param pageProtocol - The protocol of the current page ('http:' or 'https:')
   * @param wsProtocol - The WebSocket protocol ('ws' or 'wss')
   * @returns true if protocols are compatible, false otherwise
   */
  public validateProtocol(pageProtocol: string, wsProtocol: string): boolean {
    // Normalize protocols
    const normalizedPageProtocol = pageProtocol.toLowerCase().replace(':', '');
    const normalizedWsProtocol = wsProtocol.toLowerCase();
    
    // HTTPS pages must use WSS to avoid Mixed Content Policy violations
    if (normalizedPageProtocol === 'https' && normalizedWsProtocol === 'ws') {
      console.warn('ConnectionSecurityHandler: Mixed Content Policy violation detected - HTTPS page cannot use WS protocol');
      return false;
    }
    
    // HTTP pages can use both WS and WSS
    if (normalizedPageProtocol === 'http') {
      return normalizedWsProtocol === 'ws' || normalizedWsProtocol === 'wss';
    }
    
    // HTTPS pages should use WSS
    if (normalizedPageProtocol === 'https') {
      return normalizedWsProtocol === 'wss';
    }
    
    // Unknown protocol, be conservative and reject
    console.warn(`ConnectionSecurityHandler: Unknown page protocol: ${pageProtocol}`);
    return false;
  }
  
  /**
   * Upgrades an insecure WebSocket URL to use secure protocol
   * @param url - The WebSocket URL to upgrade (ws:// -> wss://)
   * @returns The upgraded URL with wss:// protocol
   */
  public upgradeToSecure(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new Error('ConnectionSecurityHandler: Invalid URL provided for upgrade');
    }
    
    // Check if URL is already secure
    if (url.startsWith('wss://')) {
      console.log('ConnectionSecurityHandler: URL is already secure, no upgrade needed');
      return url;
    }
    
    // Upgrade ws:// to wss://
    if (url.startsWith('ws://')) {
      const upgradedUrl = url.replace('ws://', 'wss://');
      console.log(`ConnectionSecurityHandler: Upgraded URL from ${url} to ${upgradedUrl}`);
      return upgradedUrl;
    }
    
    // Handle URLs without protocol (assume ws:// and upgrade to wss://)
    if (url.startsWith('//')) {
      const upgradedUrl = 'wss:' + url;
      console.log(`ConnectionSecurityHandler: Added secure protocol to ${url} -> ${upgradedUrl}`);
      return upgradedUrl;
    }
    
    // If URL doesn't start with ws:// or wss://, assume it needs wss:// prefix
    if (!url.includes('://')) {
      const upgradedUrl = 'wss://' + url;
      console.log(`ConnectionSecurityHandler: Added secure protocol to ${url} -> ${upgradedUrl}`);
      return upgradedUrl;
    }
    
    // URL has different protocol, cannot upgrade
    throw new Error(`ConnectionSecurityHandler: Cannot upgrade URL with non-WebSocket protocol: ${url}`);
  }
  
  /**
   * Detects if an error is caused by Mixed Content Policy violation
   * @param error - The error to analyze
   * @returns true if error is related to Mixed Content Policy, false otherwise
   */
  public detectMixedContentViolation(error: Error): boolean {
    if (!error || !error.message) {
      return false;
    }
    
    const errorMessage = error.message.toLowerCase();
    
    // Common Mixed Content Policy error patterns
    const mixedContentPatterns = [
      'mixed content',
      'insecure websocket',
      'blocked loading mixed active content',
      'the page at https',
      'was not allowed to connect to ws://',
      'mixed active content',
      'https page cannot connect to ws',
      'websocket connection to \'ws://',
      'blocked by mixed content policy',
      'insecure websocket endpoint',
      'mixed content: the page at',
      'this request has been blocked'
    ];
    
    // Check if error message contains any Mixed Content Policy patterns
    const isMixedContentError = mixedContentPatterns.some(pattern => 
      errorMessage.includes(pattern)
    );
    
    if (isMixedContentError) {
      console.log('ConnectionSecurityHandler: Mixed Content Policy violation detected in error:', error.message);
      return true;
    }
    
    // Check error name for security-related errors
    if (error.name && error.name.toLowerCase().includes('security')) {
      console.log('ConnectionSecurityHandler: Security-related error detected:', error.name);
      return true;
    }
    
    return false;
  }
  
  /**
   * Automatically handles Mixed Content Policy violations by upgrading the connection
   * @param originalUrl - The original WebSocket URL that failed
   * @param error - The error that occurred
   * @returns Object with upgrade information and new URL
   */
  public handleMixedContentViolation(originalUrl: string, error: Error): {
    wasUpgraded: boolean;
    newUrl?: string;
    reason?: string;
  } {
    // First, verify this is actually a Mixed Content Policy violation
    if (!this.detectMixedContentViolation(error)) {
      return {
        wasUpgraded: false,
        reason: 'Error is not related to Mixed Content Policy'
      };
    }
    
    try {
      // Attempt to upgrade the URL to secure protocol
      const upgradedUrl = this.upgradeToSecure(originalUrl);
      
      console.log(`ConnectionSecurityHandler: Automatically upgraded connection due to Mixed Content Policy violation`);
      console.log(`   Original URL: ${originalUrl}`);
      console.log(`   Upgraded URL: ${upgradedUrl}`);
      
      return {
        wasUpgraded: true,
        newUrl: upgradedUrl,
        reason: 'Upgraded to secure protocol due to Mixed Content Policy violation'
      };
    } catch (upgradeError) {
      console.error('ConnectionSecurityHandler: Failed to upgrade URL:', upgradeError);
      return {
        wasUpgraded: false,
        reason: `Failed to upgrade URL: ${upgradeError instanceof Error ? upgradeError.message : String(upgradeError)}`
      };
    }
  }
  
  /**
   * Gets the current page protocol in a safe way
   * @returns The page protocol ('http:' or 'https:') or 'unknown' if not in browser
   */
  public getPageProtocol(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.protocol;
    }
    return 'unknown';
  }
  
  /**
   * Determines if the current environment requires secure connections
   * @returns true if secure connections are required, false otherwise
   */
  public requiresSecureConnection(): boolean {
    const pageProtocol = this.getPageProtocol();
    
    // HTTPS pages always require secure WebSocket connections
    if (pageProtocol === 'https:') {
      return true;
    }
    
    // Check if we're in a production environment that should force SSL
    const isProduction = process.env.NODE_ENV === 'production';
    const forceSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === 'true';
    
    // In production, prefer secure connections
    if (isProduction && forceSSL) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Validates and potentially upgrades a WebSocket URL based on current security context
   * @param url - The WebSocket URL to validate
   * @returns Object with validation result and potentially upgraded URL
   */
  public validateAndUpgradeUrl(url: string): {
    isValid: boolean;
    upgradedUrl?: string;
    reason?: string;
  } {
    const pageProtocol = this.getPageProtocol();
    
    // Extract WebSocket protocol from URL
    let wsProtocol: string;
    if (url.startsWith('wss://')) {
      wsProtocol = 'wss';
    } else if (url.startsWith('ws://')) {
      wsProtocol = 'ws';
    } else {
      return {
        isValid: false,
        reason: 'Invalid WebSocket URL format'
      };
    }
    
    // Check protocol compatibility
    const isCompatible = this.validateProtocol(pageProtocol, wsProtocol);
    
    if (isCompatible) {
      return {
        isValid: true,
        upgradedUrl: url,
        reason: 'URL is compatible with current page protocol'
      };
    }
    
    // If not compatible, try to upgrade
    try {
      const upgradedUrl = this.upgradeToSecure(url);
      return {
        isValid: true,
        upgradedUrl: upgradedUrl,
        reason: 'URL was upgraded to secure protocol for compatibility'
      };
    } catch (error) {
      return {
        isValid: false,
        reason: `Cannot upgrade URL: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}