export interface FeedbackEntry {
    id: string;
    timestamp: number;
    url: string;
    target: string;
    selector: string;
    success: boolean;
    userCorrection?: string;
    errorMessage?: string;
    interactionType?: 'scrape' | 'click' | 'fill' | 'navigate';
    context: {
        html: string;
        position: number;
        elementText?: string;
        elementAttributes?: Record<string, string>;
    };
}
export interface PatternData {
    url: string;
    target: string;
    selectors: {
        successful: string[];
        failed: string[];
    };
    interactions: {
        successful: string[];
        failed: string[];
    };
    confidence: number;
    lastUpdated: number;
}
export declare class FeedbackStore {
    private feedbackFile;
    private patternsFile;
    private feedback;
    private patterns;
    constructor(dataDir?: string);
    private ensureDataDirectory;
    loadData(): Promise<void>;
    recordFeedback(entry: Omit<FeedbackEntry, 'id' | 'timestamp'>): Promise<void>;
    private updatePatterns;
    getSuggestedSelectors(url: string, target: string): Promise<{
        selectors: string[];
        confidence: number;
    }>;
    getSuggestedInteractions(url: string, target: string): Promise<{
        interactions: string[];
        confidence: number;
    }>;
    getTrainingData(): Promise<{
        positive: FeedbackEntry[];
        negative: FeedbackEntry[];
    }>;
    getPatternStats(): Promise<{
        totalPatterns: number;
        averageConfidence: number;
        topPatterns: Array<{
            url: string;
            target: string;
            confidence: number;
            successfulSelectors: number;
        }>;
    }>;
    private getPatternKey;
    private generateId;
    private saveFeedback;
    private savePatterns;
}
//# sourceMappingURL=FeedbackStore.d.ts.map