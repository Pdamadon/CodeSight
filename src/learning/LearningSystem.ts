import { LearningDatabase } from '../database/LearningDatabase.js';
import { LLMPlanner } from '../agents/LLMPlanner.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

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
      // Rich learning context
      aiReasoning?: string;
      alternativeSelectors?: string[];
      pageStructure?: any;
      extractionStrategy?: string;
      expectedDataType?: string;
      actualDataExtracted?: any;
      domContext?: string;
      aiDecisionConfidence?: number;
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
      htmlContext: context.html,
      // Rich learning data
      aiReasoning: context.aiReasoning,
      alternativeSelectors: context.alternativeSelectors ? JSON.stringify(context.alternativeSelectors) : undefined,
      pageStructure: context.pageStructure ? JSON.stringify(context.pageStructure) : undefined,
      extractionStrategy: context.extractionStrategy,
      expectedDataType: context.expectedDataType,
      actualDataExtracted: context.actualDataExtracted ? JSON.stringify(context.actualDataExtracted) : undefined,
      domContext: context.domContext,
      aiDecisionConfidence: context.aiDecisionConfidence
    });

    this.updatePerformanceHistory(url, target, true);

    // Auto-export learning data periodically
    await this.maybeExportLearningData();
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
      // Rich learning context
      aiReasoning?: string;
      alternativeSelectors?: string[];
      pageStructure?: any;
      extractionStrategy?: string;
      expectedDataType?: string;
      actualDataExtracted?: any;
      domContext?: string;
      aiDecisionConfidence?: number;
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
      htmlContext: context.html,
      // Rich learning data
      aiReasoning: context.aiReasoning,
      alternativeSelectors: context.alternativeSelectors ? JSON.stringify(context.alternativeSelectors) : undefined,
      pageStructure: context.pageStructure ? JSON.stringify(context.pageStructure) : undefined,
      extractionStrategy: context.extractionStrategy,
      expectedDataType: context.expectedDataType,
      actualDataExtracted: context.actualDataExtracted ? JSON.stringify(context.actualDataExtracted) : undefined,
      domContext: context.domContext,
      aiDecisionConfidence: context.aiDecisionConfidence
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

  /**
   * Export learning data to JSON files for AI consumption
   */
  async exportLearningData(outputDir: string = './data/learning'): Promise<void> {
    try {
      // Create output directory if it doesn't exist
      const { mkdirSync, existsSync } = await import('fs');
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Export successful selector patterns
      const selectorPatterns = this.db.getAllSelectorPatterns();
      const selectorData = {
        timestamp: Date.now(),
        totalPatterns: selectorPatterns.length,
        patterns: selectorPatterns.map(pattern => ({
          domain: new URL(pattern.url).hostname,
          url: pattern.url,
          target: pattern.target,
          selector: pattern.selector,
          successCount: pattern.successCount,
          failureCount: pattern.failureCount,
          confidence: pattern.confidence,
          successRate: pattern.successCount / (pattern.successCount + pattern.failureCount),
          lastUsed: pattern.lastUsed,
          interactionType: pattern.interactionType
        }))
      };

      writeFileSync(
        join(outputDir, 'selector-patterns.json'),
        JSON.stringify(selectorData, null, 2)
      );

      // Export recent feedback for learning
      const recentFeedback = this.db.getRecentFeedback(1000); // Last 1000 interactions
      const feedbackData = {
        timestamp: Date.now(),
        totalFeedback: recentFeedback.length,
        successRate: recentFeedback.filter(f => f.success).length / recentFeedback.length,
        feedback: recentFeedback.map(feedback => ({
          timestamp: feedback.timestamp,
          domain: new URL(feedback.url).hostname,
          url: feedback.url,
          target: feedback.target,
          selector: feedback.selector,
          success: feedback.success,
          interactionType: feedback.interactionType,
          elementText: feedback.elementText,
          elementAttributes: feedback.elementAttributes ? JSON.parse(feedback.elementAttributes) : null,
          errorMessage: feedback.errorMessage,
          confidence: feedback.confidence
        }))
      };

      writeFileSync(
        join(outputDir, 'learning-feedback.json'),
        JSON.stringify(feedbackData, null, 2)
      );

      // Export domain-specific patterns
      const domainPatterns = this.groupPatternsByDomain(selectorPatterns);
      writeFileSync(
        join(outputDir, 'domain-patterns.json'),
        JSON.stringify(domainPatterns, null, 2)
      );

      // Export interaction patterns
      const interactionPatterns = this.db.getAllInteractionPatterns();
      const interactionData = {
        timestamp: Date.now(),
        totalPatterns: interactionPatterns.length,
        patterns: interactionPatterns.map(pattern => ({
          domain: new URL(pattern.url).hostname,
          url: pattern.url,
          goal: pattern.goal,
          steps: JSON.parse(pattern.steps),
          successCount: pattern.successCount,
          failureCount: pattern.failureCount,
          confidence: pattern.confidence,
          successRate: pattern.successCount / (pattern.successCount + pattern.failureCount),
          lastUsed: pattern.lastUsed
        }))
      };

      writeFileSync(
        join(outputDir, 'interaction-patterns.json'),
        JSON.stringify(interactionData, null, 2)
      );

      console.log(`✅ Learning data exported to ${outputDir}`);
    } catch (error) {
      console.error('❌ Failed to export learning data:', error);
    }
  }

  /**
   * Group selector patterns by domain for easier AI consumption
   */
  private groupPatternsByDomain(patterns: any[]): Record<string, any> {
    const domainGroups: Record<string, any> = {};
    
    for (const pattern of patterns) {
      const domain = new URL(pattern.url).hostname;
      
      if (!domainGroups[domain]) {
        domainGroups[domain] = {
          domain,
          totalPatterns: 0,
          successfulPatterns: 0,
          averageConfidence: 0,
          patterns: []
        };
      }
      
      domainGroups[domain].patterns.push({
        target: pattern.target,
        selector: pattern.selector,
        successCount: pattern.successCount,
        failureCount: pattern.failureCount,
        confidence: pattern.confidence,
        interactionType: pattern.interactionType
      });
      
      domainGroups[domain].totalPatterns++;
      if (pattern.confidence > 0.7) {
        domainGroups[domain].successfulPatterns++;
      }
    }
    
    // Calculate averages
    for (const domain in domainGroups) {
      const group = domainGroups[domain];
      group.averageConfidence = group.patterns.reduce((sum: number, p: any) => sum + p.confidence, 0) / group.patterns.length;
      group.successRate = group.successfulPatterns / group.totalPatterns;
    }
    
    return domainGroups;
  }

  /**
   * Auto-export learning data after significant learning events
   */
  async maybeExportLearningData(): Promise<void> {
    // Export every 50 successful interactions
    const metrics = await this.getLearningMetrics();
    if (metrics.totalInteractions % 50 === 0) {
      await this.exportLearningData();
    }
  }

  close(): void {
    this.db.close();
  }
}