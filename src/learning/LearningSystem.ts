import { LearningDatabase } from '../database/LearningDatabase.js';
import { LLMPlanner } from '../agents/LLMPlanner.js';

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

export class LearningSystem {
  private db: LearningDatabase;
  private llmPlanner: LLMPlanner;
  private performanceHistory: Map<string, number[]> = new Map();

  constructor(databasePath?: string) {
    this.db = new LearningDatabase(databasePath);
    this.llmPlanner = new LLMPlanner();
  }

  async initialize(): Promise<void> {
    // Database is initialized on construction
  }

  async recordSuccess(
    url: string,
    target: string,
    selector: string,
    interactionType: 'scrape' | 'click' | 'fill' | 'navigate',
    context: {
      html: string;
      position: number;
      elementText?: string;
      elementAttributes?: Record<string, string | undefined>;
    }
  ): Promise<void> {
    this.db.recordFeedback({
      timestamp: Date.now(),
      url,
      target,
      selector,
      success: true,
      interactionType,
      elementText: context.elementText,
      elementAttributes: context.elementAttributes ? JSON.stringify(context.elementAttributes) : undefined,
      htmlContext: context.html
    });

    this.updatePerformanceHistory(url, target, true);
  }

  async recordFailure(
    url: string,
    target: string,
    selector: string,
    errorMessage: string,
    interactionType: 'scrape' | 'click' | 'fill' | 'navigate',
    context: {
      html: string;
      position: number;
      elementText?: string;
      elementAttributes?: Record<string, string | undefined>;
    }
  ): Promise<void> {
    this.db.recordFeedback({
      timestamp: Date.now(),
      url,
      target,
      selector,
      success: false,
      errorMessage,
      interactionType,
      elementText: context.elementText,
      elementAttributes: context.elementAttributes ? JSON.stringify(context.elementAttributes) : undefined,
      htmlContext: context.html
    });

    this.updatePerformanceHistory(url, target, false);
  }

  async recordUserCorrection(
    url: string,
    target: string,
    failedSelector: string,
    correctedSelector: string,
    interactionType: 'scrape' | 'click' | 'fill' | 'navigate',
    context: {
      html: string;
      position: number;
      elementText?: string;
      elementAttributes?: Record<string, string | undefined>;
    }
  ): Promise<void> {
    const timestamp = Date.now();
    const elementAttributesJson = context.elementAttributes ? JSON.stringify(context.elementAttributes) : undefined;

    // Record the failure
    this.db.recordFeedback({
      timestamp,
      url,
      target,
      selector: failedSelector,
      success: false,
      userCorrection: correctedSelector,
      interactionType,
      elementText: context.elementText,
      elementAttributes: elementAttributesJson,
      htmlContext: context.html
    });

    // Record the correction as a success
    this.db.recordFeedback({
      timestamp,
      url,
      target,
      selector: correctedSelector,
      success: true,
      interactionType,
      elementText: context.elementText,
      elementAttributes: elementAttributesJson,
      htmlContext: context.html
    });
  }

  async getEnhancedSelectors(
    url: string,
    target: string,
    baseSelectors: Record<string, string>
  ): Promise<{
    selectors: Record<string, string>;
    confidence: Record<string, number>;
    reasoning: string;
  }> {
    const bestSelectors = this.db.getBestSelectors(url, target, 'scrape');
    
    const enhancedSelectors = { ...baseSelectors };
    const confidence: Record<string, number> = {};
    
    if (bestSelectors.length > 0 && bestSelectors[0].confidence > 0.7) {
      // Use learned selector if confidence is high
      enhancedSelectors[target] = bestSelectors[0].selector;
      confidence[target] = bestSelectors[0].confidence;
    } else {
      // Use base selector with lower confidence
      confidence[target] = 0.5;
    }

    const reasoning = bestSelectors.length > 0 && bestSelectors[0].confidence > 0.7
      ? `Using learned selector for ${target} (confidence: ${bestSelectors[0].confidence.toFixed(2)}, used ${bestSelectors[0].successCount} times)`
      : `Using base selector for ${target} (no reliable learned pattern)`;

    return {
      selectors: enhancedSelectors,
      confidence,
      reasoning
    };
  }

  async getEnhancedInteractions(
    url: string,
    goal: string
  ): Promise<{
    interactions: any[];
    confidence: number;
    reasoning: string;
  }> {
    const bestPatterns = this.db.getBestInteractionPatterns(url, goal);
    
    if (bestPatterns.length > 0 && bestPatterns[0].confidence > 0.6) {
      const steps = JSON.parse(bestPatterns[0].steps);
      return {
        interactions: steps,
        confidence: bestPatterns[0].confidence,
        reasoning: `Using learned interaction pattern for "${goal}" (confidence: ${bestPatterns[0].confidence.toFixed(2)}, used ${bestPatterns[0].successCount} times)`
      };
    }

    return {
      interactions: [],
      confidence: 0.3,
      reasoning: `No reliable learned patterns for "${goal}"`
    };
  }

  async generateTrainingData(): Promise<{
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
  }> {
    const trainingData = this.db.getTrainingData();
    
    const examples = trainingData.positive.map(entry => ({
      input: `URL: ${entry.url}, Target: ${entry.target}, HTML: ${entry.htmlContext.substring(0, 500)}`,
      output: entry.selector,
      success: entry.success
    }));

    const patterns = await this.generatePatternSummary();

    return { examples, patterns };
  }

  async getLearningMetrics(): Promise<LearningMetrics> {
    const dbMetrics = this.db.getLearningMetrics();
    const recentImprovements = this.calculateRecentImprovements();

    return {
      totalInteractions: dbMetrics.totalInteractions,
      successRate: dbMetrics.successRate,
      averageConfidence: dbMetrics.averageConfidence,
      topPatterns: dbMetrics.topSelectors.map(s => ({
        url: s.url,
        target: s.target,
        confidence: s.confidence
      })),
      recentImprovements
    };
  }

  private async generatePatternSummary(): Promise<Array<{
    url: string;
    target: string;
    bestSelector: string;
    confidence: number;
  }>> {
    const dbMetrics = this.db.getLearningMetrics();
    
    return dbMetrics.topSelectors.map(selector => ({
      url: selector.url,
      target: selector.target,
      bestSelector: selector.selector,
      confidence: selector.confidence
    }));
  }

  private updatePerformanceHistory(url: string, target: string, success: boolean): void {
    const key = `${url}:${target}`;
    const history = this.performanceHistory.get(key) || [];
    
    history.push(success ? 1 : 0);
    
    // Keep only last 50 attempts
    if (history.length > 50) {
      history.shift();
    }
    
    this.performanceHistory.set(key, history);
  }

  private calculateRecentImprovements(): Array<{
    pattern: string;
    improvement: number;
    timestamp: number;
  }> {
    const improvements = [];
    
    for (const [pattern, history] of this.performanceHistory.entries()) {
      if (history.length >= 10) {
        const recent = history.slice(-5);
        const older = history.slice(-10, -5);
        
        const recentRate = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const olderRate = older.reduce((sum, val) => sum + val, 0) / older.length;
        
        const improvement = recentRate - olderRate;
        
        if (improvement > 0.1) { // Improvement threshold
          improvements.push({
            pattern,
            improvement,
            timestamp: Date.now()
          });
        }
      }
    }

    return improvements.sort((a, b) => b.improvement - a.improvement);
  }

  async recordInteractionPattern(
    url: string,
    goal: string,
    steps: any[],
    success: boolean
  ): Promise<void> {
    this.db.recordInteractionPattern(url, goal, steps, success);
  }

  close(): void {
    this.db.close();
  }
}