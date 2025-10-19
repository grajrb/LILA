// client/app/utils/connection-monitor.ts

export interface ConnectionAttemptLog {
  id: string;
  timestamp: Date;
  type: 'websocket' | 'authentication' | 'matchmaking';
  status: 'attempting' | 'success' | 'failed' | 'timeout';
  url?: string;
  protocol?: string;
  duration?: number;
  error?: string;
  retryAttempt?: number;
  userAgent?: string;
  networkInfo?: NetworkInfo;
}

export interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface ConnectionMetrics {
  totalAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  lastSuccessfulConnection?: Date;
  lastFailedConnection?: Date;
  currentStreak: { type: 'success' | 'failure'; count: number };
  errorFrequency: { [errorType: string]: number };
}

export interface MonitoringConfig {
  maxLogEntries: number;
  enableNetworkInfo: boolean;
  enablePerformanceTracking: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * ConnectionMonitor tracks and logs all connection attempts with detailed metrics
 */
export class ConnectionMonitor {
  private logs: ConnectionAttemptLog[] = [];
  private config: MonitoringConfig;
  private activeAttempts: Map<string, ConnectionAttemptLog> = new Map();

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      maxLogEntries: 100,
      enableNetworkInfo: true,
      enablePerformanceTracking: true,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      ...config
    };
  }

  /**
   * Starts tracking a new connection attempt
   * @param type - Type of connection being attempted
   * @param url - URL being connected to
   * @param protocol - Protocol being used
   * @param retryAttempt - Retry attempt number (0 for first attempt)
   * @returns Attempt ID for tracking
   */
  public startAttempt(
    type: ConnectionAttemptLog['type'],
    url?: string,
    protocol?: string,
    retryAttempt?: number
  ): string {
    const attemptId = this.generateAttemptId();
    const networkInfo = this.config.enableNetworkInfo ? this.getNetworkInfo() : undefined;
    
    const attempt: ConnectionAttemptLog = {
      id: attemptId,
      timestamp: new Date(),
      type,
      status: 'attempting',
      url,
      protocol,
      retryAttempt,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      networkInfo
    };

    this.activeAttempts.set(attemptId, attempt);
    this.log('info', `Starting ${type} connection attempt`, { attemptId, url, protocol, retryAttempt });

    return attemptId;
  }

  /**
   * Marks a connection attempt as successful
   * @param attemptId - The attempt ID returned by startAttempt
   * @param additionalInfo - Additional information about the successful connection
   */
  public markSuccess(attemptId: string, additionalInfo?: Record<string, any>): void {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {
      this.log('warn', `Attempt ${attemptId} not found when marking success`);
      return;
    }

    const duration = Date.now() - attempt.timestamp.getTime();
    const completedAttempt: ConnectionAttemptLog = {
      ...attempt,
      status: 'success',
      duration
    };

    this.activeAttempts.delete(attemptId);
    this.addToLogs(completedAttempt);

    this.log('info', `${attempt.type} connection successful`, {
      attemptId,
      duration: `${duration}ms`,
      url: attempt.url,
      protocol: attempt.protocol,
      retryAttempt: attempt.retryAttempt,
      ...additionalInfo
    });
  }

  /**
   * Marks a connection attempt as failed
   * @param attemptId - The attempt ID returned by startAttempt
   * @param error - Error that caused the failure
   * @param additionalInfo - Additional information about the failure
   */
  public markFailure(attemptId: string, error: Error | string, additionalInfo?: Record<string, any>): void {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {
      this.log('warn', `Attempt ${attemptId} not found when marking failure`);
      return;
    }

    const duration = Date.now() - attempt.timestamp.getTime();
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    const completedAttempt: ConnectionAttemptLog = {
      ...attempt,
      status: 'failed',
      duration,
      error: errorMessage
    };

    this.activeAttempts.delete(attemptId);
    this.addToLogs(completedAttempt);

    this.log('error', `${attempt.type} connection failed`, {
      attemptId,
      duration: `${duration}ms`,
      error: errorMessage,
      url: attempt.url,
      protocol: attempt.protocol,
      retryAttempt: attempt.retryAttempt,
      ...additionalInfo
    });
  }

  /**
   * Marks a connection attempt as timed out
   * @param attemptId - The attempt ID returned by startAttempt
   * @param timeoutDuration - How long the attempt ran before timing out
   */
  public markTimeout(attemptId: string, timeoutDuration: number): void {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {
      this.log('warn', `Attempt ${attemptId} not found when marking timeout`);
      return;
    }

    const completedAttempt: ConnectionAttemptLog = {
      ...attempt,
      status: 'timeout',
      duration: timeoutDuration,
      error: `Connection timed out after ${timeoutDuration}ms`
    };

    this.activeAttempts.delete(attemptId);
    this.addToLogs(completedAttempt);

    this.log('warn', `${attempt.type} connection timed out`, {
      attemptId,
      duration: `${timeoutDuration}ms`,
      url: attempt.url,
      protocol: attempt.protocol,
      retryAttempt: attempt.retryAttempt
    });
  }

  /**
   * Gets comprehensive connection metrics
   * @returns ConnectionMetrics with detailed statistics
   */
  public getMetrics(): ConnectionMetrics {
    const attempts = this.logs;
    const totalAttempts = attempts.length;
    const successfulConnections = attempts.filter(a => a.status === 'success').length;
    const failedConnections = attempts.filter(a => a.status === 'failed' || a.status === 'timeout').length;
    
    // Calculate average connection time for successful connections
    const successfulAttempts = attempts.filter(a => a.status === 'success' && a.duration);
    const averageConnectionTime = successfulAttempts.length > 0
      ? successfulAttempts.reduce((sum, a) => sum + (a.duration || 0), 0) / successfulAttempts.length
      : 0;

    // Find last successful and failed connections
    const lastSuccessfulConnection = attempts
      .filter(a => a.status === 'success')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp;

    const lastFailedConnection = attempts
      .filter(a => a.status === 'failed' || a.status === 'timeout')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp;

    // Calculate current streak
    const currentStreak = this.calculateCurrentStreak();

    // Calculate error frequency
    const errorFrequency: { [errorType: string]: number } = {};
    attempts
      .filter(a => a.error)
      .forEach(a => {
        const errorType = this.categorizeError(a.error!);
        errorFrequency[errorType] = (errorFrequency[errorType] || 0) + 1;
      });

    return {
      totalAttempts,
      successfulConnections,
      failedConnections,
      averageConnectionTime,
      lastSuccessfulConnection,
      lastFailedConnection,
      currentStreak,
      errorFrequency
    };
  }

  /**
   * Gets recent connection logs
   * @param limit - Maximum number of logs to return
   * @returns Array of recent connection attempts
   */
  public getRecentLogs(limit: number = 10): ConnectionAttemptLog[] {
    return this.logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Gets logs filtered by criteria
   * @param filter - Filter criteria
   * @returns Filtered connection logs
   */
  public getFilteredLogs(filter: {
    type?: ConnectionAttemptLog['type'];
    status?: ConnectionAttemptLog['status'];
    since?: Date;
    protocol?: string;
  }): ConnectionAttemptLog[] {
    return this.logs.filter(log => {
      if (filter.type && log.type !== filter.type) return false;
      if (filter.status && log.status !== filter.status) return false;
      if (filter.since && log.timestamp < filter.since) return false;
      if (filter.protocol && log.protocol !== filter.protocol) return false;
      return true;
    });
  }

  /**
   * Exports logs for debugging or analysis
   * @param format - Export format
   * @returns Formatted log data
   */
  public exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'type', 'status', 'url', 'protocol', 'duration', 'error', 'retryAttempt'];
      const csvRows = [
        headers.join(','),
        ...this.logs.map(log => [
          log.timestamp.toISOString(),
          log.type,
          log.status,
          log.url || '',
          log.protocol || '',
          log.duration || '',
          log.error || '',
          log.retryAttempt || ''
        ].map(field => `"${field}"`).join(','))
      ];
      return csvRows.join('\n');
    }

    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clears all logs and resets metrics
   */
  public clearLogs(): void {
    this.logs = [];
    this.activeAttempts.clear();
    this.log('info', 'Connection logs cleared');
  }

  /**
   * Gets debug information for troubleshooting
   * @returns Debug information object
   */
  public getDebugInfo(): Record<string, any> {
    const metrics = this.getMetrics();
    const recentLogs = this.getRecentLogs(5);
    const networkInfo = this.getNetworkInfo();

    return {
      timestamp: new Date().toISOString(),
      metrics,
      recentLogs,
      networkInfo,
      activeAttempts: Array.from(this.activeAttempts.values()),
      config: this.config,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server-side',
      pageUrl: typeof window !== 'undefined' ? window.location.href : 'server-side'
    };
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToLogs(attempt: ConnectionAttemptLog): void {
    this.logs.push(attempt);
    
    // Keep only the most recent logs to prevent memory issues
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }
  }

  private getNetworkInfo(): NetworkInfo | undefined {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return undefined;
    }

    const connection = (navigator as any).connection;
    if (!connection) return undefined;

    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }

  private calculateCurrentStreak(): { type: 'success' | 'failure'; count: number } {
    if (this.logs.length === 0) {
      return { type: 'success', count: 0 };
    }

    const sortedLogs = this.logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const latestStatus = sortedLogs[0].status;
    const streakType: 'success' | 'failure' = latestStatus === 'success' ? 'success' : 'failure';
    
    let count = 0;
    for (const log of sortedLogs) {
      if ((streakType === 'success' && log.status === 'success') ||
          (streakType === 'failure' && (log.status === 'failed' || log.status === 'timeout'))) {
        count++;
      } else {
        break;
      }
    }

    return { type: streakType, count };
  }

  private categorizeError(error: string): string {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('mixed content') || lowerError.includes('security')) {
      return 'security';
    }
    if (lowerError.includes('timeout')) {
      return 'timeout';
    }
    if (lowerError.includes('network') || lowerError.includes('connection refused')) {
      return 'network';
    }
    if (lowerError.includes('authentication') || lowerError.includes('unauthorized')) {
      return 'authentication';
    }
    if (lowerError.includes('server') || lowerError.includes('5')) {
      return 'server';
    }
    
    return 'unknown';
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = logLevels[this.config.logLevel];
    const messageLevel = logLevels[level];

    if (messageLevel < configLevel) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[ConnectionMonitor] ${timestamp} ${level.toUpperCase()}: ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
    }
  }
}