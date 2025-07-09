export var ErrorCode;
(function (ErrorCode) {
    // Validation errors
    ErrorCode["INVALID_URL"] = "INVALID_URL";
    ErrorCode["INVALID_TARGETS"] = "INVALID_TARGETS";
    ErrorCode["INVALID_SELECTOR"] = "INVALID_SELECTOR";
    ErrorCode["INVALID_HTML"] = "INVALID_HTML";
    // Browser errors
    ErrorCode["BROWSER_LAUNCH_FAILED"] = "BROWSER_LAUNCH_FAILED";
    ErrorCode["PAGE_LOAD_FAILED"] = "PAGE_LOAD_FAILED";
    ErrorCode["NAVIGATION_TIMEOUT"] = "NAVIGATION_TIMEOUT";
    ErrorCode["ELEMENT_NOT_FOUND"] = "ELEMENT_NOT_FOUND";
    ErrorCode["INTERACTION_FAILED"] = "INTERACTION_FAILED";
    // Network errors
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["DNS_ERROR"] = "DNS_ERROR";
    ErrorCode["CONNECTION_REFUSED"] = "CONNECTION_REFUSED";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    // System errors
    ErrorCode["MEMORY_ERROR"] = "MEMORY_ERROR";
    ErrorCode["DISK_ERROR"] = "DISK_ERROR";
    ErrorCode["PERMISSION_ERROR"] = "PERMISSION_ERROR";
    // Learning system errors
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["LEARNING_DISABLED"] = "LEARNING_DISABLED";
    // LLM errors
    ErrorCode["LLM_API_ERROR"] = "LLM_API_ERROR";
    ErrorCode["LLM_RATE_LIMIT"] = "LLM_RATE_LIMIT";
    ErrorCode["LLM_QUOTA_EXCEEDED"] = "LLM_QUOTA_EXCEEDED";
    // General errors
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["OPERATION_CANCELLED"] = "OPERATION_CANCELLED";
})(ErrorCode || (ErrorCode = {}));
export class CodeSightError extends Error {
    code;
    originalError;
    context;
    timestamp;
    recoverable;
    suggestion;
    constructor(details) {
        super(details.message);
        this.name = 'CodeSightError';
        this.code = details.code;
        this.originalError = details.originalError;
        this.context = details.context;
        this.timestamp = details.timestamp;
        this.recoverable = details.recoverable;
        this.suggestion = details.suggestion;
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
            recoverable: this.recoverable,
            suggestion: this.suggestion,
            stack: this.stack
        };
    }
}
export class ErrorHandler {
    static errorCounts = new Map();
    static lastErrors = new Map();
    static createError(code, message, originalError, context) {
        // Track error frequency
        const currentCount = this.errorCounts.get(code) || 0;
        this.errorCounts.set(code, currentCount + 1);
        this.lastErrors.set(code, Date.now());
        const suggestion = this.getSuggestion(code);
        const recoverable = this.isRecoverable(code);
        return new CodeSightError({
            code,
            message,
            originalError,
            context,
            timestamp: Date.now(),
            recoverable,
            suggestion
        });
    }
    static handleBrowserError(error, context) {
        if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
            return this.createError(ErrorCode.DNS_ERROR, 'Domain name could not be resolved', error, context);
        }
        if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
            return this.createError(ErrorCode.CONNECTION_REFUSED, 'Connection to server was refused', error, context);
        }
        if (error.message.includes('TimeoutError')) {
            return this.createError(ErrorCode.NAVIGATION_TIMEOUT, 'Page navigation timed out', error, context);
        }
        if (error.message.includes('Target closed')) {
            return this.createError(ErrorCode.BROWSER_LAUNCH_FAILED, 'Browser instance was closed unexpectedly', error, context);
        }
        return this.createError(ErrorCode.BROWSER_LAUNCH_FAILED, `Browser error: ${error.message}`, error, context);
    }
    static handleNetworkError(error, context) {
        if (error.message.includes('ENOTFOUND')) {
            return this.createError(ErrorCode.DNS_ERROR, 'DNS lookup failed', error, context);
        }
        if (error.message.includes('ECONNREFUSED')) {
            return this.createError(ErrorCode.CONNECTION_REFUSED, 'Connection refused by server', error, context);
        }
        if (error.message.includes('timeout')) {
            return this.createError(ErrorCode.TIMEOUT, 'Network request timed out', error, context);
        }
        return this.createError(ErrorCode.NETWORK_ERROR, `Network error: ${error.message}`, error, context);
    }
    static handleLLMError(error, context) {
        if (error.message.includes('rate limit')) {
            return this.createError(ErrorCode.LLM_RATE_LIMIT, 'LLM API rate limit exceeded', error, context);
        }
        if (error.message.includes('quota') || error.message.includes('billing')) {
            return this.createError(ErrorCode.LLM_QUOTA_EXCEEDED, 'LLM API quota exceeded', error, context);
        }
        return this.createError(ErrorCode.LLM_API_ERROR, `LLM API error: ${error.message}`, error, context);
    }
    static handleDatabaseError(error, context) {
        return this.createError(ErrorCode.DATABASE_ERROR, `Database error: ${error.message}`, error, context);
    }
    static handleGenericError(error, context) {
        // Try to categorize the error
        if (error.message.includes('EACCES') || error.message.includes('permission')) {
            return this.createError(ErrorCode.PERMISSION_ERROR, 'Permission denied', error, context);
        }
        if (error.message.includes('ENOSPC') || error.message.includes('disk')) {
            return this.createError(ErrorCode.DISK_ERROR, 'Disk space or I/O error', error, context);
        }
        if (error.message.includes('out of memory') || error.message.includes('heap')) {
            return this.createError(ErrorCode.MEMORY_ERROR, 'Out of memory', error, context);
        }
        return this.createError(ErrorCode.UNKNOWN_ERROR, `Unknown error: ${error.message}`, error, context);
    }
    static getSuggestion(code) {
        const suggestions = {
            [ErrorCode.INVALID_URL]: 'Ensure the URL is properly formatted with http:// or https://',
            [ErrorCode.INVALID_TARGETS]: 'Provide valid target descriptions (e.g., "title", "price")',
            [ErrorCode.INVALID_SELECTOR]: 'Use valid CSS selector syntax',
            [ErrorCode.INVALID_HTML]: 'Ensure HTML content is not empty and properly formatted',
            [ErrorCode.BROWSER_LAUNCH_FAILED]: 'Try restarting the application or check system resources',
            [ErrorCode.PAGE_LOAD_FAILED]: 'Check if the URL is accessible and try again',
            [ErrorCode.NAVIGATION_TIMEOUT]: 'Increase timeout or check network connectivity',
            [ErrorCode.ELEMENT_NOT_FOUND]: 'Verify the selector matches elements on the page',
            [ErrorCode.INTERACTION_FAILED]: 'Check if the element is visible and clickable',
            [ErrorCode.NETWORK_ERROR]: 'Check your internet connection and try again',
            [ErrorCode.DNS_ERROR]: 'Check if the domain name is correct and accessible',
            [ErrorCode.CONNECTION_REFUSED]: 'The server may be down or blocking requests',
            [ErrorCode.TIMEOUT]: 'Increase timeout or try again later',
            [ErrorCode.MEMORY_ERROR]: 'Close other applications or restart the system',
            [ErrorCode.DISK_ERROR]: 'Check available disk space and permissions',
            [ErrorCode.PERMISSION_ERROR]: 'Check file/directory permissions',
            [ErrorCode.DATABASE_ERROR]: 'Check database file permissions and disk space',
            [ErrorCode.LEARNING_DISABLED]: 'Enable learning system or check database connectivity',
            [ErrorCode.LLM_API_ERROR]: 'Check API key and service availability',
            [ErrorCode.LLM_RATE_LIMIT]: 'Wait before making more requests',
            [ErrorCode.LLM_QUOTA_EXCEEDED]: 'Check your API billing and quota',
            [ErrorCode.UNKNOWN_ERROR]: 'Try again or check system logs for more details',
            [ErrorCode.OPERATION_CANCELLED]: 'The operation was cancelled by the user'
        };
        return suggestions[code] || 'No specific suggestion available';
    }
    static isRecoverable(code) {
        const recoverableErrors = [
            ErrorCode.NAVIGATION_TIMEOUT,
            ErrorCode.ELEMENT_NOT_FOUND,
            ErrorCode.INTERACTION_FAILED,
            ErrorCode.NETWORK_ERROR,
            ErrorCode.TIMEOUT,
            ErrorCode.LLM_RATE_LIMIT,
            ErrorCode.PAGE_LOAD_FAILED
        ];
        return recoverableErrors.includes(code);
    }
    static shouldRetry(error, retryCount) {
        const maxRetries = 3;
        if (retryCount >= maxRetries) {
            return false;
        }
        return error.recoverable;
    }
    static getRetryDelay(retryCount) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        return Math.min(1000 * Math.pow(2, retryCount), 30000);
    }
    static getErrorStats() {
        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
        const errorsByCode = Object.fromEntries(this.errorCounts.entries());
        const recentErrors = Array.from(this.lastErrors.entries())
            .filter(([_, timestamp]) => Date.now() - timestamp < 3600000) // Last hour
            .map(([code, timestamp]) => ({
            code,
            timestamp,
            count: this.errorCounts.get(code) || 0
        }))
            .sort((a, b) => b.timestamp - a.timestamp);
        return {
            totalErrors,
            errorsByCode,
            recentErrors
        };
    }
    static clearErrorStats() {
        this.errorCounts.clear();
        this.lastErrors.clear();
    }
}
//# sourceMappingURL=ErrorHandler.js.map