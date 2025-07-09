export interface FeedbackEntry {
    id?: number;
    timestamp: number;
    url: string;
    target: string;
    selector: string;
    success: boolean;
    userCorrection?: string;
    errorMessage?: string;
    interactionType: 'scrape' | 'click' | 'fill' | 'navigate';
    elementText?: string;
    elementAttributes?: string;
    htmlContext: string;
    confidence?: number;
}
export interface SelectorPattern {
    id?: number;
    url: string;
    target: string;
    selector: string;
    successCount: number;
    failureCount: number;
    lastUsed: number;
    confidence: number;
    interactionType: 'scrape' | 'click' | 'fill' | 'navigate';
}
export interface InteractionPattern {
    id?: number;
    url: string;
    goal: string;
    steps: string;
    successCount: number;
    failureCount: number;
    lastUsed: number;
    confidence: number;
}
export declare class LearningDatabase {
    private db;
    constructor(databasePath?: string);
    private initializeTables;
    recordFeedback(entry: Omit<FeedbackEntry, 'id'>): void;
    private updateSelectorPattern;
    getBestSelectors(url: string, target: string, interactionType?: string): SelectorPattern[];
    recordInteractionPattern(url: string, goal: string, steps: any[], success: boolean): void;
    getBestInteractionPatterns(url: string, goal: string): InteractionPattern[];
    getLearningMetrics(): {
        totalInteractions: number;
        successRate: number;
        totalPatterns: number;
        averageConfidence: number;
        topSelectors: Array<{
            url: string;
            target: string;
            selector: string;
            confidence: number;
            successCount: number;
        }>;
        recentActivity: Array<{
            timestamp: number;
            url: string;
            target: string;
            success: boolean;
            interactionType: string;
        }>;
    };
    getTrainingData(): {
        positive: FeedbackEntry[];
        negative: FeedbackEntry[];
    };
    close(): void;
}
//# sourceMappingURL=LearningDatabase.d.ts.map