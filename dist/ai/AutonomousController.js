import { AutonomousPlanner } from './AutonomousPlanner.js';
import { DOMAnalyzer } from '../analyzers/DOMAnalyzer.js';
import { Logger } from '../monitoring/Logger.js';
import { Monitor } from '../monitoring/Monitor.js';
export class AutonomousController {
    planner;
    domAnalyzer;
    learningSystem;
    logger;
    monitor;
    constructor(learningSystem) {
        this.planner = new AutonomousPlanner();
        this.domAnalyzer = new DOMAnalyzer();
        this.learningSystem = learningSystem;
        this.logger = Logger.getInstance();
        this.monitor = Monitor.getInstance();
    }
    async executeAutonomousGoal(page, goal, maxSteps = 10, timeout = 60000) {
        const startTime = Date.now();
        const steps = [];
        let currentData = {};
        const previousAttempts = [];
        this.logger.info('Starting autonomous goal execution', { goal, maxSteps });
        try {
            for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
                // Check timeout
                if (Date.now() - startTime > timeout) {
                    this.logger.warn('Autonomous execution timed out', {
                        goal,
                        stepIndex,
                        executionTime: Date.now() - startTime
                    });
                    break;
                }
                // Analyze current page state
                const context = await this.buildContext(page, goal, currentData, previousAttempts);
                // Make autonomous decision
                const decision = await this.planner.makeAutonomousDecision(context);
                this.logger.info('Autonomous decision made', {
                    step: stepIndex + 1,
                    action: decision.action,
                    confidence: decision.confidence,
                    reasoning: decision.reasoning
                });
                // Execute decision
                const stepResult = await this.executeDecision(page, decision, context);
                steps.push(stepResult);
                // Update current data
                if (stepResult.data) {
                    currentData = { ...currentData, ...stepResult.data };
                }
                // Record attempt
                previousAttempts.push(`${decision.action}:${stepResult.success}`);
                // Check if goal is achieved
                if (this.isGoalAchieved(goal, currentData, decision)) {
                    this.logger.info('Autonomous goal achieved', {
                        goal,
                        steps: stepIndex + 1,
                        executionTime: Date.now() - startTime
                    });
                    break;
                }
                // Brief pause between steps
                await page.waitForTimeout(1000);
            }
            const result = {
                success: Object.keys(currentData).length > 0,
                data: currentData,
                steps,
                reasoning: 'Autonomous execution completed',
                confidence: this.calculateOverallConfidence(steps),
                executionTime: Date.now() - startTime
            };
            this.monitor.recordLearningEvent('autonomous_goal_completion', {
                goal,
                success: result.success,
                steps: steps.length,
                executionTime: result.executionTime
            });
            return result;
        }
        catch (error) {
            this.logger.error('Autonomous execution failed', error, { goal });
            return {
                success: false,
                data: currentData,
                steps,
                reasoning: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                confidence: 0.1,
                executionTime: Date.now() - startTime
            };
        }
    }
    async buildContext(page, goal, currentData, previousAttempts) {
        const html = await page.content();
        const url = page.url();
        // Extract interactive elements
        const availableElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, a, input, select, textarea, [onclick], [role="button"]'));
            return elements.slice(0, 20).map((el, index) => ({
                tag: el.tagName.toLowerCase(),
                text: el.textContent?.trim().substring(0, 100) || '',
                attributes: {
                    id: el.id || '',
                    class: el.className || '',
                    type: el.getAttribute('type') || '',
                    href: el.getAttribute('href') || '',
                    role: el.getAttribute('role') || ''
                },
                selector: `${el.tagName.toLowerCase()}:nth-child(${index + 1})`
            }));
        });
        return {
            url,
            goal,
            currentHtml: html,
            previousAttempts,
            availableElements,
            currentData
        };
    }
    async executeDecision(page, decision, context) {
        try {
            switch (decision.action) {
                case 'scrape':
                    return await this.executeScrapeAction(page, decision, context);
                case 'click':
                    return await this.executeClickAction(page, decision);
                case 'fill':
                    return await this.executeFillAction(page, decision);
                case 'navigate':
                    return await this.executeNavigateAction(page, decision);
                case 'wait':
                    return await this.executeWaitAction(page, decision);
                case 'analyze':
                    return await this.executeAnalyzeAction(page, context);
                default:
                    throw new Error(`Unknown action: ${decision.action}`);
            }
        }
        catch (error) {
            this.logger.error('Decision execution failed', error, {
                action: decision.action,
                parameters: decision.parameters
            });
            return {
                action: decision.action,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async executeScrapeAction(page, decision, context) {
        const html = await page.content();
        // Use AI to generate improved selectors if we have failed attempts
        const failedSelectors = context.previousAttempts
            .filter(attempt => attempt.includes('scrape:false'))
            .map(attempt => 'previous_failed_selector');
        let selectors = {};
        if (failedSelectors.length > 0) {
            // Ask AI to generate better selectors based on failures
            const aiResult = await this.planner.generateImprovedSelectors(context, failedSelectors);
            selectors = aiResult.selectors;
            this.logger.info('AI generated improved selectors', {
                selectorsCount: Object.keys(selectors).length,
                confidence: aiResult.confidence
            });
        }
        else {
            // Use DOM analyzer as fallback
            const analysis = await this.domAnalyzer.analyzeDOM({
                html,
                targets: [context.goal]
            });
            selectors = analysis.selectors;
        }
        const data = {};
        // Try to extract data using selectors
        for (const [target, selector] of Object.entries(selectors)) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    const href = await element.getAttribute('href');
                    const src = await element.getAttribute('src');
                    const value = await element.getAttribute('value');
                    data[target] = {
                        text: text?.trim(),
                        href,
                        src,
                        value,
                        selector
                    };
                    // Record successful extraction for learning
                    await this.learningSystem.recordSuccess(context.url, target, selector, 'scrape', {
                        html: html.substring(0, 1000),
                        position: 0,
                        elementText: text?.trim(),
                        elementAttributes: {
                            href: href || undefined,
                            src: src || undefined,
                            value: value || undefined
                        }
                    });
                }
            }
            catch (error) {
                this.logger.warn('Failed to extract data', { target, selector, error });
                // Record failed extraction for learning
                await this.learningSystem.recordFailure(context.url, target, selector, error instanceof Error ? error.message : 'Unknown error', 'scrape', {
                    html: html.substring(0, 1000),
                    position: 0
                });
            }
        }
        return {
            action: 'scrape',
            success: Object.keys(data).length > 0,
            data
        };
    }
    async executeClickAction(page, decision) {
        const selector = decision.parameters.selector;
        if (!selector) {
            throw new Error('Click action requires selector parameter');
        }
        await page.click(selector);
        // Wait for potential navigation or content changes
        await page.waitForTimeout(2000);
        return {
            action: 'click',
            success: true,
            data: { clickedSelector: selector }
        };
    }
    async executeFillAction(page, decision) {
        const selector = decision.parameters.selector;
        const value = decision.parameters.value;
        if (!selector || !value) {
            throw new Error('Fill action requires selector and value parameters');
        }
        await page.fill(selector, value);
        return {
            action: 'fill',
            success: true,
            data: { filledSelector: selector, value }
        };
    }
    async executeNavigateAction(page, decision) {
        const url = decision.parameters.url;
        if (!url) {
            throw new Error('Navigate action requires url parameter');
        }
        await page.goto(url, { waitUntil: 'networkidle' });
        return {
            action: 'navigate',
            success: true,
            data: { navigatedTo: url }
        };
    }
    async executeWaitAction(page, decision) {
        const timeout = decision.parameters.timeout || 3000;
        const selector = decision.parameters.selector;
        if (selector) {
            await page.waitForSelector(selector, { timeout });
        }
        else {
            await page.waitForTimeout(timeout);
        }
        return {
            action: 'wait',
            success: true,
            data: { waitedFor: selector || `${timeout}ms` }
        };
    }
    async executeAnalyzeAction(page, context) {
        const html = await page.content();
        // Analyze page structure
        const analysis = await this.domAnalyzer.analyzeDOM({
            html,
            targets: [context.goal]
        });
        return {
            action: 'analyze',
            success: true,
            data: {
                structure: analysis.structure,
                suggestedSelectors: analysis.selectors,
                confidence: analysis.confidence
            }
        };
    }
    isGoalAchieved(goal, currentData, decision) {
        // Check if we have meaningful data related to the goal
        const hasData = Object.keys(currentData).length > 0;
        const hasRelevantData = Object.values(currentData).some(item => item && typeof item === 'object' && item.text && item.text.length > 0);
        // High confidence scraping action with data suggests goal achievement
        if (decision.action === 'scrape' && decision.confidence > 0.7 && hasRelevantData) {
            return true;
        }
        // Multiple pieces of data suggest comprehensive extraction
        if (Object.keys(currentData).length >= 2 && hasRelevantData) {
            return true;
        }
        return false;
    }
    calculateOverallConfidence(steps) {
        if (steps.length === 0)
            return 0;
        const successRate = steps.filter(s => s.success).length / steps.length;
        const hasDataExtractionSuccess = steps.some(s => s.action === 'scrape' && s.success);
        let confidence = successRate * 0.6; // Base confidence from success rate
        if (hasDataExtractionSuccess) {
            confidence += 0.2; // Bonus for successful data extraction
        }
        // Check quality of extracted data
        const dataQuality = this.assessDataQuality(steps);
        confidence += dataQuality * 0.2;
        return Math.min(confidence, 1.0);
    }
    assessDataQuality(steps) {
        const scrapeSteps = steps.filter(s => s.action === 'scrape' && s.success && s.data);
        if (scrapeSteps.length === 0)
            return 0;
        let totalQuality = 0;
        let qualityCount = 0;
        for (const step of scrapeSteps) {
            if (step.data) {
                for (const item of Object.values(step.data)) {
                    if (item && typeof item === 'object' && 'text' in item) {
                        const textLength = item.text?.length || 0;
                        const hasRelevantContent = textLength > 10 && textLength < 1000;
                        const hasConfidence = item.confidence || 0;
                        const quality = (hasRelevantContent ? 0.5 : 0) + (hasConfidence * 0.5);
                        totalQuality += quality;
                        qualityCount++;
                    }
                }
            }
        }
        return qualityCount > 0 ? totalQuality / qualityCount : 0;
    }
    analyzePageStructure(html, url) {
        const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 'Unknown';
        const headings = Array.from(html.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi)).map(match => match[1]);
        const links = (html.match(/<a[^>]*href/gi) || []).length;
        const forms = (html.match(/<form[^>]*>/gi) || []).length;
        const images = (html.match(/<img[^>]*>/gi) || []).length;
        // Infer content type from URL and content patterns
        let contentType = 'generic';
        const urlLower = url.toLowerCase();
        const htmlLower = html.toLowerCase();
        if (urlLower.includes('news') || urlLower.includes('bbc') || urlLower.includes('cnn') ||
            htmlLower.includes('article') || htmlLower.includes('headline') || htmlLower.includes('byline')) {
            contentType = 'news';
        }
        else if (urlLower.includes('amazon') || urlLower.includes('shop') || urlLower.includes('store') ||
            htmlLower.includes('price') || htmlLower.includes('cart') || htmlLower.includes('buy')) {
            contentType = 'ecommerce';
        }
        else if (urlLower.includes('twitter') || urlLower.includes('facebook') || urlLower.includes('instagram') ||
            htmlLower.includes('tweet') || htmlLower.includes('post') || htmlLower.includes('social')) {
            contentType = 'social';
        }
        else if (urlLower.includes('search') || urlLower.includes('google') || urlLower.includes('duckduckgo') ||
            htmlLower.includes('search') || htmlLower.includes('results')) {
            contentType = 'search';
        }
        else if (urlLower.includes('wikipedia') || urlLower.includes('wiki') ||
            htmlLower.includes('encyclopedia') || htmlLower.includes('references')) {
            contentType = 'wiki';
        }
        return { title, headings, links, forms, images, contentType };
    }
    buildExtractionTargets(goal, currentData) {
        const targets = [];
        const goalLower = goal.toLowerCase();
        // Parse common extraction targets from goal
        if (goalLower.includes('title') || goalLower.includes('headline')) {
            targets.push({
                name: 'title',
                expected: 'Main page or article title',
                currentValue: currentData.title,
                confidence: currentData.title ? 0.9 : 0.0
            });
        }
        if (goalLower.includes('headline') || goalLower.includes('heading')) {
            targets.push({
                name: 'headline',
                expected: 'News article headline or main heading',
                currentValue: currentData.headline,
                confidence: currentData.headline ? 0.9 : 0.0
            });
        }
        if (goalLower.includes('price') || goalLower.includes('cost')) {
            targets.push({
                name: 'price',
                expected: 'Product price or cost information',
                currentValue: currentData.price,
                confidence: currentData.price ? 0.9 : 0.0
            });
        }
        if (goalLower.includes('summary') || goalLower.includes('description')) {
            targets.push({
                name: 'summary',
                expected: 'Article summary or product description',
                currentValue: currentData.summary,
                confidence: currentData.summary ? 0.9 : 0.0
            });
        }
        // Add generic targets if none found
        if (targets.length === 0) {
            targets.push({
                name: 'content',
                expected: 'Main content related to: ' + goal,
                currentValue: currentData.content,
                confidence: currentData.content ? 0.7 : 0.0
            });
        }
        return targets;
    }
    analyzeFailures(previousAttempts) {
        const failedSelectors = [];
        const reasons = [];
        const suggestions = [];
        for (const attempt of previousAttempts) {
            if (attempt.includes('scrape:false')) {
                failedSelectors.push(attempt.split(':')[0] || 'unknown_selector');
                reasons.push('Element not found or no content extracted');
                suggestions.push('Try more specific selectors or check for dynamic content');
            }
            if (attempt.includes('click:false')) {
                reasons.push('Click target not found or not clickable');
                suggestions.push('Look for alternative clickable elements or wait for page load');
            }
        }
        return { failedSelectors, reasons, suggestions };
    }
    calculateExtractionConfidence(text, target, context) {
        if (!text)
            return 0;
        let confidence = 0.5; // Base confidence
        // Check text quality
        const textLength = text.length;
        if (textLength > 5 && textLength < 500) {
            confidence += 0.2;
        }
        // Check relevance to target
        const targetWords = target.toLowerCase().split(' ');
        const textLower = text.toLowerCase();
        const relevantWords = targetWords.filter(word => textLower.includes(word));
        confidence += (relevantWords.length / targetWords.length) * 0.2;
        // Check relevance to goal
        const goalWords = context.goal.toLowerCase().split(' ');
        const relevantGoalWords = goalWords.filter(word => textLower.includes(word));
        confidence += (relevantGoalWords.length / goalWords.length) * 0.1;
        return Math.min(confidence, 1.0);
    }
    validateExtractionQuality(data, target, context) {
        if (!data || !data.text)
            return false;
        const text = data.text.trim();
        // Basic quality checks
        if (text.length < 2)
            return false;
        if (text.length > 2000)
            return false; // Probably extracted too much
        // Check for common extraction errors
        const commonErrors = ['null', 'undefined', 'NaN', '[]', '{}', 'function', 'object Object'];
        if (commonErrors.some(error => text.includes(error)))
            return false;
        // Check relevance to target
        const targetWords = target.toLowerCase().split(' ');
        const textLower = text.toLowerCase();
        const hasRelevantContent = targetWords.some(word => textLower.includes(word)) ||
            context.goal.toLowerCase().split(' ').some(word => textLower.includes(word));
        return hasRelevantContent;
    }
}
//# sourceMappingURL=AutonomousController.js.map