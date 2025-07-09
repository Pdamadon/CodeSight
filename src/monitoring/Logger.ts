import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  correlationId?: string;
}

export interface LogConfig {
  logLevel: LogLevel;
  logDir: string;
  maxFileSize: number; // bytes
  maxFiles: number;
  enableConsole: boolean;
  enableFile: boolean;
  enableStructured: boolean;
}

export class Logger {
  private static instance: Logger;
  private config: LogConfig;
  private currentLogFile: string;
  private currentFileSize: number = 0;
  private correlationId: string | null = null;

  private constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      logLevel: LogLevel.INFO,
      logDir: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      enableConsole: true,
      enableFile: true,
      enableStructured: true,
      ...config
    };

    this.ensureLogDir();
    this.currentLogFile = this.getLogFileName();
  }

  static getInstance(config?: Partial<LogConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  clearCorrelationId(): void {
    this.correlationId = null;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level < this.config.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      error,
      correlationId: this.correlationId || undefined
    };

    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.config.enableFile) {
      this.logToFile(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const correlationStr = entry.correlationId ? `[${entry.correlationId}] ` : '';
    
    let output = `${timestamp} [${levelStr}] ${correlationStr}${entry.message}`;
    
    if (entry.context) {
      output += ` | Context: ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      output += ` | Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
    }
  }

  private logToFile(entry: LogEntry): void {
    const logLine = this.config.enableStructured 
      ? JSON.stringify(entry) + '\n'
      : this.formatLogLine(entry);

    try {
      appendFileSync(this.currentLogFile, logLine);
      this.currentFileSize += Buffer.byteLength(logLine);

      if (this.currentFileSize > this.config.maxFileSize) {
        this.rotateLogFile();
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private formatLogLine(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const correlationStr = entry.correlationId ? `[${entry.correlationId}] ` : '';
    
    let line = `${timestamp} [${levelStr}] ${correlationStr}${entry.message}`;
    
    if (entry.context) {
      line += ` | Context: ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error) {
      line += ` | Error: ${entry.error.message}`;
      if (entry.error.stack) {
        line += `\n${entry.error.stack}`;
      }
    }
    
    return line + '\n';
  }

  private rotateLogFile(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = join(this.config.logDir, `codesight-${timestamp}.log`);
    
    try {
      // Rename current log file
      if (existsSync(this.currentLogFile)) {
        const fs = require('fs');
        fs.renameSync(this.currentLogFile, rotatedFile);
      }
      
      // Clean up old log files
      this.cleanupOldLogs();
      
      // Create new log file
      this.currentLogFile = this.getLogFileName();
      this.currentFileSize = 0;
      
      this.info('Log file rotated', { rotatedFile });
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private cleanupOldLogs(): void {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(this.config.logDir)
        .filter((file: string) => file.startsWith('codesight-') && file.endsWith('.log'))
        .map((file: string) => ({
          name: file,
          path: join(this.config.logDir, file),
          mtime: fs.statSync(join(this.config.logDir, file)).mtime
        }))
        .sort((a: any, b: any) => b.mtime - a.mtime);

      // Keep only the most recent files
      const filesToDelete = files.slice(this.config.maxFiles);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  private ensureLogDir(): void {
    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return join(this.config.logDir, `codesight-${date}.log`);
  }

  // Performance monitoring methods
  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`Timer: ${label}`, { duration });
    };
  }

  // Memory monitoring
  logMemoryUsage(label?: string): void {
    const usage = process.memoryUsage();
    this.info(`Memory usage${label ? ` - ${label}` : ''}`, {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    });
  }

  // Structured logging for specific events
  logScrapeAttempt(url: string, targets: string[], correlationId: string): void {
    this.setCorrelationId(correlationId);
    this.info('Scrape attempt started', { url, targets, correlationId });
  }

  logScrapeSuccess(url: string, duration: number, dataPoints: number): void {
    this.info('Scrape completed successfully', { url, duration, dataPoints });
    this.clearCorrelationId();
  }

  logScrapeFailure(url: string, error: string, duration: number): void {
    this.error('Scrape failed', new Error(error), { url, duration });
    this.clearCorrelationId();
  }

  logInteraction(type: string, selector: string, success: boolean): void {
    this.info('Interaction executed', { type, selector, success });
  }

  logLearningEvent(event: string, context: Record<string, any>): void {
    this.info(`Learning: ${event}`, context);
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 100): LogEntry[] {
    if (!this.config.enableStructured || !existsSync(this.currentLogFile)) {
      return [];
    }

    try {
      const fs = require('fs');
      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      const lines = content.trim().split('\n');
      
      return lines
        .slice(-count)
        .map((line: string) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((entry: any) => entry !== null);
    } catch (error) {
      console.error('Failed to read recent logs:', error);
      return [];
    }
  }
}