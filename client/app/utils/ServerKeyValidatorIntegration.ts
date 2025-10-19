// client/app/utils/ServerKeyValidatorIntegration.ts
// Integration utility to use ServerKeyValidator with Nakama client

import { ServerKeyValidator } from './ServerKeyValidator';
import { EnvironmentConfig } from './EnvironmentConfig';

export class ServerKeyValidatorIntegration {
  private validator: ServerKeyValidator;
  private envConfig: EnvironmentConfig;

  constructor() {
    this.validator = ServerKeyValidator.getInstance();
    this.envConfig = EnvironmentConfig.getInstance();
  }

  /**
   * Validate the current environment's server key configuration
   * @returns ValidationResult indicating if the configuration is valid
   */
  public validateCurrentConfiguration() {
    const config = this.envConfig.getNakamaConfig();
    return this.validator.validateKey(config.serverKey);
  }

  /**
   * Get a masked version of the current server key for logging
   * @returns Masked server key string
   */
  public getMaskedCurrentKey(): string {
    const config = this.envConfig.getNakamaConfig();
    return this.validator.maskKey(config.serverKey);
  }

  /**
   * Check if an authentication error is likely caused by server key mismatch
   * @param error The error to analyze
   * @returns True if the error appears to be a key mismatch
   */
  public isAuthenticationKeyError(error: Error): boolean {
    return this.validator.detectKeyMismatch(error);
  }

  /**
   * Generate a comprehensive configuration and validation report
   * @returns Combined report with environment and validation information
   */
  public generateConfigurationReport() {
    const envSummary = this.envConfig.getConfigSummary();
    const validationReport = this.validator.generateKeyReport();
    const currentValidation = this.validateCurrentConfiguration();

    return {
      environment: {
        summary: envSummary,
        isProduction: this.envConfig.isProduction(),
        isDevelopment: this.envConfig.isDevelopment(),
        httpUrl: this.envConfig.getHttpUrl(),
        webSocketUrl: this.envConfig.getWebSocketUrl()
      },
      serverKey: {
        validation: currentValidation,
        report: validationReport,
        masked: this.getMaskedCurrentKey()
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log configuration status with proper masking for security
   */
  public logConfigurationStatus(): void {
    const validation = this.validateCurrentConfiguration();
    const maskedKey = this.getMaskedCurrentKey();

    console.log('🔐 Server Key Validation Status:');
    console.log(`   Key: ${maskedKey}`);
    console.log(`   Valid: ${validation.isValid ? '✅' : '❌'}`);
    
    if (!validation.isValid) {
      console.log(`   Error: ${validation.error}`);
      if (validation.recommendation) {
        console.log(`   Recommendation: ${validation.recommendation}`);
      }
    }
  }

  /**
   * Validate configuration before attempting authentication
   * @throws Error if configuration is invalid and should block authentication
   */
  public validateBeforeAuthentication(): void {
    const validation = this.validateCurrentConfiguration();
    
    if (!validation.isValid) {
      const maskedKey = this.getMaskedCurrentKey();
      throw new Error(
        `Authentication blocked due to invalid server key configuration. ` +
        `Key: ${maskedKey}, Error: ${validation.error}. ` +
        `${validation.recommendation || 'Please check your environment configuration.'}`
      );
    }
  }
}