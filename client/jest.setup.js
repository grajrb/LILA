// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Mock WebSocket for testing
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Simulate connection behavior
    setTimeout(() => {
      if (url.includes('invalid') || url.includes('error')) {
        this.readyState = WebSocket.CLOSED;
        if (this.onerror) {
          this.onerror(new Error('Connection failed'));
        }
      } else {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) {
          this.onopen();
        }
      }
    }, 10);
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal closure' });
    }
  }
  
  send(data) {
    // Mock send method
  }
};

// WebSocket constants
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;