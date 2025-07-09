import { promises as fs } from 'fs';
import { join } from 'path';

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

export class FeedbackStore {
  private feedbackFile: string;
  private patternsFile: string;
  private feedback: FeedbackEntry[] = [];
  private patterns: Map<string, PatternData> = new Map();

  constructor(dataDir: string = './data') {
    this.feedbackFile = join(dataDir, 'feedback.json');
    this.patternsFile = join(dataDir, 'patterns.json');
    this.ensureDataDirectory(dataDir);
  }

  private async ensureDataDirectory(dataDir: string): Promise<void> {
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  async loadData(): Promise<void> {
    try {
      // Load feedback data
      const feedbackData = await fs.readFile(this.feedbackFile, 'utf-8');
      this.feedback = JSON.parse(feedbackData);
    } catch (error) {
      this.feedback = [];
    }

    try {
      // Load patterns data
      const patternsData = await fs.readFile(this.patternsFile, 'utf-8');
      const patternsArray = JSON.parse(patternsData);
      this.patterns = new Map(patternsArray.map((p: PatternData) => [this.getPatternKey(p.url, p.target), p]));
    } catch (error) {
      this.patterns = new Map();
    }
  }

  async recordFeedback(entry: Omit<FeedbackEntry, 'id' | 'timestamp'>): Promise<void> {
    const feedbackEntry: FeedbackEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now()
    };

    this.feedback.push(feedbackEntry);
    await this.updatePatterns(feedbackEntry);
    await this.saveFeedback();
  }

  private async updatePatterns(entry: FeedbackEntry): Promise<void> {
    const key = this.getPatternKey(entry.url, entry.target);
    const existing = this.patterns.get(key) || {
      url: entry.url,
      target: entry.target,
      selectors: { successful: [], failed: [] },
      interactions: { successful: [], failed: [] },
      confidence: 0.5,
      lastUpdated: Date.now()
    };

    // Update selector patterns
    if (entry.interactionType === 'scrape') {
      if (entry.success) {
        if (!existing.selectors.successful.includes(entry.selector)) {
          existing.selectors.successful.push(entry.selector);
        }
      } else {
        if (!existing.selectors.failed.includes(entry.selector)) {
          existing.selectors.failed.push(entry.selector);
        }
      }
    }

    // Update interaction patterns
    if (entry.interactionType && entry.interactionType !== 'scrape') {
      if (entry.success) {
        if (!existing.interactions.successful.includes(entry.selector)) {
          existing.interactions.successful.push(entry.selector);
        }
      } else {
        if (!existing.interactions.failed.includes(entry.selector)) {
          existing.interactions.failed.push(entry.selector);
        }
      }
    }

    // Update confidence based on success rate
    const totalSuccesses = existing.selectors.successful.length + existing.interactions.successful.length;
    const totalFailures = existing.selectors.failed.length + existing.interactions.failed.length;
    const total = totalSuccesses + totalFailures;
    
    if (total > 0) {
      existing.confidence = totalSuccesses / total;
    }

    existing.lastUpdated = Date.now();
    this.patterns.set(key, existing);
    await this.savePatterns();
  }

  async getSuggestedSelectors(url: string, target: string): Promise<{
    selectors: string[];
    confidence: number;
  }> {
    const key = this.getPatternKey(url, target);
    const pattern = this.patterns.get(key);
    
    if (!pattern) {
      return { selectors: [], confidence: 0 };
    }

    // Return successful selectors sorted by frequency
    const selectors = pattern.selectors.successful.filter(
      selector => !pattern.selectors.failed.includes(selector)
    );

    return {
      selectors,
      confidence: pattern.confidence
    };
  }

  async getSuggestedInteractions(url: string, target: string): Promise<{
    interactions: string[];
    confidence: number;
  }> {
    const key = this.getPatternKey(url, target);
    const pattern = this.patterns.get(key);
    
    if (!pattern) {
      return { interactions: [], confidence: 0 };
    }

    const interactions = pattern.interactions.successful.filter(
      interaction => !pattern.interactions.failed.includes(interaction)
    );

    return {
      interactions,
      confidence: pattern.confidence
    };
  }

  async getTrainingData(): Promise<{
    positive: FeedbackEntry[];
    negative: FeedbackEntry[];
  }> {
    const positive = this.feedback.filter(entry => entry.success);
    const negative = this.feedback.filter(entry => !entry.success);

    return { positive, negative };
  }

  async getPatternStats(): Promise<{
    totalPatterns: number;
    averageConfidence: number;
    topPatterns: Array<{
      url: string;
      target: string;
      confidence: number;
      successfulSelectors: number;
    }>;
  }> {
    const patterns = Array.from(this.patterns.values());
    const totalPatterns = patterns.length;
    const averageConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / totalPatterns || 0;
    
    const topPatterns = patterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
      .map(p => ({
        url: p.url,
        target: p.target,
        confidence: p.confidence,
        successfulSelectors: p.selectors.successful.length
      }));

    return {
      totalPatterns,
      averageConfidence,
      topPatterns
    };
  }

  private getPatternKey(url: string, target: string): string {
    // Create a normalized key from URL and target
    const domain = new URL(url).hostname;
    return `${domain}:${target.toLowerCase()}`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private async saveFeedback(): Promise<void> {
    await fs.writeFile(this.feedbackFile, JSON.stringify(this.feedback, null, 2));
  }

  private async savePatterns(): Promise<void> {
    const patternsArray = Array.from(this.patterns.values());
    await fs.writeFile(this.patternsFile, JSON.stringify(patternsArray, null, 2));
  }
}