// client/app/utils/error-classifier.ts

export interface ErrorClassification {
  type: 'security' | 'network' | 'authentication' | 'server' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  technicalMessage: string;
  retryable: boolean;
  suggestedAction?: string;
}

export interface ConnectionError {
  originalError: Error | string;
  context: 'websocket' | 'authentication' | 'matchmaking' | 'general';
  timestamp: Date;
  url?: string;
  protocol?: string;
}

/**
 * ErrorClassifier categorizes and provides user-friendly messages for different types of errors
 */
export class ErrorClassifier {
  
  /**
   * Classifies an error and provides appropriate user feedback
   * @param connectionError - The error details to classify
   * @returns ErrorClassification with user-friendly information
   */
  public static classifyError(connectionError: ConnectionError): ErrorClassification {
    const { originalError, context, url, protocol } = connectionError;
    
    // Handle null/undefined errors
    if (!originalError) {
      return this.createUnknownErrorClassification('Unknown error occurred');
    }
    
    const errorMessage = typeof originalError === 'string' 
      ? originalError 
      : (originalError.message !== undefined ? originalError.message : originalError.toString());
    
    const lowerErrorMessage = errorMessage.toLowerCase();
    
    // Security-related errors (Mixed Content Policy, SSL issues)
    if (this.isSecurityError(lowerErrorMessage)) {
      return this.createSecurityErrorClassification(errorMessage, url, protocol);
    }
    
    // Network connectivity errors
    if (this.isNetworkError(lowerErrorMessage)) {
      return this.createNetworkErrorClassification(errorMessage, context);
    }
    
    // Authentication errors
    if (this.isAuthenticationError(lowerErrorMessage)) {
      return this.createAuthenticationErrorClassification(errorMessage);
    }
    
    // Server errors
    if (this.isServerError(lowerErrorMessage)) {
      return this.createServerErrorClassification(errorMessage);
    }
    
    // WebSocket specific errors
    if (context === 'websocket' && this.isWebSocketError(lowerErrorMessage)) {
      return this.createWebSocketErrorClassification(errorMessage);
    }
    
    // Unknown/generic errors
    return this.createUnknownErrorClassification(errorMessage);
  }
  
  private static isSecurityError(errorMessage: string): boolean {
    const securityPatterns = [
      'mixed content',
      'insecure websocket',
      'blocked loading mixed active content',
      'https page cannot connect to ws',
      'websocket connection to \'ws://',
      'blocked by mixed content policy',
      'ssl',
      'tls',
      'certificate',
      'security',
      'cors'
    ];
    
    return securityPatterns.some(pattern => errorMessage.includes(pattern));
  }
  
  private static isNetworkError(errorMessage: string): boolean {
    const networkPatterns = [
      'network error',
      'connection refused',
      'connection timeout',
      'timeout',
      'unreachable',
      'dns',
      'host not found',
      'connection reset',
      'connection aborted',
      'no internet',
      'offline'
    ];
    
    return networkPatterns.some(pattern => errorMessage.includes(pattern));
  }
  
  private static isAuthenticationError(errorMessage: string): boolean {
    const authPatterns = [
      'authentication',
      'unauthorized',
      'invalid credentials',
      'login failed',
      'access denied',
      'forbidden',
      'invalid token',
      'session expired'
    ];
    
    return authPatterns.some(pattern => errorMessage.includes(pattern));
  }
  
  private static isServerError(errorMessage: string): boolean {
    const serverPatterns = [
      'internal server error',
      'service unavailable',
      'bad gateway',
      'gateway timeout',
      '500',
      '502',
      '503',
      '504',
      'server error'
    ];
    
    return serverPatterns.some(pattern => errorMessage.includes(pattern));
  }
  
  private static isWebSocketError(errorMessage: string): boolean {
    const wsPatterns = [
      'websocket',
      'ws connection',
      'socket',
      'connection closed',
      'handshake',
      'upgrade'
    ];
    
    return wsPatterns.some(pattern => errorMessage.includes(pattern));
  }
  
  private static createSecurityErrorClassification(
    errorMessage: string, 
    url?: string, 
    protocol?: string
  ): ErrorClassification {
    const isMixedContent = errorMessage.toLowerCase().includes('mixed content');
    
    if (isMixedContent) {
      return {
        type: 'security',
        severity: 'high',
        userMessage: '🔒 Security Error: Cannot connect using insecure WebSocket from a secure page. The connection will be automatically upgraded to use secure protocol.',
        technicalMessage: `Mixed Content Policy violation: ${errorMessage}`,
        retryable: true,
        suggestedAction: 'The app will automatically retry with a secure connection (WSS). If the problem persists, please check your network settings.'
      };
    }
    
    return {
      type: 'security',
      severity: 'high',
      userMessage: '🔒 Security Error: There was a security issue with the connection. Please ensure you\'re using a secure connection.',
      technicalMessage: errorMessage,
      retryable: true,
      suggestedAction: 'Try refreshing the page or check if your browser has security restrictions enabled.'
    };
  }
  
  private static createNetworkErrorClassification(
    errorMessage: string, 
    context: string
  ): ErrorClassification {
    const isTimeout = errorMessage.includes('timeout');
    const isConnectionRefused = errorMessage.includes('refused');
    
    if (isTimeout) {
      return {
        type: 'network',
        severity: 'medium',
        userMessage: '⏱️ Connection Timeout: The server is taking too long to respond. This might be a temporary network issue.',
        technicalMessage: errorMessage,
        retryable: true,
        suggestedAction: 'Check your internet connection and try again. If the problem persists, the server might be experiencing high load.'
      };
    }
    
    if (isConnectionRefused) {
      return {
        type: 'network',
        severity: 'high',
        userMessage: '🚫 Connection Refused: Unable to connect to the game server. The server might be down or unreachable.',
        technicalMessage: errorMessage,
        retryable: true,
        suggestedAction: 'Please try again in a few moments. If the issue continues, the server might be down or under maintenance.'
      };
    }
    
    return {
      type: 'network',
      severity: 'medium',
      userMessage: '🌐 Network Error: There was a problem connecting to the server. Please check your internet connection.',
      technicalMessage: errorMessage,
      retryable: true,
      suggestedAction: 'Verify your internet connection is stable and try again.'
    };
  }
  
  private static createAuthenticationErrorClassification(errorMessage: string): ErrorClassification {
    return {
      type: 'authentication',
      severity: 'medium',
      userMessage: '🔑 Authentication Error: There was a problem verifying your identity with the server.',
      technicalMessage: errorMessage,
      retryable: true,
      suggestedAction: 'Try refreshing the page to get a new authentication token.'
    };
  }
  
  private static createServerErrorClassification(errorMessage: string): ErrorClassification {
    return {
      type: 'server',
      severity: 'high',
      userMessage: '🔧 Server Error: The game server is experiencing technical difficulties.',
      technicalMessage: errorMessage,
      retryable: true,
      suggestedAction: 'The server team has been notified. Please try again in a few minutes.'
    };
  }
  
  private static createWebSocketErrorClassification(errorMessage: string): ErrorClassification {
    return {
      type: 'network',
      severity: 'medium',
      userMessage: '🔌 Connection Error: There was a problem establishing the real-time connection.',
      technicalMessage: errorMessage,
      retryable: true,
      suggestedAction: 'The app will automatically retry the connection. If problems persist, try refreshing the page.'
    };
  }
  
  private static createUnknownErrorClassification(errorMessage: string): ErrorClassification {
    return {
      type: 'unknown',
      severity: 'medium',
      userMessage: '❓ Unexpected Error: Something went wrong. Please try again.',
      technicalMessage: errorMessage,
      retryable: true,
      suggestedAction: 'If this error continues to occur, please refresh the page or contact support.'
    };
  }
  
  /**
   * Gets a retry delay based on error type and attempt number
   * @param errorType - The type of error
   * @param attemptNumber - The current attempt number (0-based)
   * @returns Delay in milliseconds
   */
  public static getRetryDelay(errorType: ErrorClassification['type'], attemptNumber: number): number {
    const baseDelays = {
      security: [1000, 2000, 4000], // Quick retry for security upgrades
      network: [2000, 5000, 10000], // Longer delays for network issues
      authentication: [1000, 3000, 6000], // Medium delays for auth issues
      server: [3000, 8000, 15000], // Longer delays for server issues
      unknown: [2000, 4000, 8000] // Standard exponential backoff
    };
    
    const delays = baseDelays[errorType] || baseDelays.unknown;
    const delayIndex = Math.min(attemptNumber, delays.length - 1);
    
    return delays[delayIndex];
  }
  
  /**
   * Determines if an error should trigger an automatic retry
   * @param classification - The error classification
   * @param attemptNumber - The current attempt number (0-based)
   * @returns true if should retry, false otherwise
   */
  public static shouldRetry(classification: ErrorClassification, attemptNumber: number): boolean {
    const maxRetries = {
      security: 2, // Quick retry for protocol upgrades
      network: 3, // Standard retries for network issues
      authentication: 2, // Limited retries for auth issues
      server: 3, // Standard retries for server issues
      unknown: 2 // Conservative retries for unknown issues
    };
    
    const maxRetriesForType = maxRetries[classification.type] || maxRetries.unknown;
    
    return classification.retryable && attemptNumber < maxRetriesForType;
  }
}