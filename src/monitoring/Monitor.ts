import { Logger } from './Logger.js';
import { ErrorHandler } from '../errors/ErrorHandler.js';
import { LearningDatabase } from '../database/LearningDatabase.js';

export interface MetricData {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
    p95ResponseTime: number;
  };
  learning: {
    totalPatterns: number;
    averageConfidence: number;
    improvementRate: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  errors: {
    totalErrors: number;
    errorRate: number;
    topErrors: Array<{ code: string; count: number }>;
  };
}

export class Monitor {
  private static instance: Monitor;
  private logger: Logger;
  private startTime: number;
  private metrics: Map<string, MetricData[]> = new Map();
  private requestTimes: number[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {
    this.logger = Logger.getInstance();
    this.startTime = Date.now();
    this.startPeriodicMonitoring();
  }

  static getInstance(): Monitor {
    if (!Monitor.instance) {
      Monitor.instance = new Monitor();
    }
    return Monitor.instance;
  }

  // Record metrics
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric: MetricData = {
      timestamp: Date.now(),
      value,
      labels
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Keep only last 1000 data points
    if (metricArray.length > 1000) {
      metricArray.shift();
    }

    this.logger.debug(`Metric recorded: ${name}`, { value, labels });
  }

  // Record request timing
  recordRequestTime(duration: number): void {
    this.requestTimes.push(duration);
    
    // Keep only last 1000 request times
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift();
    }

    this.recordMetric('request_duration_ms', duration);
  }

  // Record scraping success/failure
  recordScrapeResult(success: boolean, url: string, duration: number, dataPoints?: number): void {
    this.recordMetric('scrape_attempts', 1, { success: success.toString(), domain: new URL(url).hostname });
    this.recordRequestTime(duration);
    
    if (success && dataPoints) {
      this.recordMetric('data_points_extracted', dataPoints);
    }

    this.logger.info('Scrape result recorded', { success, url, duration, dataPoints });
  }

  // Record interaction results
  recordInteraction(type: string, success: boolean, selector: string): void {
    this.recordMetric('interactions', 1, { type, success: success.toString() });
    this.logger.logInteraction(type, selector, success);
  }

  // Record learning events
  recordLearningEvent(event: string, context: Record<string, any>): void {
    this.recordMetric('learning_events', 1, { event });
    this.logger.logLearningEvent(event, context);
  }

  // Get comprehensive metrics
  async getMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    const uptime = now - this.startTime;

    // Request metrics
    const scrapeAttempts = this.getMetricSum('scrape_attempts');
    const successfulScrapes = this.getMetricSum('scrape_attempts', { success: 'true' });
    const failedScrapes = scrapeAttempts - successfulScrapes;
    const avgResponseTime = this.calculateAverage(this.requestTimes);
    const p95ResponseTime = this.calculatePercentile(this.requestTimes, 95);

    // Learning metrics
    const db = new LearningDatabase();
    const dbMetrics = db.getLearningMetrics();
    db.close();

    // System metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Error metrics
    const errorStats = ErrorHandler.getErrorStats();

    return {
      requests: {
        total: scrapeAttempts,
        successful: successfulScrapes,
        failed: failedScrapes,
        avgResponseTime,
        p95ResponseTime
      },
      learning: {
        totalPatterns: dbMetrics.totalPatterns,
        averageConfidence: dbMetrics.averageConfidence,
        improvementRate: this.calculateImprovementRate()
      },
      system: {
        uptime,
        memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000 // milliseconds
      },
      errors: {
        totalErrors: errorStats.totalErrors,
        errorRate: scrapeAttempts > 0 ? errorStats.totalErrors / scrapeAttempts : 0,
        topErrors: Object.entries(errorStats.errorsByCode)
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      }
    };
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: Record<string, { status: 'pass' | 'fail'; message?: string; duration?: number }>;
  }> {
    const checks: Record<string, { status: 'pass' | 'fail'; message?: string; duration?: number }> = {};

    // Database health check
    const dbStart = Date.now();
    try {
      const db = new LearningDatabase();
      db.getLearningMetrics();
      db.close();
      checks.database = { status: 'pass', duration: Date.now() - dbStart };
    } catch (error) {
      checks.database = { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Database check failed',
        duration: Date.now() - dbStart
      };
    }

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) { // 500MB threshold
      checks.memory = { 
        status: 'fail', 
        message: `High memory usage: ${memoryUsageMB.toFixed(2)}MB` 
      };
    } else {
      checks.memory = { status: 'pass' };
    }

    // Error rate health check
    const errorRate = await this.getErrorRate();
    if (errorRate > 0.5) { // 50% error rate threshold
      checks.errorRate = { 
        status: 'fail', 
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%` 
      };
    } else {
      checks.errorRate = { status: 'pass' };
    }

    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail');
    const status = failedChecks.length === 0 ? 'healthy' : 
                  failedChecks.length === 1 ? 'degraded' : 'unhealthy';

    return { status, checks };
  }

  // Start periodic monitoring
  private startPeriodicMonitoring(): void {
    this.intervalId = setInterval(async () => {
      // Log system metrics every 60 seconds
      this.logger.logMemoryUsage('periodic');
      
      // Record system metrics
      const memoryUsage = process.memoryUsage();
      this.recordMetric('memory_heap_used', memoryUsage.heapUsed);
      this.recordMetric('memory_heap_total', memoryUsage.heapTotal);
      
      // Log performance summary
      const metrics = await this.getMetrics();
      this.logger.info('Performance summary', {
        totalRequests: metrics.requests.total,
        successRate: metrics.requests.total > 0 ? metrics.requests.successful / metrics.requests.total : 0,
        avgResponseTime: metrics.requests.avgResponseTime,
        totalPatterns: metrics.learning.totalPatterns,
        averageConfidence: metrics.learning.averageConfidence
      });
    }, 60000); // 60 seconds
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Helper methods
  private getMetricSum(name: string, labels?: Record<string, string>): number {
    const metrics = this.metrics.get(name);
    if (!metrics) return 0;

    return metrics
      .filter(metric => !labels || this.labelsMatch(metric.labels, labels))
      .reduce((sum, metric) => sum + metric.value, 0);
  }

  private labelsMatch(metricLabels?: Record<string, string>, filterLabels?: Record<string, string>): boolean {
    if (!filterLabels) return true;
    if (!metricLabels) return false;

    return Object.entries(filterLabels).every(([key, value]) => metricLabels[key] === value);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private calculateImprovementRate(): number {
    const recent = this.getMetricSum('learning_events');
    const total = this.getMetricSum('scrape_attempts');
    
    return total > 0 ? recent / total : 0;
  }

  private async getErrorRate(): Promise<number> {
    const totalRequests = this.getMetricSum('scrape_attempts');
    const failedRequests = this.getMetricSum('scrape_attempts', { success: 'false' });
    
    return totalRequests > 0 ? failedRequests / totalRequests : 0;
  }

  // Export metrics for external monitoring systems
  exportMetrics(): { name: string; data: MetricData[]; }[] {
    return Array.from(this.metrics.entries()).map(([name, data]) => ({
      name,
      data: [...data] // Copy to prevent mutation
    }));
  }

  // Clear old metrics
  clearMetrics(): void {
    this.metrics.clear();
    this.requestTimes = [];
    this.logger.info('Metrics cleared');
  }
}