export interface PlanningRequest {
    url: string;
    html: string;
    targets: string[];
    suggestedSelectors: Record<string, string>;
}
export interface ScrapingPlan {
    selectors: Record<string, string>;
    strategy: string;
    confidence: number;
    reasoning: string;
}
export declare class LLMPlanner {
    private openai;
    constructor();
    generateScrapingPlan(request: PlanningRequest): Promise<ScrapingPlan>;
    private buildPrompt;
    private parseResponse;
}
//# sourceMappingURL=LLMPlanner.d.ts.map