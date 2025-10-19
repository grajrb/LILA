// client/app/nakama.ts
import { Client, Socket, WebSocketAdapter } from "@heroiclabs/nakama-js";
import { EnvironmentConfig } from "./utils/EnvironmentConfig";
import { ServerKeyValidatorIntegration } from "./utils/ServerKeyValidatorIntegration";

// Initialize environment configuration
const envConfig = EnvironmentConfig.getInstance();
const config = envConfig.getNakamaConfig();

// Initialize server key validator
const keyValidator = new ServerKeyValidatorIntegration();

// Log configuration summary
console.log(envConfig.getConfigSummary());

// Validate server key configuration and log status
keyValidator.logConfigurationStatus();

// Create client with HTTP/HTTPS protocol (for REST API calls)
// Use environment config to determine correct host, port, and SSL settings
const client = new Client(
  config.serverKey, 
  config.host, 
  config.port, 
  config.useSSL, 
  config.timeout, 
  true
);

console.log(`🔗 HTTP Client initialized with SSL: ${config.useSSL}`);
console.log(`🔌 WebSocket connections will use: ${envConfig.getWebSocketProtocol().toUpperCase()}`);

// Enhanced client with secure WebSocket creation using EnvironmentConfig
const enhancedClient = Object.create(client);

// Override createSocket to ensure correct WebSocket protocol based on environment
enhancedClient.createSocket = (useSSL?: boolean, verboseLogging?: boolean, adapter?: WebSocketAdapter): Socket => {
  // Always use the environment-determined WebSocket protocol
  // This ensures Railway.app compatibility and Mixed Content Policy compliance
  const wsConfig = envConfig.getWebSocketConfig();
  
  console.log(`🔌 Creating WebSocket connection:`);
  console.log(`   - Environment: ${envConfig.isProduction() ? 'Production' : 'Development'}`);
  console.log(`   - Page Protocol: ${typeof window !== 'undefined' ? window.location.protocol : 'server-side'}`);
  console.log(`   - WebSocket Protocol: ${wsConfig.protocol.toUpperCase()} (${wsConfig.useSSL ? 'Secure' : 'Insecure'})`);
  console.log(`   - WebSocket URL: ${envConfig.getWebSocketUrl()}`);
  
  // Create socket with the environment-determined SSL setting
  return client.createSocket(wsConfig.useSSL, verboseLogging, adapter);
};

// Add method to get current WebSocket protocol for debugging
enhancedClient.getWebSocketProtocol = (): string => {
  return envConfig.getWebSocketProtocol();
};

// Add method to construct WebSocket URL for debugging
enhancedClient.getWebSocketUrl = (): string => {
  return envConfig.getWebSocketUrl();
};

// Add method to get HTTP URL for debugging
enhancedClient.getHttpUrl = (): string => {
  return envConfig.getHttpUrl();
};

// Add method to get configuration summary
enhancedClient.getConfigSummary = (): string => {
  return envConfig.getConfigSummary();
};

// Add server key validation methods
enhancedClient.validateServerKey = () => {
  return keyValidator.validateCurrentConfiguration();
};

enhancedClient.getMaskedServerKey = (): string => {
  return keyValidator.getMaskedCurrentKey();
};

enhancedClient.isAuthenticationKeyError = (error: Error): boolean => {
  return keyValidator.isAuthenticationKeyError(error);
};

enhancedClient.getValidationReport = () => {
  return keyValidator.generateConfigurationReport();
};

// Enhanced connection testing with better error handling and Railway.app support
const testConnection = async () => {
  try {
    // Validate server key configuration before attempting connection
    try {
      keyValidator.validateBeforeAuthentication();
      console.log('🔐 Server key validation passed');
    } catch (validationError) {
      console.error('❌ Server key validation failed:', validationError.message);
      return; // Don't attempt connection with invalid key
    }

    const healthUrl = `${envConfig.getHttpUrl()}/v2/healthcheck`;
    console.log(`🔍 Testing connection to: ${healthUrl}`);
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Nakama server is healthy:', health);
      
      // Additional Railway.app specific logging
      if (envConfig.isProduction()) {
        console.log('🚀 Production deployment connection successful');
      }
    } else {
      console.error('❌ Nakama health check failed:', response.status, response.statusText);
      
      // Enhanced error messages based on environment
      if (response.status === 404) {
        console.log('💡 The /v2/healthcheck endpoint might not be available on this server');
      } else if (response.status >= 500) {
        console.log('💡 Server error - the Nakama server might be starting up or experiencing issues');
      }
    }
  } catch (error) {
    console.error('❌ Failed to connect to Nakama server:', error);
    
    // Check if this might be a server key mismatch error
    if (keyValidator.isAuthenticationKeyError(error as Error)) {
      console.error('🔐 This appears to be a server key authentication error!');
      console.error('💡 Server key mismatch detected. Please verify:');
      console.error(`   - Client key: ${keyValidator.getMaskedCurrentKey()}`);
      console.error('   - Server configuration matches client configuration');
      console.error('   - Environment variables are set correctly');
    }
    
    // Environment-specific troubleshooting tips
    console.log('📝 Troubleshooting tips:');
    
    if (envConfig.isProduction()) {
      console.log('🚀 Production Environment:');
      console.log('1. Verify Railway.app deployment is running');
      console.log('2. Check Railway.app service logs for errors');
      console.log('3. Ensure environment variables are set correctly');
      console.log('4. Verify custom domain configuration (if applicable)');
    } else {
      console.log('🔧 Development Environment:');
      console.log('1. Check if Nakama server is running locally');
      console.log('2. Verify host and port configuration in .env.local');
      console.log('3. Check firewall settings');
      console.log('4. Ensure server key matches backend configuration');
      console.log('5. Try running: docker-compose up (if using Docker)');
    }
    
    // Configuration-specific tips
    const wsConfig = envConfig.getWebSocketConfig();
    if (wsConfig.useSSL && !envConfig.shouldForceSSL()) {
      console.log('⚠️  SSL is configured but may not be required in this environment');
    }
  }
};

// Test connection in development and log configuration
if (typeof window !== 'undefined') {
  if (envConfig.isDevelopment()) {
    console.log('🔧 Development mode - testing connection...');
    testConnection();
  } else {
    console.log('🚀 Production mode - connection will be tested on first use');
  }
}

export default enhancedClient;