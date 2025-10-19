// client/app/components/connection-status.tsx
"use client";

import { useState, useEffect } from 'react';
import { ErrorClassification } from '../utils/error-classifier';

export interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  error?: ErrorClassification | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  showDebugInfo?: boolean;
  connectionAttempts?: number;
  lastConnectionTime?: Date;
}

export default function ConnectionStatus({
  isConnected,
  isConnecting,
  error,
  onRetry,
  onDismissError,
  showDebugInfo = false,
  connectionAttempts = 0,
  lastConnectionTime
}: ConnectionStatusProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);

  // Handle retry with countdown
  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  // Auto-retry countdown effect
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown(retryCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (retryCountdown === 0 && error && error.retryable && onRetry) {
      // Auto-retry when countdown reaches 0
      handleRetry();
    }
  }, [retryCountdown, error, onRetry]);

  // Start countdown for retryable errors
  useEffect(() => {
    if (error && error.retryable && !isRetrying && !isConnecting) {
      // Start countdown based on error type
      const delay = error.type === 'security' ? 3 : 
                   error.type === 'network' ? 5 : 
                   error.type === 'server' ? 8 : 5;
      setRetryCountdown(delay);
    }
  }, [error, isRetrying, isConnecting]);

  // Get status indicator
  const getStatusIndicator = () => {
    if (isConnecting || isRetrying) {
      return (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
          <span className="text-yellow-400">
            {isRetrying ? 'Retrying...' : 'Connecting...'}
          </span>
        </div>
      );
    }

    if (isConnected) {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400">Connected</span>
        </div>
      );
    }

    if (error) {
      const statusColor = error.severity === 'critical' ? 'text-red-400' :
                         error.severity === 'high' ? 'text-red-400' :
                         error.severity === 'medium' ? 'text-yellow-400' : 'text-gray-400';
      
      return (
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            error.severity === 'critical' ? 'bg-red-500' :
            error.severity === 'high' ? 'bg-red-400' :
            error.severity === 'medium' ? 'bg-yellow-400' : 'bg-gray-400'
          }`}></div>
          <span className={statusColor}>
            {error.type === 'security' ? 'Security Issue' :
             error.type === 'network' ? 'Network Issue' :
             error.type === 'authentication' ? 'Auth Issue' :
             error.type === 'server' ? 'Server Issue' : 'Connection Issue'}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
        <span className="text-gray-400">Disconnected</span>
      </div>
    );
  };

  // Get status color for container
  const getContainerColor = () => {
    if (isConnecting || isRetrying) return 'bg-yellow-600/20 border-yellow-600/30';
    if (isConnected) return 'bg-green-600/20 border-green-600/30';
    if (error) {
      return error.severity === 'critical' ? 'bg-red-600/20 border-red-600/30' :
             error.severity === 'high' ? 'bg-red-600/20 border-red-600/30' :
             error.severity === 'medium' ? 'bg-yellow-600/20 border-yellow-600/30' : 
             'bg-gray-600/20 border-gray-600/30';
    }
    return 'bg-gray-600/20 border-gray-600/30';
  };

  return (
    <div className={`rounded-lg border p-3 ${getContainerColor()}`}>
      {/* Main Status */}
      <div className="flex items-center justify-between">
        {getStatusIndicator()}
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {error && onDismissError && (
            <button
              onClick={onDismissError}
              className="text-xs text-gray-400 hover:text-gray-300 underline"
            >
              Dismiss
            </button>
          )}
          
          {error && error.retryable && onRetry && !isRetrying && !isConnecting && (
            <button
              onClick={handleRetry}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              {retryCountdown > 0 ? `Retry (${retryCountdown}s)` : 'Retry Now'}
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 space-y-2">
          <div className="text-sm text-gray-200">
            {error.userMessage}
          </div>
          
          {error.suggestedAction && (
            <div className="text-xs text-gray-400 italic">
              💡 {error.suggestedAction}
            </div>
          )}
          
          {showDebugInfo && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400">
                Technical Details
              </summary>
              <div className="mt-2 p-2 bg-gray-800/50 rounded font-mono">
                <div><strong>Type:</strong> {error.type}</div>
                <div><strong>Severity:</strong> {error.severity}</div>
                <div><strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}</div>
                <div><strong>Message:</strong> {error.technicalMessage}</div>
                {connectionAttempts > 0 && (
                  <div><strong>Attempts:</strong> {connectionAttempts}</div>
                )}
                {lastConnectionTime && (
                  <div><strong>Last Attempt:</strong> {lastConnectionTime.toLocaleTimeString()}</div>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Debug Info (when connected) */}
      {showDebugInfo && isConnected && (
        <div className="mt-3 text-xs text-gray-500">
          <details>
            <summary className="cursor-pointer hover:text-gray-400">
              Connection Details
            </summary>
            <div className="mt-2 p-2 bg-gray-800/50 rounded font-mono">
              {connectionAttempts > 0 && (
                <div><strong>Total Attempts:</strong> {connectionAttempts}</div>
              )}
              {lastConnectionTime && (
                <div><strong>Connected At:</strong> {lastConnectionTime.toLocaleTimeString()}</div>
              )}
              <div><strong>Status:</strong> Connected and Ready</div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}