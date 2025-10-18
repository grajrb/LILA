// client/app/nakama.ts
import { Client, Socket, WebSocketAdapter } from "@heroiclabs/nakama-js";

// Configuration for both development and production
const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1";
const port = process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350";
const serverKey = process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || "defaultkey";
const useSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === "true";

console.log(`Nakama Client Config: ${host}:${port} (SSL: ${useSSL})`);
console.log(`Server Key: ${serverKey.substring(0, 8)}...`);

// For Railway deployments, use standard HTTPS port without explicit port in URL
const finalPort = useSSL && host.includes('.railway.app') ? "" : port;
const finalHost = useSSL && host.includes('.railway.app') ? host : host;

// Protocol detection logic for WebSocket connections
const detectWebSocketProtocol = (): boolean => {
  // If we're in a browser environment
  if (typeof window !== 'undefined') {
    // Check if the page is served over HTTPS
    const isPageHTTPS = window.location.protocol === 'https:';
    
    // If page is HTTPS, we must use WSS to avoid Mixed Content Policy violations
    if (isPageHTTPS) {
      console.log('Page served over HTTPS, forcing WSS for WebSocket connections');
      return true;
    }
    
    // If page is HTTP, use the configured SSL setting
    console.log(`Page served over HTTP, using configured SSL setting: ${useSSL}`);
    return useSSL;
  }
  
  // Server-side rendering or non-browser environment, use configured setting
  return useSSL;
};

// Create client with timeout settings
const client = new Client(serverKey, finalHost, finalPort, useSSL, 30000, true);

// Enhanced client with secure WebSocket creation
const enhancedClient = Object.create(client);
enhancedClient.createSocket = (useSSL?: boolean, verboseLogging?: boolean, adapter?: WebSocketAdapter): Socket => {
  // Determine the correct WebSocket protocol
  const shouldUseSSL = useSSL !== undefined ? useSSL : detectWebSocketProtocol();
  
  console.log(`Creating WebSocket with SSL: ${shouldUseSSL}`);
  
  // Create socket with the correct SSL setting
  return client.createSocket(shouldUseSSL, verboseLogging, adapter);
};

// Test connection on startup
const testConnection = async () => {
  try {
    const healthUrl = `${useSSL ? 'https' : 'http'}://${host}:${port}/v2/healthcheck`;
    console.log(`Testing connection to: ${healthUrl}`);
    
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
    } else {
      console.error('❌ Nakama health check failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Failed to connect to Nakama server:', error);
    console.log('📝 Troubleshooting tips:');
    console.log('1. Check if Nakama server is running');
    console.log('2. Verify host and port configuration');
    console.log('3. Check firewall settings');
    console.log('4. Ensure server key matches backend');
  }
};

// Test connection in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  testConnection();
}

export default enhancedClient;