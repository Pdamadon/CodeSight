export declare enum LogLevel {
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
    maxFileSize: number;
    maxFiles: number;
    enableConsole: boolean;
    enableFile: boolean;
    enableStructured: boolean;
}
export declare class Logger {
    private static instance;
    private config;
    private currentLogFile;
    private currentFileSize;
    private correlationId;
    private constructor();
    static getInstance(config?: Partial<LogConfig>): Logger;
    setCorrelationId(id: string): void;
    clearCorrelationId(): void;
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;
    private log;
    private logToConsole;
    private logToFile;
    private formatLogLine;
    private rotateLogFile;
    private cleanupOldLogs;
    private ensureLogDir;
    private getLogFileName;
    startTimer(label: string): () => void;
    logMemoryUsage(label?: string): void;
    logScrapeAttempt(url: string, targets: string[], correlationId: string): void;
    logScrapeSuccess(url: string, duration: number, dataPoints: number): void;
    logScrapeFailure(url: string, error: string, duration: number): void;
    logInteraction(type: string, selector: string, success: boolean): void;
    logLearningEvent(event: string, context: Record<string, any>): void;
    getRecentLogs(count?: number): LogEntry[];
}
//# sourceMappingURL=Logger.d.ts.map