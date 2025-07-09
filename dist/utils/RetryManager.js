import { ErrorHandler, CodeSightError } from '../errors/ErrorHandler.js';
export class RetryManager {
    static defaultConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        retryableErrors: [
            'NAVIGATION_TIMEOUT',
            'ELEMENT_NOT_FOUND',
            'INTERACTION_FAILED',
            'NETWORK_ERROR',
            'TIMEOUT',
            'LLM_RATE_LIMIT',
            'PAGE_LOAD_FAILED'
        ]
    };
    static async executeWithRetry(operation, config = {}, context) {
        const finalConfig = { ...this.defaultConfig, ...config };
        const startTime = Date.now();
        let lastError;
        let attempts = 0;
        for (let i = 0; i <= finalConfig.maxRetries; i++) {
            attempts = i + 1;
            try {
                const result = await operation();
                return {
                    success: true,
                    data: result,
                    attempts,
                    totalTime: Date.now() - startTime
                };
            }
            catch (error) {
                // Convert to CodeSightError if it's not already
                if (error instanceof CodeSightError) {
                    lastError = error;
                }
                else if (error instanceof Error) {
                    lastError = ErrorHandler.handleGenericError(error, context);
                }
                else {
                    lastError = ErrorHandler.createError('UNKNOWN_ERROR', 'Unknown error occurred', undefined, context);
                }
                // Check if we should retry
                if (i < finalConfig.maxRetries && this.shouldRetry(lastError, finalConfig)) {
                    const delay = this.calculateDelay(i, finalConfig);
                    console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms:`, lastError.message);
                    await this.sleep(delay);
                    continue;
                }
                // No more retries
                break;
            }
        }
        return {
            success: false,
            error: lastError,
            attempts,
            totalTime: Date.now() - startTime
        };
    }
    static shouldRetry(error, config) {
        if (!error.recoverable) {
            return false;
        }
        if (config.retryableErrors && config.retryableErrors.length > 0) {
            return config.retryableErrors.includes(error.code);
        }
        return true;
    }
    static calculateDelay(attempt, config) {
        const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
        return Math.min(delay, config.maxDelay);
    }
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static async executeWithCircuitBreaker(operation, circuitBreakerKey, config = {}) {
        const circuitBreaker = CircuitBreaker.getInstance(circuitBreakerKey);
        if (circuitBreaker.isOpen()) {
            return {
                success: false,
                error: ErrorHandler.createError('OPERATION_CANCELLED', 'Circuit breaker is open - operation blocked', undefined, { circuitBreakerKey }),
                attempts: 0,
                totalTime: 0
            };
        }
        const result = await this.executeWithRetry(operation, config, { circuitBreakerKey });
        if (result.success) {
            circuitBreaker.recordSuccess();
        }
        else {
            circuitBreaker.recordFailure();
        }
        return result;
    }
}
class CircuitBreaker {
    key;
    static instances = new Map();
    failures = 0;
    lastFailureTime = 0;
    state = 'CLOSED';
    failureThreshold = 5;
    resetTimeout = 60000; // 1 minute
    halfOpenMaxCalls = 3;
    halfOpenCalls = 0;
    constructor(key) {
        this.key = key;
    }
    static getInstance(key) {
        if (!this.instances.has(key)) {
            this.instances.set(key, new CircuitBreaker(key));
        }
        return this.instances.get(key);
    }
    isOpen() {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
                this.halfOpenCalls = 0;
                return false;
            }
            return true;
        }
        if (this.state === 'HALF_OPEN') {
            return this.halfOpenCalls >= this.halfOpenMaxCalls;
        }
        return false;
    }
    recordSuccess() {
        this.failures = 0;
        this.lastFailureTime = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.halfOpenCalls = 0;
        }
    }
    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.halfOpenCalls = 0;
        }
        else if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime,
            halfOpenCalls: this.halfOpenCalls
        };
    }
    static getAllStats() {
        const stats = {};
        for (const [key, circuit] of this.instances.entries()) {
            stats[key] = circuit.getStats();
        }
        return stats;
    }
}
//# sourceMappingURL=RetryManager.js.map