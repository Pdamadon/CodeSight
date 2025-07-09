import { ScrapingAgent } from '../agents/ScrapingAgent.js';
import { ValidationSystem } from '../validation/ValidationSystem.js';
import { LearningDatabase } from '../database/LearningDatabase.js';
import { DOMAnalyzer } from '../analyzers/DOMAnalyzer.js';
export class TestRunner {
    agent;
    domAnalyzer;
    db;
    constructor() {
        this.agent = new ScrapingAgent();
        this.domAnalyzer = new DOMAnalyzer();
        this.db = new LearningDatabase('./test_data/test_learning.db');
    }
    async runAllTests() {
        const suites = [];
        console.log('🧪 Running CodeSight Test Suite...\n');
        // Run validation tests
        suites.push(await this.runValidationTests());
        // Run DOM analyzer tests
        suites.push(await this.runDOMAnalyzerTests());
        // Run learning system tests
        suites.push(await this.runLearningSystemTests());
        // Run integration tests
        suites.push(await this.runIntegrationTests());
        // Run error handling tests
        suites.push(await this.runErrorHandlingTests());
        this.printTestSummary(suites);
        return suites;
    }
    async runValidationTests() {
        const suite = {
            name: 'Validation System',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        const startTime = Date.now();
        // Test URL validation
        suite.tests.push(await this.runTest('Valid URL validation', () => {
            const result = ValidationSystem.validateUrl('https://example.com');
            if (!result.success)
                throw new Error('Valid URL should pass validation');
        }));
        suite.tests.push(await this.runTest('Invalid URL validation', () => {
            const result = ValidationSystem.validateUrl('invalid-url');
            if (result.success)
                throw new Error('Invalid URL should fail validation');
        }));
        // Test targets validation
        suite.tests.push(await this.runTest('Valid targets validation', () => {
            const result = ValidationSystem.validateTargets(['title', 'price']);
            if (!result.success)
                throw new Error('Valid targets should pass validation');
        }));
        suite.tests.push(await this.runTest('Empty targets validation', () => {
            const result = ValidationSystem.validateTargets([]);
            if (result.success)
                throw new Error('Empty targets should fail validation');
        }));
        // Test selector validation
        suite.tests.push(await this.runTest('Valid selector validation', () => {
            const result = ValidationSystem.validateSelector('.price');
            if (!result.success)
                throw new Error('Valid selector should pass validation');
        }));
        suite.tests.push(await this.runTest('Invalid selector validation', () => {
            const result = ValidationSystem.validateSelector('<<<invalid>>>');
            if (result.success)
                throw new Error('Invalid selector should fail validation');
        }));
        suite.duration = Date.now() - startTime;
        suite.passed = suite.tests.filter(t => t.passed).length;
        suite.failed = suite.tests.filter(t => !t.passed).length;
        return suite;
    }
    async runDOMAnalyzerTests() {
        const suite = {
            name: 'DOM Analyzer',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        const startTime = Date.now();
        // Test basic HTML analysis
        suite.tests.push(await this.runTest('Basic HTML analysis', async () => {
            const html = `
        <html>
          <body>
            <h1 class="title">Test Title</h1>
            <div class="price">$29.99</div>
            <p class="description">Test description</p>
          </body>
        </html>
      `;
            const result = await this.domAnalyzer.analyzeDOM({
                html,
                targets: ['title', 'price']
            });
            if (!result.selectors.title || !result.selectors.price) {
                throw new Error('Should find selectors for title and price');
            }
        }));
        // Test selector confidence scoring
        suite.tests.push(await this.runTest('Selector confidence scoring', async () => {
            const html = `
        <html>
          <body>
            <h1 class="title">Perfect Title Match</h1>
            <span class="price">$19.99</span>
          </body>
        </html>
      `;
            const result = await this.domAnalyzer.analyzeDOM({
                html,
                targets: ['title', 'price']
            });
            if (result.confidence.title <= 0.5 || result.confidence.price <= 0.5) {
                throw new Error('Should have high confidence for good matches');
            }
        }));
        suite.duration = Date.now() - startTime;
        suite.passed = suite.tests.filter(t => t.passed).length;
        suite.failed = suite.tests.filter(t => !t.passed).length;
        return suite;
    }
    async runLearningSystemTests() {
        const suite = {
            name: 'Learning System',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        const startTime = Date.now();
        // Test feedback recording
        suite.tests.push(await this.runTest('Feedback recording', () => {
            this.db.recordFeedback({
                timestamp: Date.now(),
                url: 'https://test.com',
                target: 'title',
                selector: 'h1',
                success: true,
                interactionType: 'scrape',
                htmlContext: '<html><h1>Test</h1></html>'
            });
            // If we get here without error, the test passed
        }));
        // Test pattern learning
        suite.tests.push(await this.runTest('Pattern learning', () => {
            // Record multiple successful uses of the same selector
            for (let i = 0; i < 5; i++) {
                this.db.recordFeedback({
                    timestamp: Date.now(),
                    url: 'https://test.com',
                    target: 'title',
                    selector: 'h1.title',
                    success: true,
                    interactionType: 'scrape',
                    htmlContext: '<html><h1 class="title">Test</h1></html>'
                });
            }
            const patterns = this.db.getBestSelectors('https://test.com', 'title');
            if (patterns.length === 0) {
                throw new Error('Should learn patterns from repeated successes');
            }
        }));
        // Test confidence calculation
        suite.tests.push(await this.runTest('Confidence calculation', () => {
            // Record successes and failures
            this.db.recordFeedback({
                timestamp: Date.now(),
                url: 'https://confidence-test.com',
                target: 'price',
                selector: '.price',
                success: true,
                interactionType: 'scrape',
                htmlContext: '<span class="price">$10</span>'
            });
            this.db.recordFeedback({
                timestamp: Date.now(),
                url: 'https://confidence-test.com',
                target: 'price',
                selector: '.price',
                success: false,
                interactionType: 'scrape',
                htmlContext: '<span class="price">$10</span>'
            });
            const patterns = this.db.getBestSelectors('https://confidence-test.com', 'price');
            if (patterns.length > 0 && patterns[0].confidence !== 0.5) {
                throw new Error('Confidence should be 0.5 for 1 success and 1 failure');
            }
        }));
        suite.duration = Date.now() - startTime;
        suite.passed = suite.tests.filter(t => t.passed).length;
        suite.failed = suite.tests.filter(t => !t.passed).length;
        return suite;
    }
    async runIntegrationTests() {
        const suite = {
            name: 'Integration Tests',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        const startTime = Date.now();
        // Test full scraping workflow with mock data
        suite.tests.push(await this.runTest('Mock scraping workflow', async () => {
            // This test uses a mock HTML string instead of real website
            const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1 class="main-title">Test Product</h1>
            <span class="price-display">$49.99</span>
            <div class="description">A great test product</div>
          </body>
        </html>
      `;
            // Test DOM analysis with mock data
            const analysis = await this.domAnalyzer.analyzeDOM({
                html: mockHtml,
                targets: ['title', 'price', 'description']
            });
            if (!analysis.selectors.title || !analysis.selectors.price) {
                throw new Error('Should find selectors for basic elements');
            }
            if (analysis.structure.title !== 'Test Page') {
                throw new Error('Should extract page title correctly');
            }
        }));
        // Test error handling integration
        suite.tests.push(await this.runTest('Error handling integration', async () => {
            const result = await this.agent.scrapeWebsite({
                url: 'https://definitely-not-a-real-domain-12345.com',
                targets: ['title'],
                timeout: 5000
            });
            // Should return unsuccessful result rather than throwing
            if (result.success) {
                throw new Error('Should have failed for invalid domain');
            }
            if (!result.errors || result.errors.length === 0) {
                throw new Error('Should have error messages for invalid domain');
            }
        }));
        suite.duration = Date.now() - startTime;
        suite.passed = suite.tests.filter(t => t.passed).length;
        suite.failed = suite.tests.filter(t => !t.passed).length;
        return suite;
    }
    async runErrorHandlingTests() {
        const suite = {
            name: 'Error Handling',
            tests: [],
            passed: 0,
            failed: 0,
            duration: 0
        };
        const startTime = Date.now();
        // Test validation error handling
        suite.tests.push(await this.runTest('Validation error handling', () => {
            const result = ValidationSystem.validateScrapeRequest({
                url: 'invalid-url',
                targets: []
            });
            if (result.success) {
                throw new Error('Should fail validation for invalid request');
            }
            if (result.errors.length === 0) {
                throw new Error('Should return validation errors');
            }
        }));
        // Test timeout handling
        suite.tests.push(await this.runTest('Timeout validation', () => {
            const result = ValidationSystem.validateTimeout(500); // Too short
            if (result.success) {
                throw new Error('Should fail for timeout too short');
            }
            const result2 = ValidationSystem.validateTimeout(400000); // Too long
            if (result2.success) {
                throw new Error('Should fail for timeout too long');
            }
            const result3 = ValidationSystem.validateTimeout(5000); // Just right
            if (!result3.success) {
                throw new Error('Should pass for valid timeout');
            }
        }));
        suite.duration = Date.now() - startTime;
        suite.passed = suite.tests.filter(t => t.passed).length;
        suite.failed = suite.tests.filter(t => !t.passed).length;
        return suite;
    }
    async runTest(name, testFn) {
        const startTime = Date.now();
        try {
            await testFn();
            return {
                name,
                passed: true,
                duration: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                name,
                passed: false,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    printTestSummary(suites) {
        console.log('\n📊 Test Results Summary:');
        console.log('='.repeat(50));
        let totalPassed = 0;
        let totalFailed = 0;
        let totalDuration = 0;
        for (const suite of suites) {
            const status = suite.failed === 0 ? '✅' : '❌';
            console.log(`${status} ${suite.name}: ${suite.passed}/${suite.passed + suite.failed} passed (${suite.duration}ms)`);
            // Show failed tests
            for (const test of suite.tests.filter(t => !t.passed)) {
                console.log(`  ❌ ${test.name}: ${test.error}`);
            }
            totalPassed += suite.passed;
            totalFailed += suite.failed;
            totalDuration += suite.duration;
        }
        console.log('='.repeat(50));
        console.log(`Total: ${totalPassed}/${totalPassed + totalFailed} passed (${totalDuration}ms)`);
        if (totalFailed === 0) {
            console.log('🎉 All tests passed!');
        }
        else {
            console.log(`⚠️  ${totalFailed} test(s) failed`);
        }
    }
    async cleanup() {
        await this.agent.close();
        this.db.close();
    }
}
//# sourceMappingURL=TestRunner.js.map