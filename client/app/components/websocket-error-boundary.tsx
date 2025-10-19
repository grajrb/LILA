// client/app/components/websocket-error-boundary.tsx
"use client";

import React, { Component, ReactNode } from 'react';
import { ErrorClassification } from '../utils/error-classifier';

interface WebSocketErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorClassification?: ErrorClassification;
}

interface WebSocketErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

/**
 * Error boundary specifically designed for WebSocket connection failures
 * Provides user-friendly error messages and recovery options
 */
export class WebSocketErrorBoundary extends Component<WebSocketErrorBoundaryProps, WebSocketErrorBoundaryState> {
  constructor(props: WebSocketErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WebSocketErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('WebSocket Error Boundary caught an error:', error, errorInfo);
    
    // Classify the error for better user experience
    const errorClassification = this.classifyWebSocketError(error);
    
    this.setState({
      error,
      errorInfo,
      errorClassification
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private classifyWebSocketError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    
    // Check for WebSocket-specific errors
    if (message.includes('websocket') || message.includes('ws://') || message.includes('wss://')) {
      if (message.includes('mixed content') || message.includes('insecure')) {
        return {
          type: 'security',
          severity: 'high',
          userMessage: 'Connection blocked due to security policy. The app will automatically use a secure connection.',
          technicalMessage: error.message,
          suggestedAction: 'The connection will be retried automatically with secure protocol.',
          retryable: true
        };
      }
      
      if (message.includes('connection refused') || message.includes('network')) {
        return {
          type: 'network',
          severity: 'medium',
          userMessage: 'Unable to connect to the game server. Please check your internet connection.',
          technicalMessage: error.message,
          suggestedAction: 'Check your internet connection and try again.',
          retryable: true
        };
      }
      
      if (message.includes('timeout')) {
        return {
          type: 'network',
          severity: 'medium',
          userMessage: 'Connection timed out. The server might be busy.',
          technicalMessage: error.message,
          suggestedAction: 'Wait a moment and try again.',
          retryable: true
        };
      }
    }
    
    // Generic error classification
    return {
      type: 'unknown',
      severity: 'medium',
      userMessage: 'An unexpected error occurred while connecting to the game server.',
      technicalMessage: error.message,
      suggestedAction: 'Try refreshing the page or contact support if the problem persists.',
      retryable: true
    };
  }

  private handleRetry = () => {
    // Reset the error boundary state
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorClassification: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI
      const classification = this.state.errorClassification;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-8">
          <div className="max-w-md w-full">
            <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-6">
              {/* Error Icon */}
              <div className="flex items-center justify-center w-12 h-12 bg-red-600 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>

              {/* Error Title */}
              <h2 className="text-xl font-bold text-center mb-4">
                {classification?.type === 'security' ? 'Security Issue' :
                 classification?.type === 'network' ? 'Connection Problem' :
                 'Connection Error'}
              </h2>

              {/* User-friendly message */}
              <p className="text-gray-300 text-center mb-6">
                {classification?.userMessage || 'An unexpected error occurred while connecting to the game server.'}
              </p>

              {/* Suggested action */}
              {classification?.suggestedAction && (
                <div className="bg-blue-600/20 border border-blue-600/30 rounded p-3 mb-6">
                  <p className="text-sm text-blue-200">
                    💡 {classification.suggestedAction}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                {classification?.retryable && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                  >
                    Try Again
                  </button>
                )}
                
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Refresh Page
                </button>
              </div>

              {/* Technical details (development only) */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                    Technical Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-800/50 rounded text-xs font-mono">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.name}
                    </div>
                    <div className="mb-2">
                      <strong>Message:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WebSocketErrorBoundary;