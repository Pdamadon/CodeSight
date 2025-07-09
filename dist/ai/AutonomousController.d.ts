import { Page } from 'playwright';
import { LearningSystem } from '../learning/LearningSystem.js';
export interface AutonomousResult {
    success: boolean;
    data: Record<string, any>;
    steps: Array<{
        action: string;
        success: boolean;
        data?: any;
        error?: string;
    }>;
    reasoning: string;
    confidence: number;
    executionTime: number;
}
export declare class AutonomousController {
    private planner;
    private domAnalyzer;
    private learningSystem;
    private logger;
    private monitor;
    constructor(learningSystem: LearningSystem);
    executeAutonomousGoal(page: Page, goal: string, maxSteps?: number, timeout?: number): Promise<AutonomousResult>;
    private buildContext;
    private executeDecision;
    private executeScrapeAction;
    private executeClickAction;
    private executeFillAction;
    private executeNavigateAction;
    private executeWaitAction;
    private executeAnalyzeAction;
    private isGoalAchieved;
    private calculateOverallConfidence;
    private assessDataQuality;
    private analyzePageStructure;
    private buildExtractionTargets;
    private analyzeFailures;
    private calculateExtractionConfidence;
    private validateExtractionQuality;
}
//# sourceMappingURL=AutonomousController.d.ts.map