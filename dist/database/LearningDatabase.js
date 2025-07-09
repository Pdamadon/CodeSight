import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
export class LearningDatabase {
    db;
    constructor(databasePath = './data/learning.db') {
        // Ensure data directory exists
        const dir = join(databasePath, '..');
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        this.db = new Database(databasePath);
        this.initializeTables();
    }
    initializeTables() {
        // Create feedback table for storing all interactions
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        url TEXT NOT NULL,
        target TEXT NOT NULL,
        selector TEXT NOT NULL,
        success INTEGER NOT NULL,
        userCorrection TEXT,
        errorMessage TEXT,
        interactionType TEXT NOT NULL,
        elementText TEXT,
        elementAttributes TEXT,
        htmlContext TEXT NOT NULL,
        confidence REAL
      )
    `);
        // Create selector patterns table for learned successful selectors
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS selector_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        target TEXT NOT NULL,
        selector TEXT NOT NULL,
        successCount INTEGER DEFAULT 0,
        failureCount INTEGER DEFAULT 0,
        lastUsed INTEGER NOT NULL,
        confidence REAL DEFAULT 0.5,
        interactionType TEXT NOT NULL,
        UNIQUE(url, target, selector, interactionType)
      )
    `);
        // Create interaction patterns table for learned interaction sequences
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS interaction_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        goal TEXT NOT NULL,
        steps TEXT NOT NULL,
        successCount INTEGER DEFAULT 0,
        failureCount INTEGER DEFAULT 0,
        lastUsed INTEGER NOT NULL,
        confidence REAL DEFAULT 0.5,
        UNIQUE(url, goal, steps)
      )
    `);
        // Create indexes for better performance
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feedback_url_target ON feedback(url, target);
      CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback(timestamp);
      CREATE INDEX IF NOT EXISTS idx_selector_patterns_url_target ON selector_patterns(url, target);
      CREATE INDEX IF NOT EXISTS idx_selector_patterns_confidence ON selector_patterns(confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_interaction_patterns_url_goal ON interaction_patterns(url, goal);
    `);
    }
    recordFeedback(entry) {
        const stmt = this.db.prepare(`
      INSERT INTO feedback (
        timestamp, url, target, selector, success, userCorrection, 
        errorMessage, interactionType, elementText, elementAttributes, 
        htmlContext, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(entry.timestamp, entry.url, entry.target, entry.selector, entry.success ? 1 : 0, entry.userCorrection, entry.errorMessage, entry.interactionType, entry.elementText, entry.elementAttributes, entry.htmlContext, entry.confidence);
        // Update selector patterns
        this.updateSelectorPattern(entry);
    }
    updateSelectorPattern(entry) {
        const domain = new URL(entry.url).hostname;
        // Check if pattern exists
        const existing = this.db.prepare(`
      SELECT * FROM selector_patterns 
      WHERE url = ? AND target = ? AND selector = ? AND interactionType = ?
    `).get(domain, entry.target, entry.selector, entry.interactionType);
        if (existing) {
            // Update existing pattern
            const newSuccessCount = existing.successCount + (entry.success ? 1 : 0);
            const newFailureCount = existing.failureCount + (entry.success ? 0 : 1);
            const newConfidence = newSuccessCount / (newSuccessCount + newFailureCount);
            this.db.prepare(`
        UPDATE selector_patterns 
        SET successCount = ?, failureCount = ?, confidence = ?, lastUsed = ?
        WHERE id = ?
      `).run(newSuccessCount, newFailureCount, newConfidence, entry.timestamp, existing.id);
        }
        else {
            // Create new pattern
            this.db.prepare(`
        INSERT INTO selector_patterns (
          url, target, selector, successCount, failureCount, 
          lastUsed, confidence, interactionType
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(domain, entry.target, entry.selector, entry.success ? 1 : 0, entry.success ? 0 : 1, entry.timestamp, entry.success ? 1.0 : 0.0, entry.interactionType);
        }
    }
    getBestSelectors(url, target, interactionType = 'scrape') {
        const domain = new URL(url).hostname;
        return this.db.prepare(`
      SELECT * FROM selector_patterns 
      WHERE url = ? AND target = ? AND interactionType = ?
      AND confidence > 0.5
      ORDER BY confidence DESC, successCount DESC
      LIMIT 5
    `).all(domain, target, interactionType);
    }
    recordInteractionPattern(url, goal, steps, success) {
        const domain = new URL(url).hostname;
        const stepsJson = JSON.stringify(steps);
        const timestamp = Date.now();
        // Check if pattern exists
        const existing = this.db.prepare(`
      SELECT * FROM interaction_patterns 
      WHERE url = ? AND goal = ? AND steps = ?
    `).get(domain, goal, stepsJson);
        if (existing) {
            // Update existing pattern
            const newSuccessCount = existing.successCount + (success ? 1 : 0);
            const newFailureCount = existing.failureCount + (success ? 0 : 1);
            const newConfidence = newSuccessCount / (newSuccessCount + newFailureCount);
            this.db.prepare(`
        UPDATE interaction_patterns 
        SET successCount = ?, failureCount = ?, confidence = ?, lastUsed = ?
        WHERE id = ?
      `).run(newSuccessCount, newFailureCount, newConfidence, timestamp, existing.id);
        }
        else {
            // Create new pattern
            this.db.prepare(`
        INSERT INTO interaction_patterns (
          url, goal, steps, successCount, failureCount, 
          lastUsed, confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(domain, goal, stepsJson, success ? 1 : 0, success ? 0 : 1, timestamp, success ? 1.0 : 0.0);
        }
    }
    getBestInteractionPatterns(url, goal) {
        const domain = new URL(url).hostname;
        return this.db.prepare(`
      SELECT * FROM interaction_patterns 
      WHERE url = ? AND goal = ?
      AND confidence > 0.5
      ORDER BY confidence DESC, successCount DESC
      LIMIT 3
    `).all(domain, goal);
    }
    getLearningMetrics() {
        // Get total interactions and success rate
        const totalStats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalInteractions,
        SUM(success) as totalSuccesses
      FROM feedback
    `).get();
        const successRate = totalStats.totalInteractions > 0
            ? totalStats.totalSuccesses / totalStats.totalInteractions
            : 0;
        // Get pattern statistics
        const patternStats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalPatterns,
        AVG(confidence) as averageConfidence
      FROM selector_patterns
    `).get();
        // Get top performing selectors
        const topSelectors = this.db.prepare(`
      SELECT url, target, selector, confidence, successCount
      FROM selector_patterns
      WHERE confidence > 0.7
      ORDER BY confidence DESC, successCount DESC
      LIMIT 10
    `).all();
        // Get recent activity
        const recentActivity = this.db.prepare(`
      SELECT timestamp, url, target, success, interactionType
      FROM feedback
      ORDER BY timestamp DESC
      LIMIT 20
    `).all();
        return {
            totalInteractions: totalStats.totalInteractions,
            successRate,
            totalPatterns: patternStats.totalPatterns,
            averageConfidence: patternStats.averageConfidence || 0,
            topSelectors,
            recentActivity
        };
    }
    getTrainingData() {
        const positive = this.db.prepare(`
      SELECT * FROM feedback WHERE success = 1
      ORDER BY timestamp DESC
      LIMIT 1000
    `).all();
        const negative = this.db.prepare(`
      SELECT * FROM feedback WHERE success = 0
      ORDER BY timestamp DESC
      LIMIT 1000
    `).all();
        return { positive, negative };
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=LearningDatabase.js.map