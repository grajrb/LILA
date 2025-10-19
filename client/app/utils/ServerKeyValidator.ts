// client/app/utils/ServerKeyValidator.ts

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  recommendation?: string;
}

export interface KeyValidationReport {
  clientKey: string; // masked
  serverKeyPresent: boolean;
  environmentsChecked: string[];
  lastValidation: Date;
  validationResults: ValidationResult[];
}

export class ServerKeyValidator {
  private static instance: ServerKeyValidator;
  private lastValidation?: Date;
  private validationHistory: ValidationResult[] = [];

  private constructor() {}

  public static getInstance(): ServerKeyValidator {
    if (!ServerKeyValidator.instance) {
      ServerKeyValidator.instance = new ServerKeyValidator();
    }
    return ServerKeyValidator.instance;
  }

  /**
   * Validate server key configuration
   * @param clientKey The client-side server key
   * @param serverKey Optional server key to compare against (for testing)
   * @returns ValidationResult indicating if the key is valid
   */
  public validateKey(clientKey: string, serverKey?: string): ValidationResult {
    this.lastValidation = new Date();

    // Basic validation checks
    if (!clientKey || clientKey.trim() === '') {
      const result: ValidationResult = {
        isValid: false,
        error: 'Server key is missing or empty',
        recommendation: 'Set NEXT_PUBLIC_NAKAMA_SERVER_KEY environment variable'
      };
      this.validationHistory.push(result);
      return result;
    }

    // Check for default/insecure keys
    if (this.isDefaultKey(clientKey)) {
      const result: ValidationResult = {
        isValid: false,
        error: 'Using default or insecure server key',
        recommendation: 'Replace with a secure, randomly generated server key'
      };
      this.validationHistory.push(result);
      return result;
    }

    // Check key length and complexity
    if (clientKey.length < 8) {
      const result: ValidationResult = {
        isValid: false,
        error: 'Server key is too short',
        recommendation: 'Use a server key with at least 8 characters'
      };
      this.validationHistory.push(result);
      return result;
    }

    // If server key is provided, compare them
    if (serverKey && clientKey !== serverKey) {
      const result: ValidationResult = {
        isValid: false,
        error: 'Client and server keys do not match',
        recommendation: 'Ensure NEXT_PUBLIC_NAKAMA_SERVER_KEY matches the server configuration'
      };
      this.validationHistory.push(result);
      return result;
    }

    // Key is valid
    const result: ValidationResult = {
      isValid: true
    };
    this.validationHistory.push(result);
    return result;
  }

  /**
   * Safely mask server key for logging purposes
   * @param key The server key to mask
   * @returns Masked version of the key
   */
  public maskKey(key: string): string {
    if (!key || key.length === 0) {
      return '[EMPTY]';
    }

    if (key.length <= 4) {
      return '*'.repeat(key.length);
    }

    // Show first 2 and last 2 characters, mask the middle
    const start = key.substring(0, 2);
    const end = key.substring(key.length - 2);
    const middle = '*'.repeat(Math.max(4, key.length - 4));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Detect if an error is caused by server key mismatch
   * @param error The error to analyze
   * @returns True if the error appears to be caused by key mismatch
   */
  public detectKeyMismatch(error: Error): boolean {
    if (!error) {
      return false;
    }

    const errorMessage = error.message?.toLowerCase() || '';
    const errorString = error.toString().toLowerCase();

    // Check for common authentication failure patterns
    const keyMismatchIndicators = [
      'unauthorized',
      '401',
      'authentication failed',
      'invalid server key',
      'server key mismatch',
      'invalid credentials',
      'access denied',
      'forbidden'
    ];

    // Check if error message contains key mismatch indicators
    const hasKeyMismatchIndicator = keyMismatchIndicators.some(indicator => 
      errorMessage.includes(indicator) || errorString.includes(indicator)
    );

    // Additional checks for HTTP response errors
    if (error instanceof Error && 'status' in error) {
      const status = (error as any).status;
      if (status === 401 || status === 403) {
        return true;
      }
    }

    // Check for fetch response errors
    if (error instanceof TypeError && errorMessage.includes('fetch')) {
      // Network errors might not be key mismatches
      return false;
    }

    return hasKeyMismatchIndicator;
  }

  /**
   * Generate comprehensive validation report for debugging
   * @returns KeyValidationReport with current validation status
   */
  public generateKeyReport(): KeyValidationReport {
    const clientKey = this.getCurrentClientKey();
    const environments = this.getEnvironmentsChecked();
    
    return {
      clientKey: this.maskKey(clientKey),
      serverKeyPresent: !!clientKey && clientKey.trim() !== '',
      environmentsChecked: environments,
      lastValidation: this.lastValidation || new Date(),
      validationResults: [...this.validationHistory].slice(-5) // Last 5 validation attempts
    };
  }

  /**
   * Check if the key appears to be a default or insecure key
   * @param key The key to check
   * @returns True if the key appears to be default or insecure
   */
  private isDefaultKey(key: string): boolean {
    const defaultKeys = [
      'defaultkey',
      'default',
      'test',
      'testing',
      'dev',
      'development',
      'localhost',
      'nakama',
      'server',
      'key',
      '123456',
      'password',
      'secret'
    ];

    const lowerKey = key.toLowerCase();
    return defaultKeys.some(defaultKey => 
      lowerKey === defaultKey || 
      lowerKey.includes(defaultKey)
    );
  }

  /**
   * Get the current client-side server key
   * @returns The current server key from environment
   */
  private getCurrentClientKey(): string {
    return process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || '';
  }

  /**
   * Get list of environments that have been checked
   * @returns Array of environment names
   */
  private getEnvironmentsChecked(): string[] {
    const environments: string[] = [];

    // Check if we're in different deployment environments
    if (process.env.VERCEL_ENV) {
      environments.push(`Vercel (${process.env.VERCEL_ENV})`);
    }

    if (process.env.RAILWAY_ENVIRONMENT) {
      environments.push(`Railway (${process.env.RAILWAY_ENVIRONMENT})`);
    }

    if (process.env.NODE_ENV) {
      environments.push(`Node.js (${process.env.NODE_ENV})`);
    }

    // If no specific environments detected, add generic ones
    if (environments.length === 0) {
      environments.push('Local Development');
    }

    return environments;
  }

  /**
   * Clear validation history (useful for testing)
   */
  public clearValidationHistory(): void {
    this.validationHistory = [];
    this.lastValidation = undefined;
  }

  /**
   * Get validation history for debugging
   * @returns Array of recent validation results
   */
  public getValidationHistory(): ValidationResult[] {
    return [...this.validationHistory];
  }
}