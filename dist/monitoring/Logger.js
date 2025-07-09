import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
export class Logger {
    static instance;
    config;
    currentLogFile;
    currentFileSize = 0;
    correlationId = null;
    constructor(config = {}) {
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
    static getInstance(config) {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }
    setCorrelationId(id) {
        this.correlationId = id;
    }
    clearCorrelationId() {
        this.correlationId = null;
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, error, context) {
        this.log(LogLevel.ERROR, message, context, error);
    }
    log(level, message, context, error) {
        if (level < this.config.logLevel) {
            return;
        }
        const entry = {
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
    logToConsole(entry) {
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
    logToFile(entry) {
        const logLine = this.config.enableStructured
            ? JSON.stringify(entry) + '\n'
            : this.formatLogLine(entry);
        try {
            appendFileSync(this.currentLogFile, logLine);
            this.currentFileSize += Buffer.byteLength(logLine);
            if (this.currentFileSize > this.config.maxFileSize) {
                this.rotateLogFile();
            }
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    formatLogLine(entry) {
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
    rotateLogFile() {
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
        }
        catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }
    cleanupOldLogs() {
        try {
            const fs = require('fs');
            const files = fs.readdirSync(this.config.logDir)
                .filter((file) => file.startsWith('codesight-') && file.endsWith('.log'))
                .map((file) => ({
                name: file,
                path: join(this.config.logDir, file),
                mtime: fs.statSync(join(this.config.logDir, file)).mtime
            }))
                .sort((a, b) => b.mtime - a.mtime);
            // Keep only the most recent files
            const filesToDelete = files.slice(this.config.maxFiles);
            for (const file of filesToDelete) {
                fs.unlinkSync(file.path);
            }
        }
        catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }
    ensureLogDir() {
        if (!existsSync(this.config.logDir)) {
            mkdirSync(this.config.logDir, { recursive: true });
        }
    }
    getLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return join(this.config.logDir, `codesight-${date}.log`);
    }
    // Performance monitoring methods
    startTimer(label) {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.info(`Timer: ${label}`, { duration });
        };
    }
    // Memory monitoring
    logMemoryUsage(label) {
        const usage = process.memoryUsage();
        this.info(`Memory usage${label ? ` - ${label}` : ''}`, {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024)
        });
    }
    // Structured logging for specific events
    logScrapeAttempt(url, targets, correlationId) {
        this.setCorrelationId(correlationId);
        this.info('Scrape attempt started', { url, targets, correlationId });
    }
    logScrapeSuccess(url, duration, dataPoints) {
        this.info('Scrape completed successfully', { url, duration, dataPoints });
        this.clearCorrelationId();
    }
    logScrapeFailure(url, error, duration) {
        this.error('Scrape failed', new Error(error), { url, duration });
        this.clearCorrelationId();
    }
    logInteraction(type, selector, success) {
        this.info('Interaction executed', { type, selector, success });
    }
    logLearningEvent(event, context) {
        this.info(`Learning: ${event}`, context);
    }
    // Get recent logs for debugging
    getRecentLogs(count = 100) {
        if (!this.config.enableStructured || !existsSync(this.currentLogFile)) {
            return [];
        }
        try {
            const fs = require('fs');
            const content = fs.readFileSync(this.currentLogFile, 'utf8');
            const lines = content.trim().split('\n');
            return lines
                .slice(-count)
                .map((line) => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            })
                .filter((entry) => entry !== null);
        }
        catch (error) {
            console.error('Failed to read recent logs:', error);
            return [];
        }
    }
}
//# sourceMappingURL=Logger.js.map