// client/app/utils/__tests__/EnvironmentSynchronizer.test.ts

import { EnvironmentSynchronizer } from '../EnvironmentSynchronizer';

// Mock process.env for testing
const originalEnv = process.env;

describe('EnvironmentSynchronizer', () => {
  let synchronizer: EnvironmentSynchronizer;

  beforeEach(() => {
    // Reset process.env to a clean state
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_NAKAMA_HOST: 'localhost',
      NEXT_PUBLIC_NAKAMA_PORT: '7350',
      NEXT_PUBLIC_NAKAMA_SERVER_KEY: 'test-server-key',
      NEXT_PUBLIC_NAKAMA_USE_SSL: 'false',
      NODE_ENV: 'development',
    };

    // Get fresh instance for each test
    synchronizer = EnvironmentSynchronizer.getInstance();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Variable Comparison Logic', () => {
    it('should detect all variables are present and valid', async () => {
      const syncStatus = await synchronizer.checkEnvironmentSync();

      expect(syncStatus.inSync).toBe(true);
      expect(syncStatus.missingVariables).toHaveLength(0);
      expect(syncStatus.mismatchedVariables).toHaveLength(0);
      expect(syncStatus.environments).toHaveLength(1);
      expect(syncStatus.lastCheck).toBeInstanceOf(Date);
    });

    it('should detect missing environment variables', async () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_HOST;
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;

      const syncStatus = await synchronizer.checkEnvironmentSync();

      expect(syncStatus.inSync).toBe(false);
      expect(syncStatus.missingVariables).toContain('NEXT_PUBLIC_NAKAMA_HOST');
      expect(syncStatus.missingVariables).toContain('NEXT_PUBLIC_NAKAMA_SERVER_KEY');
      expect(syncStatus.missingVariables).toHaveLength(2);
    });

    it('should detect empty environment variables as missing', async () => {
      process.env.NEXT_PUBLIC_NAKAMA_HOST = '';
      process.env.NEXT_PUBLIC_NAKAMA_PORT = '   '; // whitespace only

      const syncStatus = await synchronizer.checkEnvironmentSync();

      expect(syncStatus.inSync).toBe(false);
      expect(syncStatus.missingVariables).toContain('NEXT_PUBLIC_NAKAMA_HOST');
      expect(syncStatus.missingVariables).toContain('NEXT_PUBLIC_NAKAMA_PORT');
    });

    it('should detect mismatched variables with default values', async () => {
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'defaultkey';

      const syncStatus = await synchronizer.checkEnvironmentSync();

      expect(syncStatus.inSync).toBe(false);
      expect(syncStatus.mismatchedVariables).toContain('NEXT_PUBLIC_NAKAMA_SERVER_KEY');
    });

    it('should detect localhost in production as mismatch', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'localhost';

      const syncStatus = await synchronizer.checkEnvironmentSync();

      expect(syncStatus.inSync).toBe(false);
      expect(syncStatus.mismatchedVariables).toContain('NEXT_PUBLIC_NAKAMA_HOST');
    });

    it('should detect SSL mismatch for Railway hosts', async () => {
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'myapp.railway.app';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';

      const syncStatus = await synchronizer.checkEnvironmentSync();

      expect(syncStatus.inSync).toBe(false);
      expect(syncStatus.mismatchedVariables).toContain('NEXT_PUBLIC_NAKAMA_USE_SSL');
    });

    it('should compare environment configurations correctly', () => {
      const config1 = synchronizer.getEnvironmentConfig('development');
      const config2 = synchronizer.getEnvironmentConfig('production');

      expect(config1.name).toBe('development');
      expect(config1.environment).toBe('development');
      expect(config2.name).toBe('production');
      expect(config2.environment).toBe('production');
      
      // Both should have same base configuration
      expect(config1.host).toBe(config2.host);
      expect(config1.port).toBe(config2.port);
    });
  });

  describe('Missing Configuration Detection', () => {
    it('should validate all required variables are present', () => {
      const validationResults = synchronizer.validateRequiredVariables();

      expect(validationResults).toHaveLength(4);
      validationResults.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.severity).toBe('info');
      });
    });

    it('should detect missing server key', () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;

      const validationResults = synchronizer.validateRequiredVariables();
      const serverKeyResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_SERVER_KEY');

      expect(serverKeyResult?.isValid).toBe(false);
      expect(serverKeyResult?.error).toBe('Variable is missing or empty');
      expect(serverKeyResult?.severity).toBe('error');
      expect(serverKeyResult?.recommendation).toContain('Set NEXT_PUBLIC_NAKAMA_SERVER_KEY');
    });

    it('should detect missing host configuration', () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_HOST;

      const validationResults = synchronizer.validateRequiredVariables();
      const hostResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_HOST');

      expect(hostResult?.isValid).toBe(false);
      expect(hostResult?.error).toBe('Variable is missing or empty');
      expect(hostResult?.severity).toBe('error');
    });

    it('should detect missing port configuration', () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_PORT;

      const validationResults = synchronizer.validateRequiredVariables();
      const portResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_PORT');

      expect(portResult?.isValid).toBe(false);
      expect(portResult?.error).toBe('Variable is missing or empty');
      expect(portResult?.severity).toBe('error');
    });

    it('should detect missing SSL configuration', () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_USE_SSL;

      const validationResults = synchronizer.validateRequiredVariables();
      const sslResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_USE_SSL');

      expect(sslResult?.isValid).toBe(false);
      expect(sslResult?.error).toBe('Variable is missing or empty');
      expect(sslResult?.severity).toBe('error');
    });

    it('should validate server key format and security', () => {
      // Test default key
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'defaultkey';
      let validationResults = synchronizer.validateRequiredVariables();
      let serverKeyResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_SERVER_KEY');
      
      expect(serverKeyResult?.isValid).toBe(false);
      expect(serverKeyResult?.error).toBe('Using default or placeholder server key');
      expect(serverKeyResult?.severity).toBe('warning');

      // Test short key
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'short';
      validationResults = synchronizer.validateRequiredVariables();
      serverKeyResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_SERVER_KEY');
      
      expect(serverKeyResult?.isValid).toBe(false);
      expect(serverKeyResult?.error).toBe('Server key is too short');
      expect(serverKeyResult?.severity).toBe('warning');

      // Test valid key
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'valid-server-key-123';
      validationResults = synchronizer.validateRequiredVariables();
      serverKeyResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_SERVER_KEY');
      
      expect(serverKeyResult?.isValid).toBe(true);
    });

    it('should validate host format', () => {
      // Test invalid host
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'invalid host with spaces';
      let validationResults = synchronizer.validateRequiredVariables();
      let hostResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_HOST');
      
      expect(hostResult?.isValid).toBe(false);
      expect(hostResult?.error).toBe('Invalid host format');
      expect(hostResult?.severity).toBe('error');

      // Test localhost in production
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'localhost';
      validationResults = synchronizer.validateRequiredVariables();
      hostResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_HOST');
      
      expect(hostResult?.isValid).toBe(false);
      expect(hostResult?.error).toBe('Using localhost in production environment');
      expect(hostResult?.severity).toBe('error');
    });

    it('should validate port format', () => {
      // Test invalid port
      process.env.NEXT_PUBLIC_NAKAMA_PORT = 'not-a-number';
      let validationResults = synchronizer.validateRequiredVariables();
      let portResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_PORT');
      
      expect(portResult?.isValid).toBe(false);
      expect(portResult?.error).toBe('Invalid port number');
      expect(portResult?.severity).toBe('error');

      // Test out of range port
      process.env.NEXT_PUBLIC_NAKAMA_PORT = '99999';
      validationResults = synchronizer.validateRequiredVariables();
      portResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_PORT');
      
      expect(portResult?.isValid).toBe(false);
      expect(portResult?.error).toBe('Invalid port number');
      expect(portResult?.severity).toBe('error');

      // Test valid port
      process.env.NEXT_PUBLIC_NAKAMA_PORT = '7350';
      validationResults = synchronizer.validateRequiredVariables();
      portResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_PORT');
      
      expect(portResult?.isValid).toBe(true);
    });

    it('should validate SSL configuration', () => {
      // Test invalid SSL value
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'maybe';
      let validationResults = synchronizer.validateRequiredVariables();
      let sslResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_USE_SSL');
      
      expect(sslResult?.isValid).toBe(false);
      expect(sslResult?.error).toBe('SSL setting must be "true" or "false"');
      expect(sslResult?.severity).toBe('error');

      // Test Railway host without SSL
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'myapp.railway.app';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';
      validationResults = synchronizer.validateRequiredVariables();
      sslResult = validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_USE_SSL');
      
      expect(sslResult?.isValid).toBe(false);
      expect(sslResult?.error).toBe('SSL should be enabled for Railway deployments');
      expect(sslResult?.severity).toBe('warning');
    });
  });

  describe('Synchronization Report Generation', () => {
    it('should generate comprehensive sync report for valid configuration', async () => {
      // First check sync status to ensure it's cached
      await synchronizer.checkEnvironmentSync();
      const report = synchronizer.generateSyncReport();

      expect(report.status.inSync).toBe(true);
      expect(report.recommendations).toHaveLength(0);
      expect(report.criticalIssues).toHaveLength(0);
      expect(report.warnings).toHaveLength(0);
      expect(report.configurationGuide).toHaveLength(0);
    });

    it('should generate report with missing variable recommendations', async () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;
      delete process.env.NEXT_PUBLIC_NAKAMA_HOST;

      // Check sync status first to populate missing variables
      await synchronizer.checkEnvironmentSync();
      const report = synchronizer.generateSyncReport();

      expect(report.status.inSync).toBe(false);
      expect(report.criticalIssues.length).toBeGreaterThan(0);
      expect(report.recommendations).toContain('Set NEXT_PUBLIC_NAKAMA_SERVER_KEY environment variable');
      expect(report.recommendations).toContain('Set NEXT_PUBLIC_NAKAMA_HOST environment variable');
      expect(report.configurationGuide.length).toBeGreaterThan(0);
    });

    it('should generate report with mismatch recommendations', async () => {
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'defaultkey';
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'localhost';

      // Check sync status first to populate mismatched variables
      await synchronizer.checkEnvironmentSync();
      const report = synchronizer.generateSyncReport();

      expect(report.status.inSync).toBe(false);
      expect(report.recommendations.some(r => r.includes('NEXT_PUBLIC_NAKAMA_SERVER_KEY'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('NEXT_PUBLIC_NAKAMA_HOST'))).toBe(true);
      expect(report.configurationGuide).toContain('For Railway deployment: Set environment variables in Railway dashboard');
      expect(report.configurationGuide).toContain('For Vercel deployment: Set environment variables in Vercel project settings');
    });

    it('should include configuration guidance in report', async () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;

      // Check sync status first to populate missing variables
      await synchronizer.checkEnvironmentSync();
      const report = synchronizer.generateSyncReport();

      expect(report.configurationGuide.some(guide => guide.includes('server_key'))).toBe(true);
      expect(report.configurationGuide).toContain('For Railway deployment: Set environment variables in Railway dashboard');
      expect(report.configurationGuide).toContain('Ensure NAKAMA_SERVER_KEY matches between client and server configurations');
    });

    it('should categorize issues by severity', () => {
      // Setup mixed severity issues
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY; // Critical error
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'myapp.railway.app';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false'; // Warning for Railway

      const report = synchronizer.generateSyncReport();

      expect(report.criticalIssues.length).toBeGreaterThan(0);
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(report.criticalIssues.some(issue => issue.includes('NEXT_PUBLIC_NAKAMA_SERVER_KEY'))).toBe(true);
      expect(report.warnings.some(warning => warning.includes('NEXT_PUBLIC_NAKAMA_USE_SSL'))).toBe(true);
    });
  });

  describe('Environment-Specific Validation Rules', () => {
    it('should apply development environment rules', () => {
      process.env.NODE_ENV = 'development';
      // Use a valid server key for development
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'development-key-123';
      
      const envConfig = synchronizer.getEnvironmentSpecificConfiguration('development');
      const validationReport = synchronizer.validateEnvironmentVariables();

      expect(envConfig.environment).toBe('development');
      expect(envConfig.name).toContain('development');
      expect(validationReport.environment).toBe('local'); // Current environment is detected as local
      expect(validationReport.isValid).toBe(true);
    });

    it('should apply production environment rules', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'myapp.railway.app';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'true';
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'production-secure-key-123456';
      
      const envConfig = synchronizer.getEnvironmentSpecificConfiguration('production');
      const validationReport = synchronizer.validateEnvironmentVariables();

      expect(envConfig.environment).toBe('production');
      expect(envConfig.useSSL).toBe(true); // Force SSL in production
      expect(envConfig.name).toContain('production');
      expect(validationReport.isValid).toBe(true);
    });

    it('should detect production-specific issues', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'localhost';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'defaultkey';

      const validationReport = synchronizer.validateEnvironmentVariables();

      expect(validationReport.isValid).toBe(false);
      expect(validationReport.environmentSpecificIssues).toContain('SSL must be enabled in production environment');
      expect(validationReport.environmentSpecificIssues).toContain('Production environment should not use localhost');
      // The server key issue is handled in validation results, not environment-specific issues
    });

    it('should detect Railway-specific configuration issues', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'myapp.railway.app';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';

      const validationReport = synchronizer.validateEnvironmentVariables();

      expect(validationReport.environmentSpecificIssues).toContain('Railway deployments should use SSL/TLS');
    });

    it('should detect Vercel-specific configuration issues', () => {
      process.env.VERCEL = '1';
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false';

      const validationReport = synchronizer.validateEnvironmentVariables();

      expect(validationReport.environmentSpecificIssues).toContain('Vercel production deployments should use SSL/TLS');
    });

    it('should provide environment-specific recommendations', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;

      const validationReport = synchronizer.validateEnvironmentVariables();

      expect(validationReport.recommendations).toContain('Railway: Update environment variables in Railway dashboard');
      expect(validationReport.recommendations).toContain('Railway: Redeploy after environment variable changes');
    });

    it('should handle development environment flexibility', () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'defaultkey';

      const validationReport = synchronizer.validateEnvironmentVariables();

      // In development, default key is handled as a validation warning, not environment-specific issue
      expect(validationReport.isValid).toBe(false); // Still invalid due to validation rules
      const serverKeyValidation = validationReport.validationResults.find(r => r.variable === 'NEXT_PUBLIC_NAKAMA_SERVER_KEY');
      expect(serverKeyValidation?.severity).toBe('warning'); // Should be warning in development
    });
  });

  describe('Server Key Consistency Validation', () => {
    it('should validate server key consistency across environments', () => {
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'consistent-key-123456';

      const consistencyCheck = synchronizer.validateServerKeyConsistency();

      expect(consistencyCheck.isConsistent).toBe(true);
      expect(consistencyCheck.serverKeyPresent).toBe(true);
      expect(consistencyCheck.clientKey).toBe('cons*****************'); // Masked - actual masking pattern
      expect(consistencyCheck.environments.every(env => env.keyMatch && env.keyPresent)).toBe(true);
    });

    it('should detect missing server key', () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;

      const consistencyCheck = synchronizer.validateServerKeyConsistency();

      expect(consistencyCheck.isConsistent).toBe(false);
      expect(consistencyCheck.serverKeyPresent).toBe(false);
      expect(consistencyCheck.clientKey).toBe('***');
      expect(consistencyCheck.recommendations).toContain('Set NEXT_PUBLIC_NAKAMA_SERVER_KEY environment variable');
    });

    it('should detect invalid server key for production', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'short'; // Too short for production

      const consistencyCheck = synchronizer.validateServerKeyConsistency();

      expect(consistencyCheck.isConsistent).toBe(false);
      expect(consistencyCheck.recommendations).toContain('Use a server key with at least 16 characters for production');
    });

    it('should provide deployment-specific recommendations', () => {
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'myapp.railway.app';
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'defaultkey';

      const consistencyCheck = synchronizer.validateServerKeyConsistency();

      expect(consistencyCheck.recommendations).toContain('For Railway: Set server key in Railway project environment variables');
      expect(consistencyCheck.recommendations).toContain('Ensure Railway server configuration uses the same key');
    });

    it('should handle Vercel deployment recommendations', () => {
      process.env.VERCEL = '1';
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'defaultkey';

      const consistencyCheck = synchronizer.validateServerKeyConsistency();

      expect(consistencyCheck.recommendations).toContain('For Vercel: Set server key in Vercel project settings');
      expect(consistencyCheck.recommendations).toContain('Redeploy after updating environment variables');
    });
  });

  describe('Environment Detection and Configuration', () => {
    it('should detect Railway environment', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_HOST = 'myapp.railway.app';

      const config = synchronizer.getEnvironmentConfig('railway');

      expect(config.deployment).toBe('railway');
      expect(config.name).toBe('railway');
    });

    it('should detect Vercel environment', () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';

      const config = synchronizer.getEnvironmentConfig('vercel');

      expect(config.deployment).toBe('vercel');
      expect(config.name).toBe('vercel');
    });

    it('should detect local development environment', () => {
      // Remove deployment indicators
      delete process.env.RAILWAY_ENVIRONMENT;
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;

      const config = synchronizer.getEnvironmentConfig('local');

      expect(config.deployment).toBe('local');
      expect(config.name).toBe('local');
    });

    it('should mask server keys in configuration', () => {
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'very-long-server-key-for-testing';

      const config = synchronizer.getEnvironmentConfig('current');

      expect(config.serverKey).toBe('very****************************'); // Actual masking pattern
      expect(config.serverKey).not.toContain('very-long-server-key-for-testing');
    });

    it('should handle short server keys in masking', () => {
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY = 'abc';

      const config = synchronizer.getEnvironmentConfig('current');

      expect(config.serverKey).toBe('***');
    });
  });

  describe('Validation Report Generation', () => {
    it('should generate complete validation report', () => {
      const report = synchronizer.generateValidationReport();

      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('isValid');
      expect(report).toHaveProperty('validationResults');
      expect(report).toHaveProperty('serverKeyConsistency');
      expect(report).toHaveProperty('missingVariables');
      expect(report).toHaveProperty('malformedVariables');
      expect(report).toHaveProperty('environmentSpecificIssues');
      expect(report).toHaveProperty('recommendations');
    });

    it('should categorize validation issues correctly', () => {
      // Setup mixed issues
      delete process.env.NEXT_PUBLIC_NAKAMA_HOST; // Missing
      process.env.NEXT_PUBLIC_NAKAMA_PORT = 'invalid'; // Malformed
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_NAKAMA_USE_SSL = 'false'; // Environment-specific issue

      const report = synchronizer.generateValidationReport();

      expect(report.isValid).toBe(false);
      expect(report.missingVariables).toContain('NEXT_PUBLIC_NAKAMA_HOST');
      expect(report.malformedVariables).toContain('NEXT_PUBLIC_NAKAMA_PORT');
      expect(report.environmentSpecificIssues).toContain('SSL must be enabled in production environment');
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive recommendations', () => {
      delete process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY;
      process.env.RAILWAY_ENVIRONMENT = 'production';

      const report = synchronizer.generateValidationReport();

      expect(report.recommendations).toContain('Set NEXT_PUBLIC_NAKAMA_SERVER_KEY environment variable');
      expect(report.recommendations).toContain('Railway: Update environment variables in Railway dashboard');
      expect(report.recommendations).toContain('Railway: Redeploy after environment variable changes');
    });
  });
});