export interface ScrapeRequest {
    url: string;
    targets: string[];
    waitForSelector?: string;
    timeout?: number;
    headless?: boolean;
    interactions?: string[];
    autonomous?: boolean;
}
export interface ScrapeResult {
    success: boolean;
    data: Record<string, any>;
    selectors: Record<string, string>;
    executionTime: number;
    errors?: string[];
    interactions?: {
        completed: number;
        total: number;
        results: Record<string, any>;
    };
    autonomous?: {
        steps: Array<{
            action: string;
            success: boolean;
            data?: any;
            error?: string;
        }>;
        reasoning: string;
        confidence: number;
    };
}
export declare class ScrapingAgent {
    private browser;
    private domAnalyzer;
    private planner;
    private interactionPlanner;
    private learningSystem;
    private logger;
    private monitor;
    private autonomousController;
    constructor();
    scrapeWebsite(request: ScrapeRequest): Promise<ScrapeResult>;
    private initializeBrowser;
    private executePlan;
    private executeInteractions;
    getLearningMetrics(): Promise<any>;
    private generateCorrelationId;
    close(): Promise<void>;
}
//# sourceMappingURL=ScrapingAgent.d.ts.map