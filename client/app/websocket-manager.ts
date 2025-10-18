// client/app/websocket-manager.ts
import { Client, Socket, Session, WebSocketAdapter } from "@heroiclabs/nakama-js";

export interface WebSocketConfig {
  host: string;
  port: string;
  useSSL: boolean;
  protocol: 'ws' | 'wss';
}

export interface ConnectionAttempt {
  url: string;
  protocol: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  protocol: string;
  attempts: ConnectionAttempt[];
  lastError?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  delays: number[];
  protocols: ('wss' | 'ws')[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * WebSocketManager handles secure WebSocket connections with automatic protocol selection
 * based on page context and environment configuration.
 */
export class WebSocketManager {
  private client: Client;
  private connectionStatus: ConnectionStatus;
  private retryConfig: RetryConfig;

  constructor(client: Client, retryConfig?: Partial<RetryConfig>) {
    this.client = client;
    this.connectionStatus = {
      connected: false,
      protocol: '',
      attempts: [],
      lastError: undefined
    };
    
    // Default retry configuration with exponential backoff
    this.retryConfig = {
      maxAttempts: 3,
      delays: [1000, 2000, 4000], // 1s, 2s, 4s
      protocols: ['wss', 'ws'], // Try secure first, fallback to insecure in dev
      ...retryConfig
    };
  }

  /**
   * Detects the appropriate WebSocket protocol based on page context
   * @returns true if WSS should be used, false for WS
   */
  private detectWebSocketProtocol(): boolean {
    // If we're in a browser environment
    if (typeof window !== 'undefined') {
      // Check if the page is served over HTTPS
      const isPageHTTPS = window.location.protocol === 'https:';
      
      // If page is HTTPS, we must use WSS to avoid Mixed Content Policy violations
      if (isPageHTTPS) {
        console.log('WebSocketManager: Page served over HTTPS, forcing WSS for WebSocket connections');
        return true;
      }
      
      // If page is HTTP, check environment configuration
      const envUseSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === "true";
      console.log(`WebSocketManager: Page served over HTTP, using configured SSL setting: ${envUseSSL}`);
      return envUseSSL;
    }
    
    // Server-side rendering or non-browser environment, use configured setting
    const envUseSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === "true";
    return envUseSSL;
  }

  /**
   * Constructs WebSocket URL with appropriate protocol
   * @param host - The server host
   * @param port - The server port
   * @param forceSSL - Optional parameter to force SSL (overrides detection)
   * @returns Complete WebSocket URL
   */
  public getWebSocketUrl(host: string, port: string, forceSSL?: boolean): string {
    const shouldUseSSL = forceSSL !== undefined ? forceSSL : this.detectWebSocketProtocol();
    const protocol = shouldUseSSL ? 'wss' : 'ws';
    
    // For Railway deployments, don't include port in URL when using SSL
    const isRailwayDeployment = host.includes('.railway.app');
    const portSuffix = (shouldUseSSL && isRailwayDeployment) ? '' : `:${port}`;
    
    const url = `${protocol}://${host}${portSuffix}/ws`;
    
    console.log(`WebSocketManager: Constructed WebSocket URL: ${url}`);
    return url;
  }

  /**
   * Creates a secure WebSocket connection with automatic protocol selection
   * @param session - The authenticated session
   * @param verboseLogging - Enable verbose logging
   * @param adapter - Optional WebSocket adapter
   * @returns Socket instance with secure connection
   */
  public createSecureSocket(session: Session, verboseLogging?: boolean, adapter?: WebSocketAdapter): Socket {
    // Always use the detected WebSocket protocol based on page context
    const shouldUseSSL = this.detectWebSocketProtocol();
    const protocol = shouldUseSSL ? 'wss' : 'ws';
    
    // Get connection details for logging
    const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1";
    const port = process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350";
    const wsUrl = this.getWebSocketUrl(host, port, shouldUseSSL);
    
    console.log(`WebSocketManager: Creating secure WebSocket connection:`);
    console.log(`   - Page Protocol: ${typeof window !== 'undefined' ? window.location.protocol : 'server-side'}`);
    console.log(`   - WebSocket Protocol: ${protocol.toUpperCase()} (${shouldUseSSL ? 'Secure' : 'Insecure'})`);
    console.log(`   - WebSocket URL: ${wsUrl}`);
    
    // Record connection attempt
    const attempt: ConnectionAttempt = {
      url: wsUrl,
      protocol: protocol,
      timestamp: new Date(),
      success: false
    };
    
    try {
      // Create socket with the correct SSL setting
      const socket = this.client.createSocket(shouldUseSSL, verboseLogging, adapter);
      
      // Enhance socket with connection tracking
      const originalConnect = socket.connect.bind(socket);
      socket.connect = async (session: Session, createStatus: boolean = false) => {
        try {
          const result = await originalConnect(session, createStatus);
          
          // Update connection status on successful connection
          attempt.success = true;
          this.connectionStatus.connected = true;
          this.connectionStatus.protocol = protocol;
          this.connectionStatus.lastError = undefined;
          
          console.log('✅ WebSocketManager: Socket connected successfully');
          return result;
        } catch (error) {
          // Update connection status on failure
          attempt.error = error instanceof Error ? error.message : String(error);
          this.connectionStatus.connected = false;
          this.connectionStatus.lastError = attempt.error;
          
          console.error('❌ WebSocketManager: Socket connection failed:', error);
          throw error;
        } finally {
          // Always record the attempt
          this.connectionStatus.attempts.push(attempt);
          
          // Keep only last 10 attempts to prevent memory leaks
          if (this.connectionStatus.attempts.length > 10) {
            this.connectionStatus.attempts = this.connectionStatus.attempts.slice(-10);
          }
        }
      };
      
      // Track disconnections
      const originalOnDisconnect = socket.ondisconnect;
      socket.ondisconnect = (event) => {
        this.connectionStatus.connected = false;
        console.log('WebSocketManager: Socket disconnected');
        
        if (originalOnDisconnect) {
          originalOnDisconnect(event);
        }
      };
      
      return socket;
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      this.connectionStatus.attempts.push(attempt);
      
      console.error('❌ WebSocketManager: Failed to create socket:', error);
      throw error;
    }
  }

  /**
   * Gets the current connection status
   * @returns ConnectionStatus object with connection details
   */
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Gets the current WebSocket protocol that would be used
   * @returns 'wss' or 'ws'
   */
  public getCurrentProtocol(): 'wss' | 'ws' {
    return this.detectWebSocketProtocol() ? 'wss' : 'ws';
  }

  /**
   * Validates a WebSocket connection by testing the URL
   * @param url - The WebSocket URL to validate
   * @param timeout - Timeout in milliseconds (default: 5000)
   * @returns Promise<ValidationResult> with validation details
   */
  public async validateConnection(url: string, timeout: number = 5000): Promise<ValidationResult> {
    const startTime = Date.now();
    
    return new Promise<ValidationResult>((resolve) => {
      try {
        // Create a test WebSocket connection
        const testSocket = new WebSocket(url);
        let resolved = false;
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            testSocket.close();
            resolve({
              isValid: false,
              error: `Connection timeout after ${timeout}ms`,
              responseTime: Date.now() - startTime
            });
          }
        }, timeout);
        
        testSocket.onopen = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            testSocket.close();
            resolve({
              isValid: true,
              responseTime: Date.now() - startTime
            });
          }
        };
        
        testSocket.onerror = (error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            testSocket.close();
            resolve({
              isValid: false,
              error: `WebSocket error: ${error}`,
              responseTime: Date.now() - startTime
            });
          }
        };
        
        testSocket.onclose = (event) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({
              isValid: false,
              error: `WebSocket closed: ${event.code} - ${event.reason}`,
              responseTime: Date.now() - startTime
            });
          }
        };
        
      } catch (error) {
        resolve({
          isValid: false,
          error: `Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`,
          responseTime: Date.now() - startTime
        });
      }
    });
  }

  /**
   * Creates a secure WebSocket connection with retry logic and validation
   * @param session - The authenticated session
   * @param verboseLogging - Enable verbose logging
   * @param adapter - Optional WebSocket adapter
   * @returns Promise<Socket> with established connection
   */
  public async createSecureSocketWithRetry(
    session: Session, 
    verboseLogging?: boolean, 
    adapter?: WebSocketAdapter
  ): Promise<Socket> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        // Determine which protocol to try for this attempt
        const protocolIndex = Math.min(attempt, this.retryConfig.protocols.length - 1);
        const forceProtocol = this.retryConfig.protocols[protocolIndex];
        const shouldUseSSL = forceProtocol === 'wss';
        
        console.log(`WebSocketManager: Connection attempt ${attempt + 1}/${this.retryConfig.maxAttempts} using ${forceProtocol.toUpperCase()}`);
        
        // Get connection details
        const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1";
        const port = process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350";
        const wsUrl = this.getWebSocketUrl(host, port, shouldUseSSL);
        
        // Validate connection before attempting to use it
        console.log(`WebSocketManager: Validating connection to ${wsUrl}`);
        const validation = await this.validateConnection(wsUrl, 3000);
        
        if (!validation.isValid) {
          console.warn(`WebSocketManager: Validation failed for ${wsUrl}: ${validation.error}`);
          
          // If this is not the last attempt, try the next protocol
          if (attempt < this.retryConfig.maxAttempts - 1) {
            const delay = this.retryConfig.delays[Math.min(attempt, this.retryConfig.delays.length - 1)];
            console.log(`WebSocketManager: Retrying in ${delay}ms with different protocol`);
            await this.sleep(delay);
            continue;
          } else {
            throw new Error(`Connection validation failed: ${validation.error}`);
          }
        }
        
        console.log(`WebSocketManager: Validation successful (${validation.responseTime}ms), creating socket`);
        
        // Create socket with validated settings
        const socket = this.createSecureSocket(session, verboseLogging, adapter);
        
        // Attempt to connect
        await socket.connect(session, true);
        
        console.log(`✅ WebSocketManager: Successfully connected on attempt ${attempt + 1}`);
        return socket;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ WebSocketManager: Attempt ${attempt + 1} failed:`, lastError.message);
        
        // If this is not the last attempt, wait before retrying
        if (attempt < this.retryConfig.maxAttempts - 1) {
          const delay = this.retryConfig.delays[Math.min(attempt, this.retryConfig.delays.length - 1)];
          console.log(`WebSocketManager: Retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    // All attempts failed
    const finalError = new Error(
      `Failed to establish WebSocket connection after ${this.retryConfig.maxAttempts} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
    
    this.connectionStatus.lastError = finalError.message;
    throw finalError;
  }

  /**
   * Utility method to sleep for a specified duration
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after the specified time
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets retry configuration
   * @returns Current retry configuration
   */
  public getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Updates retry configuration
   * @param config - Partial retry configuration to update
   */
  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Clears connection history (useful for testing or debugging)
   */
  public clearConnectionHistory(): void {
    this.connectionStatus.attempts = [];
    this.connectionStatus.lastError = undefined;
  }
}