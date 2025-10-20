// client/app/utils/AuthenticationErrorClassifier.ts

export interface AuthenticationErrorDetails {
  type: 'server_key_mismatch' | 'network_error' | 'server_unavailable' | 'session_expired' | 'invalid_device' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  developerMessage: string;
  retryable: boolean;
  suggestedActions: string[];
  httpStatus?: number;
  originalError: string;
}

export interface AuthenticationContext {
  serverKeyMasked: string;
  host: string;
  port: string;
  useSSL: boolean;
  environment: 'development' | 'production';
  attemptNumber: number;
}

export class AuthenticationErrorClassifier {
  
  /**
   * Classify authentication error and provide detailed information
   * @param error The error that occurred during authentication
   * @param context Authentication context information
   * @returns AuthenticationErrorDetails with classification and guidance
   */
  public static classifyAuthenticationError(
    error: Error | string, 
    context: AuthenticationContext
  ): AuthenticationErrorDetails {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorString = typeof error === 'string' ? error : error.toString();
    const lowerErrorMessage = errorMessage.toLowerCase();
    
    // Extract HTTP status if available
    const httpStatus = this.extractHttpStatus(error);
    
    // Server key mismatch detection
    if (this.isServerKeyMismatch(lowerErrorMessage, httpStatus)) {
      return this.createServerKeyMismatchError(errorMessage, context, httpStatus);
    }
    
    // Session expired
    if (this.isSessionExpired(lowerErrorMessage, httpStatus)) {
      return this.createSessionExpiredError(errorMessage, context, httpStatus);
    }
    
    // Network connectivity issues
    if (this.isNetworkError(lowerErrorMessage)) {
      return this.createNetworkError(errorMessage, context);
    }
    
    // Server unavailable
    if (this.isServerUnavailable(lowerErrorMessage, httpStatus)) {
      return this.createServerUnavailableError(errorMessage, context, httpStatus);
    }
    
    // Invalid device ID
    if (this.isInvalidDevice(lowerErrorMessage, httpStatus)) {
      return this.createInvalidDeviceError(errorMessage, context, httpStatus);
    }
    
    // Unknown error
    return this.createUnknownError(errorMessage, context, httpStatus);
  }

  /**
   * Get user-friendly error message for display in UI
   * @param errorDetails The classified error details
   * @returns String message suitable for end users
   */
  public static getUserFriendlyMessage(errorDetails: AuthenticationErrorDetails): string {
    return errorDetails.userMessage;
  }

  /**
   * Get developer-focused error message for debugging
   * @param errorDetails The classified error details
   * @returns String message with technical details
   */
  public static getDeveloperMessage(errorDetails: AuthenticationErrorDetails): string {
    return errorDetails.developerMessage;
  }

  /**
   * Get suggested actions for resolving the error
   * @param errorDetails The classified error details
   * @returns Array of suggested action strings
   */
  public static getSuggestedActions(errorDetails: AuthenticationErrorDetails): string[] {
    return errorDetails.suggestedActions;
  }

  /**
   * Determine if error should trigger automatic retry
   * @param errorDetails The classified error details
   * @param maxAttempts Maximum allowed attempts
   * @returns Boolean indicating if retry should be attempted
   */
  public static shouldRetry(errorDetails: AuthenticationErrorDetails, maxAttempts: number): boolean {
    if (!errorDetails.retryable) {
      return false;
    }

    // Don't retry server key mismatches - they need manual intervention
    if (errorDetails.type === 'server_key_mismatch') {
      return false;
    }

    // Don't retry invalid device errors - they need new device ID
    if (errorDetails.type === 'invalid_device') {
      return false;
    }

    // Check attempt limits based on error type
    const maxRetriesForType = this.getMaxRetriesForErrorType(errorDetails.type);
    return maxAttempts <= maxRetriesForType;
  }

  /**
   * Get retry delay based on error type and attempt number
   * @param errorDetails The classified error details
   * @param attemptNumber Current attempt number (0-based)
   * @returns Delay in milliseconds
   */
  public static getRetryDelay(errorDetails: AuthenticationErrorDetails, attemptNumber: number): number {
    const baseDelays = {
      server_key_mismatch: [0], // No retry
      network_error: [2000, 5000, 10000],
      server_unavailable: [3000, 8000, 15000],
      session_expired: [1000, 2000, 4000],
      invalid_device: [0], // No retry
      unknown: [2000, 4000, 8000]
    };

    const delays = baseDelays[errorDetails.type] || baseDelays.unknown;
    const delayIndex = Math.min(attemptNumber, delays.length - 1);
    
    return delays[delayIndex];
  }

  // Private helper methods for error detection

  private static isServerKeyMismatch(errorMessage: string, httpStatus?: number): boolean {
    const keyMismatchPatterns = [
      'unauthorized',
      'authentication failed',
      'invalid server key',
      'server key mismatch',
      'invalid credentials',
      'access denied',
      'forbidden',
      'authentication error'
    ];

    const hasKeyMismatchPattern = keyMismatchPatterns.some(pattern => 
      errorMessage.includes(pattern)
    );

    // HTTP 401 or 403 often indicates authentication issues
    const hasAuthStatus = httpStatus === 401 || httpStatus === 403;

    return hasKeyMismatchPattern || hasAuthStatus;
  }

  private static isSessionExpired(errorMessage: string, httpStatus?: number): boolean {
    const sessionPatterns = [
      'session expired',
      'token expired',
      'session invalid',
      'session not found'
    ];

    return sessionPatterns.some(pattern => errorMessage.includes(pattern));
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
      'offline',
      'fetch'
    ];

    return networkPatterns.some(pattern => errorMessage.includes(pattern));
  }

  private static isServerUnavailable(errorMessage: string, httpStatus?: number): boolean {
    const serverPatterns = [
      'internal server error',
      'service unavailable',
      'bad gateway',
      'gateway timeout',
      'server error'
    ];

    const hasServerPattern = serverPatterns.some(pattern => errorMessage.includes(pattern));
    const hasServerStatus = httpStatus && httpStatus >= 500;

    return hasServerPattern || !!hasServerStatus;
  }

  private static isInvalidDevice(errorMessage: string, httpStatus?: number): boolean {
    const devicePatterns = [
      'invalid device',
      'device not found',
      'device id invalid',
      'bad device'
    ];

    return devicePatterns.some(pattern => errorMessage.includes(pattern));
  }

  private static extractHttpStatus(error: Error | string): number | undefined {
    if (typeof error === 'string') {
      // Try to extract status from string
      const statusMatch = error.match(/\b(4\d{2}|5\d{2})\b/);
      return statusMatch ? parseInt(statusMatch[1], 10) : undefined;
    }

    // Check if error object has status property
    if ('status' in error) {
      return (error as any).status;
    }

    // Check if error object has response with status
    if ('response' in error && error.response && 'status' in error.response) {
      return (error.response as any).status;
    }

    return undefined;
  }

  private static getMaxRetriesForErrorType(errorType: AuthenticationErrorDetails['type']): number {
    const maxRetries = {
      server_key_mismatch: 0, // No retry
      network_error: 3,
      server_unavailable: 3,
      session_expired: 2,
      invalid_device: 0, // No retry
      unknown: 2
    };

    return maxRetries[errorType] || 2;
  }

  // Error creation methods

  private static createServerKeyMismatchError(
    originalError: string,
    context: AuthenticationContext,
    httpStatus?: number
  ): AuthenticationErrorDetails {
    const isProduction = context.environment === 'production';
    
    return {
      type: 'server_key_mismatch',
      severity: 'critical',
      userMessage: '🔐 Authentication Error: There is a configuration issue preventing connection to the server. Please contact support if this continues.',
      developerMessage: `Server key mismatch detected. Client key: ${context.serverKeyMasked}, Server rejected authentication with ${httpStatus || 'unknown'} status.`,
      retryable: false,
      suggestedActions: [
        'Verify NEXT_PUBLIC_NAKAMA_SERVER_KEY environment variable matches server configuration',
        'Check Railway backend environment variables',
        'Ensure Vercel frontend environment variables are correct',
        'Verify server key is not using default/insecure values',
        isProduction ? 'Contact system administrator' : 'Check local .env.local file'
      ],
      httpStatus,
      originalError
    };
  }

  private static createSessionExpiredError(
    originalError: string,
    context: AuthenticationContext,
    httpStatus?: number
  ): AuthenticationErrorDetails {
    return {
      type: 'session_expired',
      severity: 'medium',
      userMessage: '🔄 Your session has expired. Please wait while we reconnect you.',
      developerMessage: `Authentication session expired. Attempting to refresh session.`,
      retryable: true,
      suggestedActions: [
        'Automatically retry authentication with new session',
        'Clear stored session data',
        'Generate new device authentication'
      ],
      httpStatus,
      originalError
    };
  }

  private static createNetworkError(
    originalError: string,
    context: AuthenticationContext
  ): AuthenticationErrorDetails {
    const isProduction = context.environment === 'production';
    
    return {
      type: 'network_error',
      severity: 'high',
      userMessage: '🌐 Connection Error: Unable to reach the server. Please check your internet connection and try again.',
      developerMessage: `Network connectivity issue connecting to ${context.host}:${context.port} (SSL: ${context.useSSL})`,
      retryable: true,
      suggestedActions: [
        'Check internet connection',
        'Verify server is running and accessible',
        isProduction ? 'Check Railway deployment status' : 'Ensure local Nakama server is running',
        'Verify firewall settings',
        'Check DNS resolution'
      ],
      originalError
    };
  }

  private static createServerUnavailableError(
    originalError: string,
    context: AuthenticationContext,
    httpStatus?: number
  ): AuthenticationErrorDetails {
    const isProduction = context.environment === 'production';
    
    return {
      type: 'server_unavailable',
      severity: 'high',
      userMessage: '🔧 Server Error: The game server is temporarily unavailable. Please try again in a few moments.',
      developerMessage: `Nakama server returned ${httpStatus || 'error'} status. Server may be starting up or experiencing issues.`,
      retryable: true,
      suggestedActions: [
        'Wait a few moments and retry',
        isProduction ? 'Check Railway service logs' : 'Check local server logs',
        'Verify server configuration',
        'Check server resource usage',
        'Contact server administrator if issue persists'
      ],
      httpStatus,
      originalError
    };
  }

  private static createInvalidDeviceError(
    originalError: string,
    context: AuthenticationContext,
    httpStatus?: number
  ): AuthenticationErrorDetails {
    return {
      type: 'invalid_device',
      severity: 'medium',
      userMessage: '📱 Device Error: There was an issue with your device registration. Please wait while we fix this.',
      developerMessage: `Device ID validation failed. May need to generate new device ID.`,
      retryable: false, // Requires new device ID generation
      suggestedActions: [
        'Generate new device ID',
        'Clear stored device data',
        'Retry authentication with fresh device ID'
      ],
      httpStatus,
      originalError
    };
  }

  private static createUnknownError(
    originalError: string,
    context: AuthenticationContext,
    httpStatus?: number
  ): AuthenticationErrorDetails {
    return {
      type: 'unknown',
      severity: 'medium',
      userMessage: '❓ Unexpected Error: Something went wrong during authentication. Please try again.',
      developerMessage: `Unclassified authentication error: ${originalError}`,
      retryable: true,
      suggestedActions: [
        'Retry authentication',
        'Check browser console for additional details',
        'Verify all environment variables are set',
        'Contact support if error persists'
      ],
      httpStatus,
      originalError
    };
  }
}