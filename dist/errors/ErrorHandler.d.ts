export declare enum ErrorCode {
    INVALID_URL = "INVALID_URL",
    INVALID_TARGETS = "INVALID_TARGETS",
    INVALID_SELECTOR = "INVALID_SELECTOR",
    INVALID_HTML = "INVALID_HTML",
    BROWSER_LAUNCH_FAILED = "BROWSER_LAUNCH_FAILED",
    PAGE_LOAD_FAILED = "PAGE_LOAD_FAILED",
    NAVIGATION_TIMEOUT = "NAVIGATION_TIMEOUT",
    ELEMENT_NOT_FOUND = "ELEMENT_NOT_FOUND",
    INTERACTION_FAILED = "INTERACTION_FAILED",
    NETWORK_ERROR = "NETWORK_ERROR",
    DNS_ERROR = "DNS_ERROR",
    CONNECTION_REFUSED = "CONNECTION_REFUSED",
    TIMEOUT = "TIMEOUT",
    MEMORY_ERROR = "MEMORY_ERROR",
    DISK_ERROR = "DISK_ERROR",
    PERMISSION_ERROR = "PERMISSION_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR",
    LEARNING_DISABLED = "LEARNING_DISABLED",
    LLM_API_ERROR = "LLM_API_ERROR",
    LLM_RATE_LIMIT = "LLM_RATE_LIMIT",
    LLM_QUOTA_EXCEEDED = "LLM_QUOTA_EXCEEDED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    OPERATION_CANCELLED = "OPERATION_CANCELLED"
}
export interface ErrorDetails {
    code: ErrorCode;
    message: string;
    originalError?: Error;
    context?: Record<string, any>;
    timestamp: number;
    recoverable: boolean;
    suggestion?: string;
}
export declare class CodeSightError extends Error {
    readonly code: ErrorCode;
    readonly originalError?: Error;
    readonly context?: Record<string, any>;
    readonly timestamp: number;
    readonly recoverable: boolean;
    readonly suggestion?: string;
    constructor(details: ErrorDetails);
    toJSON(): {
        name: string;
        code: ErrorCode;
        message: string;
        context: Record<string, any> | undefined;
        timestamp: number;
        recoverable: boolean;
        suggestion: string | undefined;
        stack: string | undefined;
    };
}
export declare class ErrorHandler {
    private static errorCounts;
    private static lastErrors;
    static createError(code: ErrorCode, message: string, originalError?: Error, context?: Record<string, any>): CodeSightError;
    static handleBrowserError(error: Error, context?: Record<string, any>): CodeSightError;
    static handleNetworkError(error: Error, context?: Record<string, any>): CodeSightError;
    static handleLLMError(error: Error, context?: Record<string, any>): CodeSightError;
    static handleDatabaseError(error: Error, context?: Record<string, any>): CodeSightError;
    static handleGenericError(error: Error, context?: Record<string, any>): CodeSightError;
    private static getSuggestion;
    private static isRecoverable;
    static shouldRetry(error: CodeSightError, retryCount: number): boolean;
    static getRetryDelay(retryCount: number): number;
    static getErrorStats(): {
        totalErrors: number;
        errorsByCode: Record<ErrorCode, number>;
        recentErrors: Array<{
            code: ErrorCode;
            timestamp: number;
            count: number;
        }>;
    };
    static clearErrorStats(): void;
}
//# sourceMappingURL=ErrorHandler.d.ts.map