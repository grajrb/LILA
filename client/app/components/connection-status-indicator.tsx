// client/app/components/connection-status-indicator.tsx
"use client";

import { useState, useEffect } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'retrying';

export interface ConnectionStatusIndicatorProps {
  status: ConnectionState;
  protocol?: 'ws' | 'wss';
  errorMessage?: string;
  onRetry?: () => void;
  showProtocol?: boolean;
  showTroubleshooting?: boolean;
  retryCountdown?: number;
}

/**
 * Visual connection status indicator with animated states and troubleshooting tips
 */
export default function ConnectionStatusIndicator({
  status,
  protocol,
  errorMessage,
  onRetry,
  showProtocol = false,
  showTroubleshooting = false,
  retryCountdown = 0
}: ConnectionStatusIndicatorProps) {
  const [showTips, setShowTips] = useState(false);

  // Get status configuration
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-400',
          icon: '✅',
          label: 'Connected',
          description: 'Real-time connection active',
          animate: 'animate-pulse'
        };
      case 'connecting':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400',
          icon: '🔄',
          label: 'Connecting',
          description: 'Establishing connection...',
          animate: 'animate-spin'
        };
      case 'retrying':
        return {
          color: 'text-blue-400',
          bgColor: 'bg-blue-400',
          icon: '🔄',
          label: retryCountdown > 0 ? `Retrying (${retryCountdown}s)` : 'Retrying',
          description: 'Attempting to reconnect...',
          animate: 'animate-spin'
        };
      case 'error':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-400',
          icon: '❌',
          label: 'Connection Failed',
          description: errorMessage || 'Unable to connect to server',
          animate: ''
        };
      case 'disconnected':
      default:
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-400',
          icon: '⚪',
          label: 'Disconnected',
          description: 'Not connected to server',
          animate: ''
        };
    }
  };

  const config = getStatusConfig();

  // Troubleshooting tips based on status and protocol
  const getTroubleshootingTips = () => {
    const tips = [];

    if (status === 'error') {
      if (errorMessage?.toLowerCase().includes('mixed content')) {
        tips.push('🔒 Security policy requires secure connections (HTTPS/WSS)');
        tips.push('🔄 The app will automatically retry with secure protocol');
      } else if (errorMessage?.toLowerCase().includes('network')) {
        tips.push('🌐 Check your internet connection');
        tips.push('🔥 Verify firewall settings allow WebSocket connections');
        tips.push('🔄 Try refreshing the page');
      } else if (errorMessage?.toLowerCase().includes('timeout')) {
        tips.push('⏱️ Server response timed out');
        tips.push('🚀 Server might be starting up or busy');
        tips.push('⏳ Wait a moment and try again');
      } else {
        tips.push('🔄 Try refreshing the page');
        tips.push('🌐 Check your internet connection');
        tips.push('📞 Contact support if problem persists');
      }
    } else if (status === 'connecting' || status === 'retrying') {
      tips.push('⏳ Please wait while we establish connection');
      if (protocol === 'wss') {
        tips.push('🔒 Using secure WebSocket connection');
      } else if (protocol === 'ws') {
        tips.push('⚠️ Using insecure WebSocket connection');
      }
    }

    return tips;
  };

  const troubleshootingTips = getTroubleshootingTips();

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      {/* Main Status Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Status Indicator */}
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${config.bgColor} ${config.animate}`}></div>
            {status === 'connected' && (
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75"></div>
            )}
          </div>

          {/* Status Text */}
          <div>
            <div className={`font-semibold ${config.color}`}>
              {config.label}
            </div>
            <div className="text-sm text-gray-400">
              {config.description}
            </div>
          </div>
        </div>

        {/* Protocol Badge */}
        {showProtocol && protocol && (
          <div className={`px-2 py-1 rounded text-xs font-mono ${
            protocol === 'wss' 
              ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
              : 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
          }`}>
            {protocol.toUpperCase()}
            {protocol === 'wss' && <span className="ml-1">🔒</span>}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {(status === 'error' || status === 'disconnected') && (
        <div className="mt-4 flex items-center space-x-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors"
            >
              Retry Connection
            </button>
          )}
          
          {showTroubleshooting && troubleshootingTips.length > 0 && (
            <button
              onClick={() => setShowTips(!showTips)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
            >
              {showTips ? 'Hide Tips' : 'Troubleshooting'}
            </button>
          )}
        </div>
      )}

      {/* Troubleshooting Tips */}
      {showTips && troubleshootingTips.length > 0 && (
        <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/20 rounded-lg">
          <div className="text-sm font-semibold text-blue-400 mb-2">
            💡 Troubleshooting Tips
          </div>
          <ul className="space-y-1">
            {troubleshootingTips.map((tip, index) => (
              <li key={index} className="text-sm text-gray-300">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Connection Progress (for connecting/retrying states) */}
      {(status === 'connecting' || status === 'retrying') && (
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}