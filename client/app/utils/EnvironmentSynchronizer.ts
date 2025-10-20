// client/app/utils/EnvironmentSynchronizer.ts

export interface EnvironmentConfig {
  name: string;
  serverKey: string; // masked
  host: string;
  port: string;
  useSSL: boolean;
  environment?: string;
  deployment?: string;
}

export interface SyncStatus {
  inSync: boolean;
  missingVariables: string[];
  mismatchedVariables: string[];
  environments: EnvironmentConfig[];
  lastCheck: Date;
}

export interface SyncReport {
  status: SyncStatus;
  recommendations: string[];
  criticalIssues: string[];
  warnings: string[];
  configurationGuide: string[];
}

export interface ValidationResult {
  isValid: boolean;
  variable: string;
  error?: string;
  recommendation?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ServerKeyConsistencyCheck {
  isConsistent: boolean;
  clientKey: string; // masked
  serverKeyPresent: boolean;
  environments: {
    name: string;
    keyMatch: boolean;
    keyPresent: boolean;
  }[];
  recommendations: string[];
}

export interface EnvironmentValidationReport {
  environment: string;
  isValid: boolean;
  validationResults: ValidationResult[];
  serverKeyConsistency: ServerKeyConsistencyCheck;
  missingVariables: string[];
  malformedVariables: string[];
  environmentSpecificIssues: string[];
  recommendations: string[];
}

export class EnvironmentSynchronizer {
  private static instance: EnvironmentSynchronizer;
  private lastSyncCheck?: Date;
  private cachedSyncStatus?: SyncStatus;
  private requiredVariables = [
    'NEXT_PUBLIC_NAKAMA_HOST',
    'NEXT_PUBLIC_NAKAMA_PORT', 
    'NEXT_PUBLIC_NAKAMA_SERVER_KEY',
    'NEXT_PUBLIC_NAKAMA_USE_SSL'
  ];

  private constructor() {}

  public static getInstance(): EnvironmentSynchronizer {
    if (!EnvironmentSynchronizer.instance) {
      EnvironmentSynchronizer.instance = new EnvironmentSynchronizer();
    }
    return EnvironmentSynchronizer.instance;
  }

  /**
   * Check environment synchronization between Railway and Vercel configurations
   */
  public async checkEnvironmentSync(): Promise<SyncStatus> {
    const currentTime = new Date();
    
    // Get current environment configuration
    const currentEnv = this.getCurrentEnvironmentConfig();
    
    // Detect environment type and get expected configurations
    const environments = [currentEnv];
    
    // Check for missing variables
    const missingVariables = this.findMissingVariables();
    
    // Check for mismatched variables (comparing against expected values)
    const mismatchedVariables = this.findMismatchedVariables();
    
    const syncStatus: SyncStatus = {
      inSync: missingVariables.length === 0 && mismatchedVariables.length === 0,
      missingVariables,
      mismatchedVariables,
      environments,
      lastCheck: currentTime
    };

    this.lastSyncCheck = currentTime;
    this.cachedSyncStatus = syncStatus;
    
    return syncStatus;
  }

  /**
   * Get environment configuration for a specific environment
   */
  public getEnvironmentConfig(environment: string): EnvironmentConfig {
    const config = this.getCurrentEnvironmentConfig();
    
    // Return current config with specified environment name
    return {
      ...config,
      name: environment,
      environment
    };
  }

  /**
   * Validate that all required environment variables are present
   */
  public validateRequiredVariables(): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    for (const variable of this.requiredVariables) {
      const value = process.env[variable];
      const result = this.validateSingleVariable(variable, value);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Generate comprehensive synchronization report
   */
  public generateSyncReport(): SyncReport {
    const status = this.cachedSyncStatus || this.createDefaultSyncStatus();
    const validationResults = this.validateRequiredVariables();
    
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const configurationGuide: string[] = [];

    // Analyze validation results
    for (const result of validationResults) {
      if (!result.isValid) {
        if (result.severity === 'error') {
          criticalIssues.push(`${result.variable}: ${result.error}`);
          if (result.recommendation) {
            recommendations.push(result.recommendation);
          }
        } else if (result.severity === 'warning') {
          warnings.push(`${result.variable}: ${result.error}`);
        }
      }
    }

    // Add missing variable recommendations
    for (const missing of status.missingVariables) {
      recommendations.push(`Set ${missing} environment variable`);
      configurationGuide.push(this.getVariableConfigurationGuide(missing));
    }

    // Add mismatch recommendations
    for (const mismatched of status.mismatchedVariables) {
      recommendations.push(`Verify ${mismatched} consistency across environments`);
      configurationGuide.push(this.getVariableConfigurationGuide(mismatched));
    }

    // Add general configuration guidance
    if (!status.inSync) {
      configurationGuide.push(
        'For Railway deployment: Set environment variables in Railway dashboard',
        'For Vercel deployment: Set environment variables in Vercel project settings',
        'Ensure NAKAMA_SERVER_KEY matches between client and server configurations'
      );
    }

    return {
      status,
      recommendations,
      criticalIssues,
      warnings,
      configurationGuide
    };
  }

  /**
   * Get current environment configuration
   */
  private getCurrentEnvironmentConfig(): EnvironmentConfig {
    const serverKey = process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || '';
    const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || '';
    const port = process.env.NEXT_PUBLIC_NAKAMA_PORT || '';
    const useSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === 'true';
    
    // Determine environment type
    const isRailway = host.includes('.railway.app') || !!process.env.RAILWAY_ENVIRONMENT;
    const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
    const isProduction = process.env.NODE_ENV === 'production';
    
    let environmentName = 'local';
    let deployment = 'local';
    
    if (isRailway) {
      environmentName = 'railway';
      deployment = 'railway';
    } else if (isVercel) {
      environmentName = 'vercel';
      deployment = 'vercel';
    }
    
    if (isProduction) {
      environmentName += '-production';
    }

    return {
      name: environmentName,
      serverKey: this.maskServerKey(serverKey),
      host,
      port,
      useSSL,
      environment: isProduction ? 'production' : 'development',
      deployment
    };
  }

  /**
   * Find missing required environment variables
   */
  private findMissingVariables(): string[] {
    const missing: string[] = [];
    
    for (const variable of this.requiredVariables) {
      const value = process.env[variable];
      if (!value || value.trim() === '') {
        missing.push(variable);
      }
    }
    
    return missing;
  }

  /**
   * Find mismatched environment variables
   */
  private findMismatchedVariables(): string[] {
    const mismatched: string[] = [];
    
    // Check for common misconfigurations
    const serverKey = process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;
    const host = process.env.NEXT_PUBLIC_NAKAMA_HOST;
    const useSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL;
    
    // Check if using default/placeholder values
    if (serverKey === 'defaultkey' || serverKey === 'your-server-key-here') {
      mismatched.push('NEXT_PUBLIC_NAKAMA_SERVER_KEY');
    }
    
    if (host === 'localhost' && process.env.NODE_ENV === 'production') {
      mismatched.push('NEXT_PUBLIC_NAKAMA_HOST');
    }
    
    // Check SSL configuration consistency
    const isRailwayHost = host?.includes('.railway.app');
    if (isRailwayHost && useSSL !== 'true') {
      mismatched.push('NEXT_PUBLIC_NAKAMA_USE_SSL');
    }
    
    return mismatched;
  }

  /**
   * Validate a single environment variable
   */
  private validateSingleVariable(variable: string, value: string | undefined): ValidationResult {
    if (!value || value.trim() === '') {
      return {
        isValid: false,
        variable,
        error: 'Variable is missing or empty',
        recommendation: `Set ${variable} environment variable`,
        severity: 'error'
      };
    }

    // Variable-specific validations
    switch (variable) {
      case 'NEXT_PUBLIC_NAKAMA_SERVER_KEY':
        return this.validateServerKey(variable, value);
      case 'NEXT_PUBLIC_NAKAMA_HOST':
        return this.validateHost(variable, value);
      case 'NEXT_PUBLIC_NAKAMA_PORT':
        return this.validatePort(variable, value);
      case 'NEXT_PUBLIC_NAKAMA_USE_SSL':
        return this.validateSSL(variable, value);
      default:
        return {
          isValid: true,
          variable,
          severity: 'info'
        };
    }
  }

  /**
   * Validate server key configuration
   */
  private validateServerKey(variable: string, value: string): ValidationResult {
    if (value === 'defaultkey' || value === 'your-server-key-here') {
      return {
        isValid: false,
        variable,
        error: 'Using default or placeholder server key',
        recommendation: 'Set a secure server key that matches your Nakama server configuration',
        severity: process.env.NODE_ENV === 'production' ? 'error' : 'warning'
      };
    }

    if (value.length < 8) {
      return {
        isValid: false,
        variable,
        error: 'Server key is too short',
        recommendation: 'Use a server key with at least 8 characters',
        severity: 'warning'
      };
    }

    return {
      isValid: true,
      variable,
      severity: 'info'
    };
  }

  /**
   * Validate host configuration
   */
  private validateHost(variable: string, value: string): ValidationResult {
    if (value === 'localhost' && process.env.NODE_ENV === 'production') {
      return {
        isValid: false,
        variable,
        error: 'Using localhost in production environment',
        recommendation: 'Set production host URL (e.g., your-app.railway.app)',
        severity: 'error'
      };
    }

    // Basic URL validation
    try {
      new URL(`http://${value}`);
    } catch {
      return {
        isValid: false,
        variable,
        error: 'Invalid host format',
        recommendation: 'Use a valid hostname or IP address',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      variable,
      severity: 'info'
    };
  }

  /**
   * Validate port configuration
   */
  private validatePort(variable: string, value: string): ValidationResult {
    const port = parseInt(value, 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      return {
        isValid: false,
        variable,
        error: 'Invalid port number',
        recommendation: 'Use a valid port number between 1 and 65535',
        severity: 'error'
      };
    }

    return {
      isValid: true,
      variable,
      severity: 'info'
    };
  }

  /**
   * Validate SSL configuration
   */
  private validateSSL(variable: string, value: string): ValidationResult {
    if (value !== 'true' && value !== 'false') {
      return {
        isValid: false,
        variable,
        error: 'SSL setting must be "true" or "false"',
        recommendation: 'Set NEXT_PUBLIC_NAKAMA_USE_SSL to "true" or "false"',
        severity: 'error'
      };
    }

    // Check if SSL should be forced for certain deployments
    const host = process.env.NEXT_PUBLIC_NAKAMA_HOST;
    if (host?.includes('.railway.app') && value !== 'true') {
      return {
        isValid: false,
        variable,
        error: 'SSL should be enabled for Railway deployments',
        recommendation: 'Set NEXT_PUBLIC_NAKAMA_USE_SSL to "true" for Railway deployments',
        severity: 'warning'
      };
    }

    return {
      isValid: true,
      variable,
      severity: 'info'
    };
  }

  /**
   * Get configuration guide for a specific variable
   */
  private getVariableConfigurationGuide(variable: string): string {
    const guides: Record<string, string> = {
      'NEXT_PUBLIC_NAKAMA_HOST': 'Set to your Nakama server hostname (e.g., localhost for dev, your-app.railway.app for Railway)',
      'NEXT_PUBLIC_NAKAMA_PORT': 'Set to your Nakama server port (typically 7350 for HTTP, 443 for HTTPS)',
      'NEXT_PUBLIC_NAKAMA_SERVER_KEY': 'Set to match the server_key in your Nakama server configuration',
      'NEXT_PUBLIC_NAKAMA_USE_SSL': 'Set to "true" for HTTPS/WSS connections, "false" for HTTP/WS'
    };

    return guides[variable] || `Configure ${variable} according to your deployment requirements`;
  }

  /**
   * Mask server key for safe logging
   */
  private maskServerKey(key: string): string {
    if (!key || key.length < 4) {
      return '***';
    }
    return key.substring(0, 4) + '*'.repeat(Math.max(0, key.length - 4));
  }

  /**
   * Validate NAKAMA_SERVER_KEY consistency across environments
   */
  public validateServerKeyConsistency(): ServerKeyConsistencyCheck {
    const clientKey = process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || '';
    const maskedClientKey = this.maskServerKey(clientKey);
    
    // Check different environment contexts
    const environments = [
      {
        name: 'current',
        keyMatch: this.isValidServerKey(clientKey),
        keyPresent: !!clientKey
      },
      {
        name: 'production',
        keyMatch: this.validateServerKeyForEnvironment(clientKey, 'production'),
        keyPresent: !!clientKey
      },
      {
        name: 'development', 
        keyMatch: this.validateServerKeyForEnvironment(clientKey, 'development'),
        keyPresent: !!clientKey
      }
    ];

    const isConsistent = environments.every(env => env.keyMatch && env.keyPresent);
    const recommendations = this.generateServerKeyRecommendations(clientKey, environments);

    return {
      isConsistent,
      clientKey: maskedClientKey,
      serverKeyPresent: !!clientKey,
      environments,
      recommendations
    };
  }

  /**
   * Check for missing or malformed environment variables
   */
  public validateEnvironmentVariables(): EnvironmentValidationReport {
    const currentEnv = this.getCurrentEnvironmentConfig();
    const validationResults = this.validateRequiredVariables();
    const serverKeyConsistency = this.validateServerKeyConsistency();
    
    const missingVariables = validationResults
      .filter(result => !result.isValid && result.error?.includes('missing'))
      .map(result => result.variable);
    
    const malformedVariables = validationResults
      .filter(result => !result.isValid && !result.error?.includes('missing'))
      .map(result => result.variable);

    const environmentSpecificIssues = this.getEnvironmentSpecificIssues(currentEnv);
    const recommendations = this.generateEnvironmentRecommendations(
      validationResults, 
      serverKeyConsistency, 
      environmentSpecificIssues
    );

    const isValid = validationResults.every(result => result.isValid) && 
                   serverKeyConsistency.isConsistent && 
                   environmentSpecificIssues.length === 0;

    return {
      environment: currentEnv.name,
      isValid,
      validationResults,
      serverKeyConsistency,
      missingVariables,
      malformedVariables,
      environmentSpecificIssues,
      recommendations
    };
  }

  /**
   * Generate validation report with specific recommendations for fixes
   */
  public generateValidationReport(): EnvironmentValidationReport {
    return this.validateEnvironmentVariables();
  }

  /**
   * Handle environment-specific configuration (dev vs production)
   */
  public getEnvironmentSpecificConfiguration(environment: 'development' | 'production'): EnvironmentConfig {
    const baseConfig = this.getCurrentEnvironmentConfig();
    
    if (environment === 'production') {
      return {
        ...baseConfig,
        name: `${baseConfig.deployment}-production`,
        environment: 'production',
        useSSL: true // Force SSL in production
      };
    } else {
      return {
        ...baseConfig,
        name: `${baseConfig.deployment}-development`,
        environment: 'development',
        useSSL: baseConfig.useSSL // Allow flexible SSL in development
      };
    }
  }

  /**
   * Validate server key for specific environment
   */
  private validateServerKeyForEnvironment(serverKey: string, environment: string): boolean {
    if (!serverKey) return false;
    
    // Environment-specific validation rules
    if (environment === 'production') {
      // Production requires non-default, secure keys
      return serverKey !== 'defaultkey' && 
             serverKey !== 'your-server-key-here' && 
             serverKey.length >= 16;
    } else {
      // Development allows more flexibility but still requires valid key
      return serverKey !== '' && serverKey.length >= 8;
    }
  }

  /**
   * Check if server key is valid for current context
   */
  private isValidServerKey(serverKey: string): boolean {
    const isProduction = process.env.NODE_ENV === 'production';
    return this.validateServerKeyForEnvironment(serverKey, isProduction ? 'production' : 'development');
  }

  /**
   * Generate server key specific recommendations
   */
  private generateServerKeyRecommendations(serverKey: string, environments: any[]): string[] {
    const recommendations: string[] = [];
    
    if (!serverKey) {
      recommendations.push('Set NEXT_PUBLIC_NAKAMA_SERVER_KEY environment variable');
      recommendations.push('Ensure the key matches your Nakama server configuration');
      return recommendations;
    }

    if (serverKey === 'defaultkey' || serverKey === 'your-server-key-here') {
      recommendations.push('Replace default server key with a secure, unique key');
      recommendations.push('Generate a strong server key for production use');
    }

    if (serverKey.length < 16 && process.env.NODE_ENV === 'production') {
      recommendations.push('Use a server key with at least 16 characters for production');
    }

    const inconsistentEnvs = environments.filter(env => !env.keyMatch);
    if (inconsistentEnvs.length > 0) {
      recommendations.push(`Server key validation failed for: ${inconsistentEnvs.map(e => e.name).join(', ')}`);
      recommendations.push('Verify server key meets requirements for all target environments');
    }

    // Deployment-specific recommendations
    const host = process.env.NEXT_PUBLIC_NAKAMA_HOST;
    if (host?.includes('.railway.app')) {
      recommendations.push('For Railway: Set server key in Railway project environment variables');
      recommendations.push('Ensure Railway server configuration uses the same key');
    }

    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      recommendations.push('For Vercel: Set server key in Vercel project settings');
      recommendations.push('Redeploy after updating environment variables');
    }

    return recommendations;
  }

  /**
   * Get environment-specific configuration issues
   */
  private getEnvironmentSpecificIssues(config: EnvironmentConfig): string[] {
    const issues: string[] = [];
    
    // Production-specific checks
    if (config.environment === 'production') {
      if (!config.useSSL) {
        issues.push('SSL must be enabled in production environment');
      }
      
      if (config.host === 'localhost' || config.host === '127.0.0.1') {
        issues.push('Production environment should not use localhost');
      }
      
      if (config.serverKey.includes('default') || config.serverKey.length < 8) {
        issues.push('Production requires a secure, non-default server key');
      }
    }

    // Railway-specific checks
    if (config.deployment === 'railway') {
      if (!config.useSSL) {
        issues.push('Railway deployments should use SSL/TLS');
      }
      
      if (!config.host.includes('.railway.app')) {
        issues.push('Railway deployment detected but host does not match Railway domain');
      }
    }

    // Vercel-specific checks
    if (config.deployment === 'vercel') {
      if (config.environment === 'production' && !config.useSSL) {
        issues.push('Vercel production deployments should use SSL/TLS');
      }
    }

    // Development-specific warnings
    if (config.environment === 'development') {
      if (config.serverKey === 'defaultkey') {
        issues.push('Consider using a unique server key even in development');
      }
    }

    return issues;
  }

  /**
   * Generate comprehensive environment recommendations
   */
  private generateEnvironmentRecommendations(
    validationResults: ValidationResult[],
    serverKeyConsistency: ServerKeyConsistencyCheck,
    environmentIssues: string[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Add validation result recommendations
    validationResults.forEach(result => {
      if (!result.isValid && result.recommendation) {
        recommendations.push(result.recommendation);
      }
    });

    // Add server key recommendations
    recommendations.push(...serverKeyConsistency.recommendations);

    // Add environment-specific recommendations
    environmentIssues.forEach(issue => {
      if (issue.includes('SSL')) {
        recommendations.push('Enable SSL by setting NEXT_PUBLIC_NAKAMA_USE_SSL=true');
      }
      if (issue.includes('localhost')) {
        recommendations.push('Set NEXT_PUBLIC_NAKAMA_HOST to your production domain');
      }
      if (issue.includes('server key')) {
        recommendations.push('Generate and set a secure server key');
      }
    });

    // Add deployment-specific guidance
    const currentEnv = this.getCurrentEnvironmentConfig();
    if (currentEnv.deployment === 'railway') {
      recommendations.push('Railway: Update environment variables in Railway dashboard');
      recommendations.push('Railway: Redeploy after environment variable changes');
    }
    
    if (currentEnv.deployment === 'vercel') {
      recommendations.push('Vercel: Update environment variables in Vercel project settings');
      recommendations.push('Vercel: Redeploy to apply environment variable changes');
    }

    // Remove duplicates and return
    return [...new Set(recommendations)];
  }

  /**
   * Create default sync status when no cached status exists
   */
  private createDefaultSyncStatus(): SyncStatus {
    return {
      inSync: false,
      missingVariables: [],
      mismatchedVariables: [],
      environments: [this.getCurrentEnvironmentConfig()],
      lastCheck: new Date()
    };
  }
}