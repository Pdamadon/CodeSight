import { promises as fs } from 'fs';
import { join } from 'path';
export class FeedbackStore {
    feedbackFile;
    patternsFile;
    feedback = [];
    patterns = new Map();
    constructor(dataDir = './data') {
        this.feedbackFile = join(dataDir, 'feedback.json');
        this.patternsFile = join(dataDir, 'patterns.json');
        this.ensureDataDirectory(dataDir);
    }
    async ensureDataDirectory(dataDir) {
        try {
            await fs.mkdir(dataDir, { recursive: true });
        }
        catch (error) {
            // Directory might already exist
        }
    }
    async loadData() {
        try {
            // Load feedback data
            const feedbackData = await fs.readFile(this.feedbackFile, 'utf-8');
            this.feedback = JSON.parse(feedbackData);
        }
        catch (error) {
            this.feedback = [];
        }
        try {
            // Load patterns data
            const patternsData = await fs.readFile(this.patternsFile, 'utf-8');
            const patternsArray = JSON.parse(patternsData);
            this.patterns = new Map(patternsArray.map((p) => [this.getPatternKey(p.url, p.target), p]));
        }
        catch (error) {
            this.patterns = new Map();
        }
    }
    async recordFeedback(entry) {
        const feedbackEntry = {
            ...entry,
            id: this.generateId(),
            timestamp: Date.now()
        };
        this.feedback.push(feedbackEntry);
        await this.updatePatterns(feedbackEntry);
        await this.saveFeedback();
    }
    async updatePatterns(entry) {
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
            }
            else {
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
            }
            else {
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
    async getSuggestedSelectors(url, target) {
        const key = this.getPatternKey(url, target);
        const pattern = this.patterns.get(key);
        if (!pattern) {
            return { selectors: [], confidence: 0 };
        }
        // Return successful selectors sorted by frequency
        const selectors = pattern.selectors.successful.filter(selector => !pattern.selectors.failed.includes(selector));
        return {
            selectors,
            confidence: pattern.confidence
        };
    }
    async getSuggestedInteractions(url, target) {
        const key = this.getPatternKey(url, target);
        const pattern = this.patterns.get(key);
        if (!pattern) {
            return { interactions: [], confidence: 0 };
        }
        const interactions = pattern.interactions.successful.filter(interaction => !pattern.interactions.failed.includes(interaction));
        return {
            interactions,
            confidence: pattern.confidence
        };
    }
    async getTrainingData() {
        const positive = this.feedback.filter(entry => entry.success);
        const negative = this.feedback.filter(entry => !entry.success);
        return { positive, negative };
    }
    async getPatternStats() {
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
    getPatternKey(url, target) {
        // Create a normalized key from URL and target
        const domain = new URL(url).hostname;
        return `${domain}:${target.toLowerCase()}`;
    }
    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    async saveFeedback() {
        await fs.writeFile(this.feedbackFile, JSON.stringify(this.feedback, null, 2));
    }
    async savePatterns() {
        const patternsArray = Array.from(this.patterns.values());
        await fs.writeFile(this.patternsFile, JSON.stringify(patternsArray, null, 2));
    }
}
//# sourceMappingURL=FeedbackStore.js.map