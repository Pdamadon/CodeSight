import { ErrorHandler, CodeSightError } from '../errors/ErrorHandler.js';

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

export class RetryManager {
  private static defaultConfig: RetryConfig = {
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

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: Record<string, any>
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();
    let lastError: CodeSightError | undefined;
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
      } catch (error) {
        // Convert to CodeSightError if it's not already
        if (error instanceof CodeSightError) {
          lastError = error;
        } else if (error instanceof Error) {
          lastError = ErrorHandler.handleGenericError(error, context);
        } else {
          lastError = ErrorHandler.createError(
            'UNKNOWN_ERROR' as any,
            'Unknown error occurred',
            undefined,
            context
          );
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

  private static shouldRetry(error: CodeSightError, config: RetryConfig): boolean {
    if (!error.recoverable) {
      return false;
    }

    if (config.retryableErrors && config.retryableErrors.length > 0) {
      return config.retryableErrors.includes(error.code);
    }

    return true;
  }

  private static calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    return Math.min(delay, config.maxDelay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerKey: string,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const circuitBreaker = CircuitBreaker.getInstance(circuitBreakerKey);
    
    if (circuitBreaker.isOpen()) {
      return {
        success: false,
        error: ErrorHandler.createError(
          'OPERATION_CANCELLED' as any,
          'Circuit breaker is open - operation blocked',
          undefined,
          { circuitBreakerKey }
        ),
        attempts: 0,
        totalTime: 0
      };
    }

    const result = await this.executeWithRetry(operation, config, { circuitBreakerKey });
    
    if (result.success) {
      circuitBreaker.recordSuccess();
    } else {
      circuitBreaker.recordFailure();
    }

    return result;
  }
}

class CircuitBreaker {
  private static instances: Map<string, CircuitBreaker> = new Map();
  
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  private readonly failureThreshold: number = 5;
  private readonly resetTimeout: number = 60000; // 1 minute
  private readonly halfOpenMaxCalls: number = 3;
  private halfOpenCalls: number = 0;

  private constructor(private readonly key: string) {}

  static getInstance(key: string): CircuitBreaker {
    if (!this.instances.has(key)) {
      this.instances.set(key, new CircuitBreaker(key));
    }
    return this.instances.get(key)!;
  }

  isOpen(): boolean {
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

  recordSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.halfOpenCalls = 0;
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.halfOpenCalls = 0;
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getStats(): {
    state: string;
    failures: number;
    lastFailureTime: number;
    halfOpenCalls: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls
    };
  }

  static getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [key, circuit] of this.instances.entries()) {
      stats[key] = circuit.getStats();
    }
    return stats;
  }
}