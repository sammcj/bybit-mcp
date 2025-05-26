/**
 * Log Service - Captures and streams application logs for debugging
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  source?: string;
}

export class LogService {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();
  private maxLogs = 1000; // Keep last 1000 logs
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    // Intercept console methods
    this.interceptConsole();
  }

  private interceptConsole(): void {
    const self = this;

    console.log = function(...args: any[]) {
      self.addLog('log', self.formatMessage(args), args.length > 1 ? args.slice(1) : undefined);
      self.originalConsole.log(...args);
    };

    console.info = function(...args: any[]) {
      self.addLog('info', self.formatMessage(args), args.length > 1 ? args.slice(1) : undefined);
      self.originalConsole.info(...args);
    };

    console.warn = function(...args: any[]) {
      self.addLog('warn', self.formatMessage(args), args.length > 1 ? args.slice(1) : undefined);
      self.originalConsole.warn(...args);
    };

    console.error = function(...args: any[]) {
      self.addLog('error', self.formatMessage(args), args.length > 1 ? args.slice(1) : undefined);
      self.originalConsole.error(...args);
    };

    console.debug = function(...args: any[]) {
      self.addLog('debug', self.formatMessage(args), args.length > 1 ? args.slice(1) : undefined);
      self.originalConsole.debug(...args);
    };
  }

  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') {
        return arg;
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      } else {
        return String(arg);
      }
    }).join(' ');
  }

  private addLog(level: LogEntry['level'], message: string, data?: any): void {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      data,
      source: this.getSource()
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.notifyListeners();
  }

  private getSource(): string {
    try {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n');
        // Find the first line that's not from this service
        for (let i = 3; i < lines.length; i++) {
          const line = lines[i];
          if (line && !line.includes('logService.ts') && !line.includes('console.')) {
            const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
            if (match) {
              const [, , file, lineNum] = match;
              const fileName = file.split('/').pop() || file;
              return `${fileName}:${lineNum}`;
            }
          }
        }
      }
    } catch {
      // Ignore errors in source detection
    }
    return 'unknown';
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(levels: LogEntry['level'][]): LogEntry[] {
    return this.logs.filter(log => levels.includes(log.level));
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.notifyListeners();
  }

  /**
   * Subscribe to log updates
   */
  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Export logs as text
   */
  exportLogs(): string {
    return this.logs.map(log => {
      const time = new Date(log.timestamp).toISOString();
      const level = log.level.toUpperCase().padEnd(5);
      const source = log.source ? ` [${log.source}]` : '';
      return `${time} ${level}${source} ${log.message}`;
    }).join('\n');
  }

  /**
   * Add a custom log entry
   */
  addCustomLog(level: LogEntry['level'], message: string, data?: any): void {
    this.addLog(level, message, data);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.logs]);
      } catch (error) {
        this.originalConsole.error('Error in log listener:', error);
      }
    });
  }

  /**
   * Restore original console methods
   */
  restore(): void {
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
  }
}

// Create singleton instance
export const logService = new LogService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    logService.restore();
  });
}
