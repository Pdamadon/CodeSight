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
        topErrors: Array<{
            code: string;
            count: number;
        }>;
    };
}
export declare class Monitor {
    private static instance;
    private logger;
    private startTime;
    private metrics;
    private requestTimes;
    private intervalId;
    private constructor();
    static getInstance(): Monitor;
    recordMetric(name: string, value: number, labels?: Record<string, string>): void;
    recordRequestTime(duration: number): void;
    recordScrapeResult(success: boolean, url: string, duration: number, dataPoints?: number): void;
    recordInteraction(type: string, success: boolean, selector: string): void;
    recordLearningEvent(event: string, context: Record<string, any>): void;
    getMetrics(): Promise<PerformanceMetrics>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded';
        checks: Record<string, {
            status: 'pass' | 'fail';
            message?: string;
            duration?: number;
        }>;
    }>;
    private startPeriodicMonitoring;
    stopMonitoring(): void;
    private getMetricSum;
    private labelsMatch;
    private calculateAverage;
    private calculatePercentile;
    private calculateImprovementRate;
    private getErrorRate;
    exportMetrics(): {
        name: string;
        data: MetricData[];
    }[];
    clearMetrics(): void;
}
//# sourceMappingURL=Monitor.d.ts.map