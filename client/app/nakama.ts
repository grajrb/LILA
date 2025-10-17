// client/app/nakama.ts
import { Client } from "@heroiclabs/nakama-js";

// Configuration for both development and production
const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1";
const port = process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350";
const serverKey = process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || "defaultkey";
const useSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === "true";

console.log(`Nakama Client Config: ${host}:${port} (SSL: ${useSSL})`);
console.log(`Server Key: ${serverKey.substring(0, 8)}...`);

// Create client with timeout settings
const client = new Client(serverKey, host, port, useSSL, 30000, true);

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

export default client;