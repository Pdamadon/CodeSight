import { chromium } from 'playwright';
import { DOMAnalyzer } from '../analyzers/DOMAnalyzer.js';
import { LLMPlanner } from './LLMPlanner.js';
import { InteractionPlanner } from './InteractionPlanner.js';
import { LearningSystem } from '../learning/LearningSystem.js';
import { ErrorHandler, CodeSightError } from '../errors/ErrorHandler.js';
import { Logger } from '../monitoring/Logger.js';
import { Monitor } from '../monitoring/Monitor.js';
import { AutonomousController } from '../ai/AutonomousController.js';
export class ScrapingAgent {
    browser = null;
    domAnalyzer;
    planner;
    interactionPlanner;
    learningSystem;
    logger;
    monitor;
    autonomousController;
    constructor() {
        this.domAnalyzer = new DOMAnalyzer();
        this.planner = new LLMPlanner();
        this.learningSystem = new LearningSystem();
        this.interactionPlanner = new InteractionPlanner(this.learningSystem);
        this.logger = Logger.getInstance();
        this.monitor = Monitor.getInstance();
        this.autonomousController = new AutonomousController(this.learningSystem);
        this.learningSystem.initialize().catch(console.error);
    }
    async scrapeWebsite(request) {
        const startTime = Date.now();
        const errors = [];
        const correlationId = this.generateCorrelationId();
        // Start monitoring and logging
        this.logger.logScrapeAttempt(request.url, request.targets, correlationId);
        const endTimer = this.logger.startTimer(`scrape_${new URL(request.url).hostname}`);
        try {
            await this.initializeBrowser(request.headless ?? true);
            const page = await this.browser.newPage();
            // Navigate to the page with error handling
            try {
                await page.goto(request.url, {
                    waitUntil: 'networkidle',
                    timeout: request.timeout ?? 30000
                });
            }
            catch (error) {
                throw ErrorHandler.handleBrowserError(error, { url: request.url });
            }
            // Wait for specific selector if provided
            if (request.waitForSelector) {
                try {
                    await page.waitForSelector(request.waitForSelector, { timeout: 10000 });
                }
                catch (error) {
                    const errorMsg = `Failed to find selector: ${request.waitForSelector}`;
                    errors.push(errorMsg);
                    throw ErrorHandler.createError('ELEMENT_NOT_FOUND', errorMsg, error, { selector: request.waitForSelector });
                }
            }
            // Check if autonomous mode is enabled
            if (request.autonomous) {
                // Use fully autonomous OpenAI-powered approach
                const autonomousResult = await this.autonomousController.executeAutonomousGoal(page, request.targets.join(', '), // Combine targets into a single goal
                10, // max steps
                request.timeout || 60000);
                await page.close();
                const result = {
                    success: autonomousResult.success,
                    data: autonomousResult.data,
                    selectors: {}, // Autonomous mode doesn't use predefined selectors
                    executionTime: Date.now() - startTime,
                    errors: autonomousResult.success ? undefined : ['Autonomous execution failed'],
                    autonomous: {
                        steps: autonomousResult.steps,
                        reasoning: autonomousResult.reasoning,
                        confidence: autonomousResult.confidence
                    }
                };
                // Log success and record metrics
                endTimer();
                if (autonomousResult.success) {
                    this.logger.logScrapeSuccess(request.url, result.executionTime, Object.keys(result.data).length);
                    this.monitor.recordScrapeResult(true, request.url, result.executionTime, Object.keys(result.data).length);
                }
                else {
                    this.logger.logScrapeFailure(request.url, 'Autonomous execution failed', result.executionTime);
                    this.monitor.recordScrapeResult(false, request.url, result.executionTime);
                }
                return result;
            }
            // Traditional approach with DOM analysis and interactions
            const html = await page.content();
            // Analyze DOM and generate selectors
            const analysis = await this.domAnalyzer.analyzeDOM({
                html,
                targets: request.targets
            });
            // Enhance selectors with learning system
            const enhancedSelectors = await this.learningSystem.getEnhancedSelectors(request.url, request.targets[0], // For now, use first target
            analysis.selectors);
            // Plan scraping strategy using LLM
            const plan = await this.planner.generateScrapingPlan({
                url: request.url,
                html: html.substring(0, 10000), // Limit HTML for LLM context
                targets: request.targets,
                suggestedSelectors: enhancedSelectors.selectors
            });
            // Execute the scraping plan
            const data = await this.executePlan(page, plan);
            // Handle interactions if specified
            let interactionResults;
            if (request.interactions && request.interactions.length > 0) {
                interactionResults = await this.executeInteractions(page, request.interactions, data);
            }
            await page.close();
            const result = {
                success: true,
                data: interactionResults?.finalData || data,
                selectors: plan.selectors,
                executionTime: Date.now() - startTime,
                errors: errors.length > 0 ? errors : undefined,
                interactions: interactionResults ? {
                    completed: interactionResults.completedSteps,
                    total: interactionResults.totalSteps,
                    results: interactionResults.finalData || {}
                } : undefined
            };
            // Log success and record metrics
            endTimer();
            this.logger.logScrapeSuccess(request.url, result.executionTime, Object.keys(result.data).length);
            this.monitor.recordScrapeResult(true, request.url, result.executionTime, Object.keys(result.data).length);
            return result;
        }
        catch (error) {
            // Handle different types of errors
            let codeSightError;
            if (error instanceof CodeSightError) {
                codeSightError = error;
            }
            else if (error instanceof Error) {
                codeSightError = ErrorHandler.handleGenericError(error, { url: request.url });
            }
            else {
                codeSightError = ErrorHandler.createError('UNKNOWN_ERROR', 'An unknown error occurred', undefined, { url: request.url });
            }
            errors.push(codeSightError.message);
            const result = {
                success: false,
                data: {},
                selectors: {},
                executionTime: Date.now() - startTime,
                errors
            };
            // Log failure and record metrics
            endTimer();
            this.logger.logScrapeFailure(request.url, codeSightError.message, result.executionTime);
            this.monitor.recordScrapeResult(false, request.url, result.executionTime);
            return result;
        }
    }
    async initializeBrowser(headless) {
        if (!this.browser) {
            try {
                this.browser = await chromium.launch({
                    headless,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                });
            }
            catch (error) {
                throw ErrorHandler.handleBrowserError(error, { headless });
            }
        }
    }
    async executePlan(page, plan) {
        const data = {};
        const html = await page.content();
        for (const [target, selector] of Object.entries(plan.selectors)) {
            try {
                // Try different extraction strategies
                const element = await page.$(selector);
                if (element) {
                    // Get text content
                    const textContent = await element.textContent();
                    // Get attribute values that might be useful
                    const href = await element.getAttribute('href');
                    const src = await element.getAttribute('src');
                    const value = await element.getAttribute('value');
                    const extractedData = {
                        text: textContent?.trim(),
                        href,
                        src,
                        value,
                        selector: selector
                    };
                    data[target] = extractedData;
                    // Record successful extraction
                    await this.learningSystem.recordSuccess(page.url(), target, selector, 'scrape', {
                        html: html.substring(0, 1000),
                        position: 0,
                        elementText: textContent?.trim(),
                        elementAttributes: {
                            href: href || undefined,
                            src: src || undefined,
                            value: value || undefined
                        }
                    });
                }
                else {
                    const errorMsg = `Element not found with selector: ${selector}`;
                    data[target] = {
                        text: null,
                        error: errorMsg,
                        selector: selector
                    };
                    // Record failed extraction
                    await this.learningSystem.recordFailure(page.url(), target, selector, errorMsg, 'scrape', {
                        html: html.substring(0, 1000),
                        position: 0
                    });
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                data[target] = {
                    text: null,
                    error: errorMsg,
                    selector: selector
                };
                // Record failed extraction
                await this.learningSystem.recordFailure(page.url(), target, selector, errorMsg, 'scrape', {
                    html: html.substring(0, 1000),
                    position: 0
                });
            }
        }
        return data;
    }
    async executeInteractions(page, interactions, currentData) {
        let allCompletedSteps = 0;
        let allTotalSteps = 0;
        let finalData = { ...currentData };
        const allErrors = [];
        for (const interaction of interactions) {
            try {
                // Get current page HTML for planning
                const html = await page.content();
                // Plan the interaction
                const plan = await this.interactionPlanner.planInteractions({
                    url: page.url(),
                    html: html.substring(0, 15000), // Limit HTML for planning
                    goal: interaction,
                    currentData: finalData
                });
                // Execute the interaction plan
                const result = await this.interactionPlanner.executeInteractionPlan(page, plan);
                allCompletedSteps += result.completedSteps;
                allTotalSteps += plan.steps.length;
                if (result.errors.length > 0) {
                    allErrors.push(...result.errors);
                }
                // Merge any new data from the interaction
                if (result.finalData) {
                    finalData = { ...finalData, ...result.finalData };
                }
                // Wait between interactions
                await page.waitForTimeout(2000);
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                allErrors.push(`Interaction "${interaction}" failed: ${errorMsg}`);
            }
        }
        return {
            completedSteps: allCompletedSteps,
            totalSteps: allTotalSteps,
            finalData,
            errors: allErrors
        };
    }
    async getLearningMetrics() {
        return await this.learningSystem.getLearningMetrics();
    }
    generateCorrelationId() {
        return `scrape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
//# sourceMappingURL=ScrapingAgent.js.map