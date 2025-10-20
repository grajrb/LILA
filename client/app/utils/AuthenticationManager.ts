// client/app/utils/AuthenticationManager.ts

import { Client, Session } from "@heroiclabs/nakama-js";
import { ServerKeyValidator, ValidationResult } from "./ServerKeyValidator";
import { EnvironmentConfig } from "./EnvironmentConfig";
import { AuthenticationErrorClassifier, AuthenticationErrorDetails, AuthenticationContext } from "./AuthenticationErrorClassifier";

export interface AuthenticationStatus {
  isAuthenticated: boolean;
  serverKeyValid: boolean;
  lastError?: string;
  attempts: number;
  lastAttemptTime?: Date;
  sessionExpiry?: Date;
}

export interface AuthenticationAttempt {
  timestamp: Date;
  success: boolean;
  error?: string;
  errorDetails?: AuthenticationErrorDetails;
  duration: number;
  serverKeyMasked: string;
}

export class AuthenticationManager {
  private static instance: AuthenticationManager;
  private client: Client;
  private serverKeyValidator: ServerKeyValidator;
  private environmentConfig: EnvironmentConfig;
  private currentSession?: Session;
  private authenticationStatus: AuthenticationStatus;
  private attemptHistory: AuthenticationAttempt[] = [];
  private maxRetries: number = 3;
  private retryDelay: number = 2000; // Base delay in milliseconds

  private constructor(client: Client) {
    this.client = client;
    this.serverKeyValidator = ServerKeyValidator.getInstance();
    this.environmentConfig = EnvironmentConfig.getInstance();
    this.authenticationStatus = {
      isAuthenticated: false,
      serverKeyValid: false,
      attempts: 0
    };
  }

  public static getInstance(client: Client): AuthenticationManager {
    if (!AuthenticationManager.instance) {
      AuthenticationManager.instance = new AuthenticationManager(client);
    }
    return AuthenticationManager.instance;
  }

  /**
   * Authenticate device with the Nakama server
   * @param deviceId Optional device ID, will generate one if not provided
   * @returns Promise<Session> The authentication session
   */
  public async authenticateDevice(deviceId?: string): Promise<Session> {
    const startTime = Date.now();
    this.authenticationStatus.attempts++;
    this.authenticationStatus.lastAttemptTime = new Date();

    try {
      // Diagnostic: manual raw fetch comparison before SDK call (only in browser)
      if (typeof window !== 'undefined' && (window as any).__nakama_diag_once !== true) {
        (window as any).__nakama_diag_once = true;
        try {
          const cfg = this.environmentConfig.getNakamaConfig();
          const idForDiag = (deviceId || this.generateDeviceId()).slice(0, 32);
          const composedKey = cfg.serverKey + ':';
          const base64 = btoa(composedKey);
          console.log('[🔍 RawAuthDiag] Testing manual fetch against /v2/account/authenticate/device with serverKey length', cfg.serverKey.length);
          const resp = await fetch(`${this.environmentConfig.getHttpUrl()}/v2/account/authenticate/device?create=true`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${base64}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: idForDiag })
          });
          const text = await resp.text();
          console.log('[🔍 RawAuthDiag] status:', resp.status, 'ok:', resp.ok, 'body snippet:', text.substring(0, 140));
          if (resp.status === 401) {
            console.warn('[🔍 RawAuthDiag] 401 with manual fetch. This strongly indicates server rejected provided serverKey.');
          } else if (resp.ok) {
            console.log('[🔍 RawAuthDiag] Manual fetch succeeded; mismatch may be in SDK usage or timing.');
          }
        } catch (diagErr) {
          console.warn('[🔍 RawAuthDiag] Diagnostic fetch threw error:', diagErr);
        }
      }
      // Validate server key before attempting authentication
      const keyValidation = await this.validateServerKey();
      if (!keyValidation) {
        throw new Error('Server key validation failed - cannot proceed with authentication');
      }

      // Generate device ID if not provided
      const finalDeviceId = deviceId || this.generateDeviceId();
      
      console.log(`🔐 Attempting device authentication (attempt ${this.authenticationStatus.attempts})`);
      console.log(`   Device ID: ${finalDeviceId.substring(0, 8)}...`);
      console.log(`   Server Key: ${this.serverKeyValidator.maskKey(this.environmentConfig.getNakamaConfig().serverKey)}`);

      // Attempt authentication
      const session = await this.client.authenticateDevice(finalDeviceId, true);
      
      // Authentication successful
      this.currentSession = session;
      this.authenticationStatus.isAuthenticated = true;
      this.authenticationStatus.lastError = undefined;
      // Some versions/types may have expires_at undefined; guard it
      if (typeof (session as any).expires_at === 'number') {
        this.authenticationStatus.sessionExpiry = new Date((session as any).expires_at * 1000);
      }

      const duration = Date.now() - startTime;
      this.recordAttempt(true, undefined, duration);

      console.log('✅ Device authentication successful');
      console.log(`   User ID: ${session.user_id}`);
      console.log(`   Session expires: ${this.authenticationStatus.sessionExpiry?.toISOString()}`);

      return session;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Classify the authentication error
  const castError: Error = error instanceof Error ? error : new Error(String(error));
  const errorDetails = this.classifyAuthenticationError(castError);
      
      this.authenticationStatus.isAuthenticated = false;
      this.authenticationStatus.lastError = errorMessage;
      
      this.recordAttempt(false, errorMessage, duration, errorDetails);

      // Log user-friendly and developer messages
      console.error('❌ Device authentication failed:', errorDetails.userMessage);
      console.error('🔧 Technical details:', errorDetails.developerMessage);
      
      if (errorDetails.suggestedActions.length > 0) {
        console.log('💡 Suggested actions:');
        errorDetails.suggestedActions.forEach((action, index) => {
          console.log(`   ${index + 1}. ${action}`);
        });
      }
      
      // Re-throw the error for caller to handle
      throw error;
    }
  }

  /**
   * Validate server key configuration before authentication
   * @returns Promise<boolean> True if server key is valid
   */
  public async validateServerKey(): Promise<boolean> {
    try {
      const config = this.environmentConfig.getNakamaConfig();
      const validation = this.serverKeyValidator.validateKey(config.serverKey);
      
      this.authenticationStatus.serverKeyValid = validation.isValid;
      
      if (!validation.isValid) {
        console.error('🔐 Server key validation failed:', validation.error);
        if (validation.recommendation) {
          console.log('💡 Recommendation:', validation.recommendation);
        }
        return false;
      }

      console.log('🔐 Server key validation passed');
      return true;

    } catch (error) {
      console.error('🔐 Server key validation error:', error);
      this.authenticationStatus.serverKeyValid = false;
      return false;
    }
  }

  /**
   * Get current authentication status
   * @returns AuthenticationStatus Current status information
   */
  public getAuthenticationStatus(): AuthenticationStatus {
    // Update session validity if we have a session
    if (this.currentSession) {
      const now = Date.now() / 1000;
  const expiresAt = (this.currentSession as any).expires_at;
  const isExpired = typeof expiresAt === 'number' ? now >= expiresAt : false;
      
      if (isExpired && this.authenticationStatus.isAuthenticated) {
        console.log('⚠️ Session has expired');
        this.authenticationStatus.isAuthenticated = false;
        this.authenticationStatus.lastError = 'Session expired';
        this.currentSession = undefined;
      }
    }

    return { ...this.authenticationStatus };
  }

  /**
   * Retry authentication with intelligent retry logic
   * @param maxAttempts Maximum number of retry attempts
   * @param deviceId Optional device ID to use for authentication
   * @returns Promise<Session> The authentication session
   */
  public async retryAuthentication(maxAttempts: number = this.maxRetries, deviceId?: string): Promise<Session> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Add delay between retries (exponential backoff)
        if (attempt > 0) {
          const delay = this.calculateRetryDelay(attempt);
          console.log(`⏳ Waiting ${delay}ms before retry attempt ${attempt + 1}/${maxAttempts}`);
          await this.sleep(delay);
        }

        console.log(`🔄 Retry attempt ${attempt + 1}/${maxAttempts}`);
        
        // Reset attempt counter for this retry cycle
        if (attempt === 0) {
          this.authenticationStatus.attempts = 0;
        }

        const session = await this.authenticateDevice(deviceId);
        console.log(`✅ Authentication successful on retry attempt ${attempt + 1}`);
        return session;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Retry attempt ${attempt + 1}/${maxAttempts} failed:`, lastError.message);

        // Classify the error to determine if we should continue retrying
        const errorDetails = this.classifyAuthenticationError(lastError);
        
        if (!AuthenticationErrorClassifier.shouldRetry(errorDetails, attempt + 1)) {
          console.error(`🚫 Error type '${errorDetails.type}' is not retryable - stopping retry attempts`);
          console.error('💡 Suggested actions:');
          errorDetails.suggestedActions.forEach((action, index) => {
            console.error(`   ${index + 1}. ${action}`);
          });
          throw new Error(`${errorDetails.type} error: ${lastError.message}`);
        }

        // If this is the last attempt, throw the error
        if (attempt === maxAttempts - 1) {
          throw new Error(`Authentication failed after ${maxAttempts} attempts: ${lastError.message}`);
        }
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Authentication retry failed for unknown reason');
  }

  /**
   * Get current session if authenticated
   * @returns Session | undefined Current session or undefined if not authenticated
   */
  public getCurrentSession(): Session | undefined {
    return this.currentSession;
  }

  /**
   * Check if currently authenticated and session is valid
   * @returns boolean True if authenticated with valid session
   */
  public isAuthenticated(): boolean {
    if (!this.currentSession) {
      return false;
    }

    const now = Date.now() / 1000;
  const expiresAt = (this.currentSession as any).expires_at;
  return typeof expiresAt === 'number' ? now < expiresAt : false;
  }

  /**
   * Clear current session and reset authentication status
   */
  public clearSession(): void {
    this.currentSession = undefined;
    this.authenticationStatus.isAuthenticated = false;
    this.authenticationStatus.sessionExpiry = undefined;
    console.log('🔓 Session cleared');
  }

  /**
   * Get authentication attempt history for debugging
   * @returns AuthenticationAttempt[] Recent authentication attempts
   */
  public getAttemptHistory(): AuthenticationAttempt[] {
    return [...this.attemptHistory].slice(-10); // Return last 10 attempts
  }

  /**
   * Generate a unique device ID for authentication
   * @returns string Generated device ID
   */
  private generateDeviceId(): string {
    // Try to get existing device ID from localStorage
    if (typeof window !== 'undefined') {
      const existingId = localStorage.getItem('nakama_device_id');
      if (existingId) {
        return existingId;
      }
    }

    // Generate new device ID
    const deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
    
    // Store in localStorage for future use
    if (typeof window !== 'undefined') {
      localStorage.setItem('nakama_device_id', deviceId);
    }

    return deviceId;
  }

  /**
   * Record authentication attempt for history tracking
   * @param success Whether the attempt was successful
   * @param error Error message if failed
   * @param duration Duration of the attempt in milliseconds
   * @param errorDetails Classified error details if failed
   */
  private recordAttempt(success: boolean, error?: string, duration: number = 0, errorDetails?: AuthenticationErrorDetails): void {
    const config = this.environmentConfig.getNakamaConfig();
    const attempt: AuthenticationAttempt = {
      timestamp: new Date(),
      success,
      error,
      errorDetails,
      duration,
      serverKeyMasked: this.serverKeyValidator.maskKey(config.serverKey)
    };

    this.attemptHistory.push(attempt);
    
    // Keep only last 20 attempts to prevent memory issues
    if (this.attemptHistory.length > 20) {
      this.attemptHistory = this.attemptHistory.slice(-20);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param attemptNumber Current attempt number (0-based)
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attemptNumber: number): number {
    // Exponential backoff: base delay * 2^attempt with some jitter
    const exponentialDelay = this.retryDelay * Math.pow(2, attemptNumber);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const maxDelay = 30000; // Cap at 30 seconds
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   * @param ms Milliseconds to sleep
   * @returns Promise that resolves after the delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set maximum retry attempts (for testing/configuration)
   * @param maxRetries Maximum number of retry attempts
   */
  public setMaxRetries(maxRetries: number): void {
    this.maxRetries = Math.max(1, Math.min(maxRetries, 10)); // Limit between 1 and 10
  }

  /**
   * Set base retry delay (for testing/configuration)
   * @param delay Base delay in milliseconds
   */
  public setRetryDelay(delay: number): void {
    this.retryDelay = Math.max(100, Math.min(delay, 10000)); // Limit between 100ms and 10s
  }

  /**
   * Classify authentication error using the error classifier
   * @param error The error to classify
   * @returns AuthenticationErrorDetails with classification and guidance
   */
  private classifyAuthenticationError(error: Error | string): AuthenticationErrorDetails {
    const config = this.environmentConfig.getNakamaConfig();
    
    const context: AuthenticationContext = {
      serverKeyMasked: this.serverKeyValidator.maskKey(config.serverKey),
      host: config.host,
      port: config.port,
      useSSL: config.useSSL,
      environment: this.environmentConfig.isProduction() ? 'production' : 'development',
      attemptNumber: this.authenticationStatus.attempts
    };

    return AuthenticationErrorClassifier.classifyAuthenticationError(error, context);
  }

  /**
   * Get user-friendly error message for the last authentication error
   * @returns String message suitable for display to end users
   */
  public getLastErrorUserMessage(): string | undefined {
    const lastAttempt = this.attemptHistory[this.attemptHistory.length - 1];
    if (!lastAttempt || lastAttempt.success || !lastAttempt.errorDetails) {
      return undefined;
    }

    return AuthenticationErrorClassifier.getUserFriendlyMessage(lastAttempt.errorDetails);
  }

  /**
   * Get developer-focused error message for the last authentication error
   * @returns String message with technical details
   */
  public getLastErrorDeveloperMessage(): string | undefined {
    const lastAttempt = this.attemptHistory[this.attemptHistory.length - 1];
    if (!lastAttempt || lastAttempt.success || !lastAttempt.errorDetails) {
      return undefined;
    }

    return AuthenticationErrorClassifier.getDeveloperMessage(lastAttempt.errorDetails);
  }

  /**
   * Get suggested actions for resolving the last authentication error
   * @returns Array of suggested action strings
   */
  public getLastErrorSuggestedActions(): string[] {
    const lastAttempt = this.attemptHistory[this.attemptHistory.length - 1];
    if (!lastAttempt || lastAttempt.success || !lastAttempt.errorDetails) {
      return [];
    }

    return AuthenticationErrorClassifier.getSuggestedActions(lastAttempt.errorDetails);
  }
}