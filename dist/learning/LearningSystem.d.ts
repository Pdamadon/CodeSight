export interface LearningMetrics {
    totalInteractions: number;
    successRate: number;
    averageConfidence: number;
    topPatterns: Array<{
        url: string;
        target: string;
        confidence: number;
    }>;
    recentImprovements: Array<{
        pattern: string;
        improvement: number;
        timestamp: number;
    }>;
}
export declare class LearningSystem {
    private db;
    private llmPlanner;
    private performanceHistory;
    constructor(databasePath?: string);
    initialize(): Promise<void>;
    recordSuccess(url: string, target: string, selector: string, interactionType: 'scrape' | 'click' | 'fill' | 'navigate', context: {
        html: string;
        position: number;
        elementText?: string;
        elementAttributes?: Record<string, string | undefined>;
    }): Promise<void>;
    recordFailure(url: string, target: string, selector: string, errorMessage: string, interactionType: 'scrape' | 'click' | 'fill' | 'navigate', context: {
        html: string;
        position: number;
        elementText?: string;
        elementAttributes?: Record<string, string | undefined>;
    }): Promise<void>;
    recordUserCorrection(url: string, target: string, failedSelector: string, correctedSelector: string, interactionType: 'scrape' | 'click' | 'fill' | 'navigate', context: {
        html: string;
        position: number;
        elementText?: string;
        elementAttributes?: Record<string, string | undefined>;
    }): Promise<void>;
    getEnhancedSelectors(url: string, target: string, baseSelectors: Record<string, string>): Promise<{
        selectors: Record<string, string>;
        confidence: Record<string, number>;
        reasoning: string;
    }>;
    getEnhancedInteractions(url: string, goal: string): Promise<{
        interactions: any[];
        confidence: number;
        reasoning: string;
    }>;
    generateTrainingData(): Promise<{
        examples: Array<{
            input: string;
            output: string;
            success: boolean;
        }>;
        patterns: Array<{
            url: string;
            target: string;
            bestSelector: string;
            confidence: number;
        }>;
    }>;
    getLearningMetrics(): Promise<LearningMetrics>;
    private generatePatternSummary;
    private updatePerformanceHistory;
    private calculateRecentImprovements;
    recordInteractionPattern(url: string, goal: string, steps: any[], success: boolean): Promise<void>;
    close(): void;
}
//# sourceMappingURL=LearningSystem.d.ts.map