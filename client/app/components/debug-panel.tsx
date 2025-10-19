// client/app/components/debug-panel.tsx
"use client";

import { useState, useEffect } from 'react';
import { ConnectionMonitor, ConnectionMetrics, ConnectionAttemptLog } from '../utils/connection-monitor';

export interface DebugPanelProps {
  monitor: ConnectionMonitor;
  isVisible?: boolean;
  onToggle?: () => void;
}

export default function DebugPanel({ monitor, isVisible = false, onToggle }: DebugPanelProps) {
  const [metrics, setMetrics] = useState<ConnectionMetrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<ConnectionAttemptLog[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'logs' | 'debug'>('metrics');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Refresh data
  const refreshData = () => {
    setMetrics(monitor.getMetrics());
    setRecentLogs(monitor.getRecentLogs(20));
    setDebugInfo(monitor.getDebugInfo());
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!isVisible || !autoRefresh) return;

    refreshData();
    const interval = setInterval(refreshData, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [isVisible, autoRefresh, monitor]);

  // Manual refresh
  useEffect(() => {
    if (isVisible) {
      refreshData();
    }
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors z-50"
      >
        🔍 Debug
      </button>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const getStatusColor = (status: ConnectionAttemptLog['status']) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'timeout': return 'text-yellow-400';
      case 'attempting': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: ConnectionAttemptLog['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'timeout': return '⏱️';
      case 'attempting': return '🔄';
      default: return '❓';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 w-96 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white">Connection Debug</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-2 py-1 rounded ${
              autoRefresh ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
            }`}
          >
            {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
          </button>
          <button
            onClick={refreshData}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['metrics', 'logs', 'debug'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
              activeTab === tab
                ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 overflow-y-auto max-h-64">
        {/* Metrics Tab */}
        {activeTab === 'metrics' && metrics && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Total Attempts</div>
                <div className="text-white font-semibold">{metrics.totalAttempts}</div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Success Rate</div>
                <div className="text-green-400 font-semibold">
                  {metrics.totalAttempts > 0 
                    ? `${Math.round((metrics.successfulConnections / metrics.totalAttempts) * 100)}%`
                    : '0%'
                  }
                </div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Avg Time</div>
                <div className="text-blue-400 font-semibold">
                  {formatDuration(metrics.averageConnectionTime)}
                </div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Current Streak</div>
                <div className={`font-semibold ${
                  metrics.currentStreak.type === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {metrics.currentStreak.count} {metrics.currentStreak.type}
                </div>
              </div>
            </div>

            {/* Error Frequency */}
            {Object.keys(metrics.errorFrequency).length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-2">Error Types</div>
                <div className="space-y-1">
                  {Object.entries(metrics.errorFrequency).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-xs">
                      <span className="text-gray-300 capitalize">{type}</span>
                      <span className="text-red-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Connection Times */}
            <div className="space-y-1 text-xs">
              {metrics.lastSuccessfulConnection && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Success</span>
                  <span className="text-green-400">
                    {formatTimestamp(metrics.lastSuccessfulConnection)}
                  </span>
                </div>
              )}
              {metrics.lastFailedConnection && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Failure</span>
                  <span className="text-red-400">
                    {formatTimestamp(metrics.lastFailedConnection)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-2">
            {recentLogs.length === 0 ? (
              <div className="text-gray-400 text-xs text-center py-4">
                No connection logs yet
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="bg-gray-800 p-2 rounded text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span>{getStatusIcon(log.status)}</span>
                      <span className="text-gray-300 capitalize">{log.type}</span>
                      {log.retryAttempt !== undefined && log.retryAttempt > 0 && (
                        <span className="text-yellow-400">#{log.retryAttempt + 1}</span>
                      )}
                    </div>
                    <span className="text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`capitalize ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                    {log.duration && (
                      <span className="text-gray-400">
                        {formatDuration(log.duration)}
                      </span>
                    )}
                  </div>

                  {log.protocol && (
                    <div className="text-gray-500 mt-1">
                      Protocol: {log.protocol.toUpperCase()}
                    </div>
                  )}

                  {log.error && (
                    <div className="text-red-400 mt-1 text-xs break-words">
                      {log.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Debug Tab */}
        {activeTab === 'debug' && debugInfo && (
          <div className="space-y-3">
            {/* Network Info */}
            {debugInfo.networkInfo && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Network</div>
                <div className="bg-gray-800 p-2 rounded text-xs">
                  <div>Type: {debugInfo.networkInfo.effectiveType || 'unknown'}</div>
                  {debugInfo.networkInfo.downlink && (
                    <div>Speed: {debugInfo.networkInfo.downlink} Mbps</div>
                  )}
                  {debugInfo.networkInfo.rtt && (
                    <div>RTT: {debugInfo.networkInfo.rtt}ms</div>
                  )}
                </div>
              </div>
            )}

            {/* Active Attempts */}
            {debugInfo.activeAttempts && debugInfo.activeAttempts.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Active Attempts</div>
                <div className="bg-gray-800 p-2 rounded text-xs">
                  {debugInfo.activeAttempts.map((attempt: ConnectionAttemptLog) => (
                    <div key={attempt.id} className="flex justify-between">
                      <span>{attempt.type}</span>
                      <span className="text-blue-400">
                        {formatDuration(Date.now() - attempt.timestamp.getTime())}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Options */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Export</div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const data = monitor.exportLogs('json');
                    navigator.clipboard.writeText(data);
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copy JSON
                </button>
                <button
                  onClick={() => {
                    const data = monitor.exportLogs('csv');
                    navigator.clipboard.writeText(data);
                  }}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Copy CSV
                </button>
                <button
                  onClick={() => monitor.clearLogs()}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}