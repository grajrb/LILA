// client/app/utils/EnvironmentConfig.ts

export interface WebSocketConfig {
  host: string;
  port: string;
  useSSL: boolean;
  protocol: 'ws' | 'wss';
}

export interface NakamaConfig extends WebSocketConfig {
  serverKey: string;
  timeout: number;
}

export class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: NakamaConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  /**
   * Load configuration from environment variables with Railway.app specific handling
   */
  private loadConfiguration(): NakamaConfig {
    const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1";
    const port = process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350";
    const serverKey = process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || "defaultkey";
    const useSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === "true";

    // Railway.app specific configuration adjustments
    const adjustedConfig = this.adjustForRailwayDeployment(host, port, useSSL);

    return {
      host: adjustedConfig.host,
      port: adjustedConfig.port,
      serverKey,
      useSSL: adjustedConfig.useSSL,
      protocol: adjustedConfig.protocol,
      timeout: 30000,
    };
  }

  /**
   * Adjust configuration for Railway.app deployments
   */
  private adjustForRailwayDeployment(host: string, port: string, useSSL: boolean): WebSocketConfig {
    const isRailwayDeployment = this.isRailwayDeployment(host);
    
    if (isRailwayDeployment) {
      // Railway.app uses standard HTTPS/WSS ports, no explicit port needed in URL
      return {
        host,
        port: useSSL ? "443" : "80",
        useSSL: true, // Force SSL for Railway deployments
        protocol: 'wss',
      };
    }

    return {
      host,
      port,
      useSSL,
      protocol: useSSL ? 'wss' : 'ws',
    };
  }

  /**
   * Detect if this is a Railway.app deployment
   */
  private isRailwayDeployment(host: string): boolean {
    return host.includes('.railway.app') || 
           host.includes('.up.railway.app') ||
           !!process.env.RAILWAY_ENVIRONMENT;
  }

  /**
   * Detect if running in production environment
   */
  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production' ||
           process.env.VERCEL_ENV === 'production' ||
           !!process.env.RAILWAY_ENVIRONMENT;
  }

  /**
   * Detect if running in development environment
   */
  public isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' && !this.isProduction();
  }

  /**
   * Determine if SSL should be forced based on deployment context
   */
  public shouldForceSSL(): boolean {
    // Always force SSL in production
    if (this.isProduction()) {
      return true;
    }

    // Force SSL for Railway deployments regardless of environment
    if (this.isRailwayDeployment(this.config.host)) {
      return true;
    }

    // In browser, force SSL if page is served over HTTPS (Mixed Content Policy)
    if (typeof window !== 'undefined') {
      return window.location.protocol === 'https:';
    }

    // Default to configured SSL setting
    return this.config.useSSL;
  }

  /**
   * Get the appropriate WebSocket protocol based on context
   */
  public getWebSocketProtocol(): 'ws' | 'wss' {
    return this.shouldForceSSL() ? 'wss' : 'ws';
  }

  /**
   * Get complete WebSocket configuration
   */
  public getWebSocketConfig(): WebSocketConfig {
    const shouldUseSSL = this.shouldForceSSL();
    
    return {
      host: this.config.host,
      port: this.config.port,
      useSSL: shouldUseSSL,
      protocol: shouldUseSSL ? 'wss' : 'ws',
    };
  }

  /**
   * Get complete Nakama configuration
   */
  public getNakamaConfig(): NakamaConfig {
    const wsConfig = this.getWebSocketConfig();
    
    return {
      ...wsConfig,
      serverKey: this.config.serverKey,
      timeout: this.config.timeout,
    };
  }

  /**
   * Get HTTP/HTTPS URL for REST API calls
   */
  public getHttpUrl(): string {
    const config = this.getWebSocketConfig();
    const protocol = config.useSSL ? 'https' : 'http';
    const portSuffix = this.shouldIncludePortInUrl() ? `:${config.port}` : '';
    
    return `${protocol}://${config.host}${portSuffix}`;
  }

  /**
   * Get WebSocket URL for connections
   */
  public getWebSocketUrl(): string {
    const config = this.getWebSocketConfig();
    const portSuffix = this.shouldIncludePortInUrl() ? `:${config.port}` : '';
    
    return `${config.protocol}://${config.host}${portSuffix}/ws`;
  }

  /**
   * Determine if port should be included in URLs
   */
  private shouldIncludePortInUrl(): boolean {
    const config = this.getWebSocketConfig();
    
    // Don't include port for Railway deployments using standard ports
    if (this.isRailwayDeployment(config.host)) {
      return false;
    }

    // Don't include standard ports (80 for HTTP, 443 for HTTPS)
    if ((config.useSSL && config.port === "443") || 
        (!config.useSSL && config.port === "80")) {
      return false;
    }

    return true;
  }

  /**
   * Validate configuration and provide helpful error messages
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate host
    if (!this.config.host || this.config.host.trim() === '') {
      errors.push('NEXT_PUBLIC_NAKAMA_HOST is required');
    }

    // Validate port
    if (!this.config.port || this.config.port.trim() === '') {
      errors.push('NEXT_PUBLIC_NAKAMA_PORT is required');
    } else {
      const portNum = parseInt(this.config.port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        errors.push(`Invalid port number: ${this.config.port}. Must be between 1 and 65535`);
      }
    }

    // Validate server key
    if (!this.config.serverKey || this.config.serverKey.trim() === '') {
      errors.push('NEXT_PUBLIC_NAKAMA_SERVER_KEY is required');
    } else if (this.config.serverKey === 'defaultkey' && this.isProduction() && typeof window !== 'undefined') {
      // Only validate in browser runtime, not during build
      errors.push('Using default server key in production is not secure. Please set a proper NEXT_PUBLIC_NAKAMA_SERVER_KEY');
    }

    // Validate SSL configuration for production
    if (this.isProduction() && !this.shouldForceSSL()) {
      errors.push('SSL must be enabled in production environments');
    }

    // Railway-specific validations
    if (this.isRailwayDeployment(this.config.host)) {
      if (!this.config.useSSL) {
        console.warn('⚠️  Railway deployment detected but SSL is disabled. SSL will be forced for security.');
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Nakama configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
      
      // Only throw errors in browser runtime, not during build
      if (this.isProduction() && typeof window !== 'undefined') {
        throw new Error(errorMessage);
      } else {
        console.error('❌ Configuration Errors:');
        errors.forEach(error => console.error(`  - ${error}`));
        console.log('🔧 Please check your environment variables and restart the application.');
      }
    }
  }

  /**
   * Get configuration summary for debugging
   */
  public getConfigSummary(): string {
    const config = this.getNakamaConfig();
    const wsUrl = this.getWebSocketUrl();
    const httpUrl = this.getHttpUrl();
    
    return [
      '🔧 Nakama Configuration Summary:',
      `   Environment: ${this.isProduction() ? 'Production' : 'Development'}`,
      `   Railway Deployment: ${this.isRailwayDeployment(config.host) ? 'Yes' : 'No'}`,
      `   Host: ${config.host}`,
      `   Port: ${config.port}`,
      `   SSL Forced: ${this.shouldForceSSL() ? 'Yes' : 'No'}`,
      `   WebSocket Protocol: ${config.protocol.toUpperCase()}`,
      `   HTTP URL: ${httpUrl}`,
      `   WebSocket URL: ${wsUrl}`,
      `   Server Key: ${config.serverKey.substring(0, 8)}...`,
    ].join('\n');
  }
}