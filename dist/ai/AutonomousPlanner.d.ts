export interface AutonomousDecision {
    action: 'scrape' | 'click' | 'fill' | 'navigate' | 'wait' | 'analyze';
    reasoning: string;
    confidence: number;
    parameters: Record<string, any>;
    fallbackOptions?: AutonomousDecision[];
}
export interface AutonomousContext {
    url: string;
    goal: string;
    currentHtml: string;
    previousAttempts: string[];
    availableElements: Array<{
        tag: string;
        text: string;
        attributes: Record<string, string>;
        selector: string;
    }>;
    currentData: Record<string, any>;
    pageStructure?: {
        title: string;
        headings: string[];
        links: number;
        forms: number;
        images: number;
        contentType: 'news' | 'ecommerce' | 'social' | 'search' | 'wiki' | 'generic';
    };
    extractionTargets?: Array<{
        name: string;
        expected: string;
        currentValue?: any;
        confidence?: number;
    }>;
    failureAnalysis?: {
        failedSelectors: string[];
        reasons: string[];
        suggestions: string[];
    };
}
export declare class AutonomousPlanner {
    private openai;
    private logger;
    private monitor;
    constructor();
    makeAutonomousDecision(context: AutonomousContext): Promise<AutonomousDecision>;
    planInteractionSequence(context: AutonomousContext): Promise<AutonomousDecision[]>;
    generateImprovedSelectors(context: AutonomousContext, failedSelectors: string[]): Promise<{
        selectors: Record<string, string>;
        reasoning: string;
        confidence: number;
    }>;
    private getSystemPrompt;
    private getSequenceSystemPrompt;
    private getSelectorSystemPrompt;
    private buildDecisionPrompt;
    private buildSequencePrompt;
    private buildSelectorPrompt;
    private parseDecisionResponse;
    private parseSequenceResponse;
    private parseSelectorResponse;
    private inferPageStructure;
    private buildExtractionTargets;
    private analyzeFailures;
    private calculateElementRelevance;
    private extractSemanticStructure;
    private generateHtmlAnalysis;
    validateExtractionResult(context: AutonomousContext, extractedData: Record<string, any>): Promise<{
        isValid: boolean;
        confidence: number;
        suggestions: string[];
        missingTargets: string[];
    }>;
}
//# sourceMappingURL=AutonomousPlanner.d.ts.map