import { LLMPlanner } from './LLMPlanner.js';
import { LearningSystem } from '../learning/LearningSystem.js';
import { Monitor } from '../monitoring/Monitor.js';
export class InteractionPlanner {
    llmPlanner;
    learningSystem;
    monitor;
    constructor(learningSystem) {
        this.llmPlanner = new LLMPlanner();
        this.learningSystem = learningSystem || new LearningSystem();
        this.monitor = Monitor.getInstance();
    }
    async planInteractions(request) {
        // First, check if we have learned patterns for this interaction
        const learnedPatterns = await this.learningSystem.getEnhancedInteractions(request.url, request.goal);
        if (learnedPatterns.interactions.length > 0 && learnedPatterns.confidence > 0.6) {
            return {
                steps: learnedPatterns.interactions,
                expectedOutcome: `Execute learned pattern for: ${request.goal}`,
                confidence: learnedPatterns.confidence,
                reasoning: learnedPatterns.reasoning
            };
        }
        // Fall back to LLM planning
        try {
            const response = await this.llmPlanner.generateScrapingPlan({
                url: request.url,
                html: request.html,
                targets: [request.goal],
                suggestedSelectors: {}
            });
            return this.parseInteractionResponse(response.reasoning, request.goal);
        }
        catch (error) {
            return this.generateFallbackPlan(request.goal);
        }
    }
    async executeInteractionPlan(page, plan) {
        const errors = [];
        let completedSteps = 0;
        try {
            for (const step of plan.steps) {
                try {
                    await this.executeStep(page, step);
                    completedSteps++;
                    // Record successful interaction
                    this.monitor.recordInteraction(step.type, true, step.selector || '');
                    // Wait between steps to allow for dynamic content
                    await page.waitForTimeout(1000);
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Step ${completedSteps + 1} (${step.type}): ${errorMsg}`);
                    // Record failed interaction
                    this.monitor.recordInteraction(step.type, false, step.selector || '');
                    // Try to continue with remaining steps
                    if (step.type === 'click' || step.type === 'fill') {
                        continue;
                    }
                    else {
                        break; // Stop for navigation or critical errors
                    }
                }
            }
            // Extract final data after interactions
            const finalData = await this.extractFinalData(page);
            const success = completedSteps === plan.steps.length;
            // Record the interaction pattern for learning
            await this.learningSystem.recordInteractionPattern(page.url(), plan.expectedOutcome, plan.steps, success);
            return {
                success,
                completedSteps,
                errors,
                finalData
            };
        }
        catch (error) {
            errors.push(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Record the failed interaction pattern
            await this.learningSystem.recordInteractionPattern(page.url(), plan.expectedOutcome, plan.steps, false);
            return {
                success: false,
                completedSteps,
                errors
            };
        }
    }
    async executeStep(page, step) {
        switch (step.type) {
            case 'click':
                if (!step.selector)
                    throw new Error('Click step requires selector');
                await page.click(step.selector, { timeout: step.timeout || 5000 });
                break;
            case 'fill':
                if (!step.selector || !step.value)
                    throw new Error('Fill step requires selector and value');
                await page.fill(step.selector, step.value, { timeout: step.timeout || 5000 });
                break;
            case 'select':
                if (!step.selector || !step.value)
                    throw new Error('Select step requires selector and value');
                await page.selectOption(step.selector, step.value, { timeout: step.timeout || 5000 });
                break;
            case 'wait':
                if (step.selector) {
                    await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
                }
                else {
                    await page.waitForTimeout(step.timeout || 2000);
                }
                break;
            case 'scroll':
                if (step.selector) {
                    await page.locator(step.selector).scrollIntoViewIfNeeded();
                }
                else {
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                }
                break;
            case 'navigate':
                if (!step.value)
                    throw new Error('Navigate step requires URL');
                await page.goto(step.value, { waitUntil: 'networkidle' });
                break;
            default:
                throw new Error(`Unknown step type: ${step.type}`);
        }
    }
    async extractFinalData(page) {
        return await page.evaluate(() => {
            // Extract common data patterns after interactions
            const data = {};
            // Try to extract any new content that appeared
            const results = document.querySelectorAll('[data-testid*="result"], .result, .item, .product');
            if (results.length > 0) {
                data.results = Array.from(results).map((el, i) => ({
                    index: i,
                    text: el.textContent?.trim(),
                    html: el.innerHTML.substring(0, 200)
                }));
            }
            // Check for error messages
            const errors = document.querySelectorAll('.error, .alert, [role="alert"]');
            if (errors.length > 0) {
                data.errors = Array.from(errors).map(el => el.textContent?.trim());
            }
            // Check for success indicators
            const success = document.querySelectorAll('.success, .complete, .done');
            if (success.length > 0) {
                data.success = true;
                data.successMessages = Array.from(success).map(el => el.textContent?.trim());
            }
            return data;
        });
    }
    buildInteractionPrompt(request) {
        return `
Analyze this webpage and create a step-by-step interaction plan to achieve the goal.

URL: ${request.url}
Goal: ${request.goal}

HTML (truncated):
\`\`\`html
${request.html}
\`\`\`

Current Data: ${JSON.stringify(request.currentData, null, 2)}

Create a plan with specific steps to:
1. Click buttons, links, or interactive elements
2. Fill forms with appropriate data
3. Navigate through multi-step processes
4. Extract results after interactions

Common interaction patterns:
- Click "Load More" or pagination buttons
- Fill search forms and submit
- Navigate through product listings
- Handle modals and dropdowns
- Wait for dynamic content to load

Provide a JSON response with:
1. "steps": array of interaction steps
2. "expectedOutcome": what should happen after execution
3. "confidence": score 0-1 for plan success likelihood
4. "reasoning": explanation of the approach

Step types: click, fill, select, wait, scroll, navigate
`;
    }
    parseInteractionResponse(reasoning, goal) {
        // Try to extract structured plan from reasoning
        // This is a simplified parser - in production, you'd use the LLM to generate structured JSON
        const steps = [];
        // Look for common patterns in the goal
        if (goal.toLowerCase().includes('click')) {
            steps.push({
                type: 'click',
                selector: 'button, .button, .btn, [role="button"]',
                description: 'Click interactive element'
            });
        }
        if (goal.toLowerCase().includes('search')) {
            steps.push({
                type: 'fill',
                selector: 'input[type="search"], input[name*="search"], .search-input',
                value: 'search query',
                description: 'Fill search form'
            });
            steps.push({
                type: 'click',
                selector: 'button[type="submit"], .search-button, .search-btn',
                description: 'Submit search'
            });
        }
        if (goal.toLowerCase().includes('load') || goal.toLowerCase().includes('more')) {
            steps.push({
                type: 'click',
                selector: '.load-more, .show-more, .next, .pagination a',
                description: 'Load more content'
            });
        }
        // Add a wait step for dynamic content
        steps.push({
            type: 'wait',
            timeout: 3000,
            description: 'Wait for content to load'
        });
        return {
            steps,
            expectedOutcome: `Successfully completed: ${goal}`,
            confidence: 0.7,
            reasoning: reasoning || 'Generated interaction plan based on goal analysis'
        };
    }
    generateFallbackPlan(goal) {
        return {
            steps: [
                {
                    type: 'wait',
                    timeout: 2000,
                    description: 'Wait for page to stabilize'
                }
            ],
            expectedOutcome: `Attempted to achieve: ${goal}`,
            confidence: 0.3,
            reasoning: 'Fallback plan due to planning error'
        };
    }
}
//# sourceMappingURL=InteractionPlanner.js.map