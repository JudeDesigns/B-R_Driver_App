/**
 * Enhanced Socket.IO Logging Utility
 * Provides structured logging with context awareness and rate limiting
 */

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  context: 'SERVER' | 'CLIENT' | 'AUTH' | 'CONNECTION';
  message: string;
  metadata?: Record<string, any>;
  clientId?: string;
  userId?: string;
  userRole?: string;
}

interface LogConfig {
  enableConsoleOutput: boolean;
  enableStructuredLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  rateLimitWindow: number; // milliseconds
  maxLogsPerWindow: number;
}

class SocketLogger {
  private config: LogConfig;
  private rateLimitMap: Map<string, { count: number; windowStart: number }>;
  private logBuffer: LogEntry[];
  private maxBufferSize: number;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      enableConsoleOutput: process.env.NODE_ENV !== 'production',
      enableStructuredLogging: process.env.NODE_ENV === 'production',
      logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
      rateLimitWindow: 60000, // 1 minute
      maxLogsPerWindow: 10,
      ...config
    };

    this.rateLimitMap = new Map();
    this.logBuffer = [];
    this.maxBufferSize = 1000;

    // Clean up rate limit map periodically
    setInterval(() => this.cleanupRateLimitMap(), this.config.rateLimitWindow);
  }

  private cleanupRateLimitMap(): void {
    const now = Date.now();
    for (const [key, data] of this.rateLimitMap.entries()) {
      if (now - data.windowStart > this.config.rateLimitWindow) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  private shouldLog(level: string, rateLimitKey?: string): boolean {
    // Check log level
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex < currentLevelIndex) {
      return false;
    }

    // Check rate limiting
    if (rateLimitKey) {
      const now = Date.now();
      const existing = this.rateLimitMap.get(rateLimitKey);

      if (existing) {
        if (now - existing.windowStart > this.config.rateLimitWindow) {
          // Reset window
          this.rateLimitMap.set(rateLimitKey, { count: 1, windowStart: now });
          return true;
        } else if (existing.count >= this.config.maxLogsPerWindow) {
          // Rate limited
          return false;
        } else {
          // Increment count
          existing.count++;
          return true;
        }
      } else {
        // First log for this key
        this.rateLimitMap.set(rateLimitKey, { count: 1, windowStart: now });
        return true;
      }
    }

    return true;
  }

  private createLogEntry(
    level: LogEntry['level'],
    event: string,
    context: LogEntry['context'],
    message: string,
    metadata?: Record<string, any>,
    clientId?: string,
    userId?: string,
    userRole?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      context,
      message,
      metadata,
      clientId,
      userId,
      userRole,
    };
  }

  private outputLog(entry: LogEntry): void {
    // Console output for development
    if (this.config.enableConsoleOutput) {
      const prefix = `[${entry.context}] ${entry.event}:`;
      const suffix = entry.metadata ? JSON.stringify(entry.metadata) : '';
      
      switch (entry.level) {
        case 'debug':
          console.debug(prefix, entry.message, suffix);
          break;
        case 'info':
          console.log(prefix, entry.message, suffix);
          break;
        case 'warn':
          console.warn(prefix, entry.message, suffix);
          break;
        case 'error':
          console.error(prefix, entry.message, suffix);
          break;
      }
    }

    // Structured logging for production
    if (this.config.enableStructuredLogging) {
      console.log(JSON.stringify(entry));
    }

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }
  }

  // Public logging methods
  debug(event: string, message: string, context: LogEntry['context'] = 'CLIENT', metadata?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      this.outputLog(this.createLogEntry('debug', event, context, message, metadata));
    }
  }

  info(event: string, message: string, context: LogEntry['context'] = 'CLIENT', metadata?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      this.outputLog(this.createLogEntry('info', event, context, message, metadata));
    }
  }

  warn(event: string, message: string, context: LogEntry['context'] = 'CLIENT', metadata?: Record<string, any>, rateLimitKey?: string): void {
    if (this.shouldLog('warn', rateLimitKey)) {
      this.outputLog(this.createLogEntry('warn', event, context, message, metadata));
    }
  }

  error(event: string, message: string, context: LogEntry['context'] = 'CLIENT', metadata?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      this.outputLog(this.createLogEntry('error', event, context, message, metadata));
    }
  }

  // Specialized logging methods for Socket.IO events
  logConnection(clientId: string, userId?: string, userRole?: string, success: boolean = true): void {
    const message = success ? 'Client connected successfully' : 'Client connection failed';
    const level = success ? 'info' : 'warn';
    
    if (this.shouldLog(level)) {
      this.outputLog(this.createLogEntry(
        level as LogEntry['level'],
        'CONNECTION',
        'SERVER',
        message,
        { success },
        clientId,
        userId,
        userRole
      ));
    }
  }

  logAuthentication(clientId: string, event: string, success: boolean, errorType?: string, userId?: string, userRole?: string): void {
    const message = success 
      ? `Authentication ${event} successful`
      : `Authentication ${event} failed: ${errorType || 'unknown error'}`;
    
    const level = success ? 'info' : 'warn';
    const rateLimitKey = success ? undefined : `auth_fail_${clientId}`;
    
    if (this.shouldLog(level, rateLimitKey)) {
      this.outputLog(this.createLogEntry(
        level as LogEntry['level'],
        `AUTH_${event.toUpperCase()}`,
        'AUTH',
        message,
        { success, errorType },
        clientId,
        userId,
        userRole
      ));
    }
  }

  logTokenExpiration(clientId: string, userId?: string, gracePeriod: boolean = false): void {
    const message = gracePeriod 
      ? 'Token expired, grace period started'
      : 'Token expired, immediate action required';
    
    const rateLimitKey = `token_expired_${clientId}`;
    
    if (this.shouldLog('warn', rateLimitKey)) {
      this.outputLog(this.createLogEntry(
        'warn',
        'TOKEN_EXPIRED',
        'AUTH',
        message,
        { gracePeriod },
        clientId,
        userId
      ));
    }
  }

  logReconnection(clientId: string, attempt: number, success: boolean, userId?: string): void {
    const message = success 
      ? `Reconnection successful after ${attempt} attempts`
      : `Reconnection attempt ${attempt} failed`;
    
    const level = success ? 'info' : 'warn';
    
    if (this.shouldLog(level)) {
      this.outputLog(this.createLogEntry(
        level as LogEntry['level'],
        'RECONNECTION',
        'CONNECTION',
        message,
        { attempt, success },
        clientId,
        userId
      ));
    }
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Get logs by context
  getLogsByContext(context: LogEntry['context'], count: number = 50): LogEntry[] {
    return this.logBuffer
      .filter(entry => entry.context === context)
      .slice(-count);
  }

  // Export logs for analysis
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  // Clear log buffer
  clearLogs(): void {
    this.logBuffer = [];
  }
}

// Create singleton instance
export const socketLogger = new SocketLogger();

// Export utility functions
export const logSocketConnection = socketLogger.logConnection.bind(socketLogger);
export const logSocketAuth = socketLogger.logAuthentication.bind(socketLogger);
export const logTokenExpiration = socketLogger.logTokenExpiration.bind(socketLogger);
export const logReconnection = socketLogger.logReconnection.bind(socketLogger);

export default socketLogger;
