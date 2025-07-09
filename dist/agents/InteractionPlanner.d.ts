import { Page } from 'playwright';
import { LearningSystem } from '../learning/LearningSystem.js';
export interface InteractionStep {
    type: 'click' | 'fill' | 'select' | 'wait' | 'scroll' | 'navigate';
    selector?: string;
    value?: string;
    timeout?: number;
    description: string;
}
export interface InteractionPlan {
    steps: InteractionStep[];
    expectedOutcome: string;
    confidence: number;
    reasoning: string;
}
export interface InteractionRequest {
    url: string;
    html: string;
    goal: string;
    currentData?: Record<string, any>;
}
export declare class InteractionPlanner {
    private llmPlanner;
    private learningSystem;
    private monitor;
    constructor(learningSystem?: LearningSystem);
    planInteractions(request: InteractionRequest): Promise<InteractionPlan>;
    executeInteractionPlan(page: Page, plan: InteractionPlan): Promise<{
        success: boolean;
        completedSteps: number;
        errors: string[];
        finalData?: Record<string, any>;
    }>;
    private executeStep;
    private extractFinalData;
    private buildInteractionPrompt;
    private parseInteractionResponse;
    private generateFallbackPlan;
}
//# sourceMappingURL=InteractionPlanner.d.ts.map