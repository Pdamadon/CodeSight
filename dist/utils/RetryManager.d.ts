import { CodeSightError } from '../errors/ErrorHandler.js';
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
    retryableErrors?: string[];
}
export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: CodeSightError;
    attempts: number;
    totalTime: number;
}
export declare class RetryManager {
    private static defaultConfig;
    static executeWithRetry<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>, context?: Record<string, any>): Promise<RetryResult<T>>;
    private static shouldRetry;
    private static calculateDelay;
    private static sleep;
    static executeWithCircuitBreaker<T>(operation: () => Promise<T>, circuitBreakerKey: string, config?: Partial<RetryConfig>): Promise<RetryResult<T>>;
}
//# sourceMappingURL=RetryManager.d.ts.map