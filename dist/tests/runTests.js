#!/usr/bin/env node
import { TestRunner } from './TestRunner.js';
async function main() {
    const runner = new TestRunner();
    try {
        const suites = await runner.runAllTests();
        // Exit with error code if any tests failed
        const totalFailed = suites.reduce((sum, suite) => sum + suite.failed, 0);
        process.exit(totalFailed > 0 ? 1 : 0);
    }
    catch (error) {
        console.error('Test runner failed:', error);
        process.exit(1);
    }
    finally {
        await runner.cleanup();
    }
}
main().catch(console.error);
//# sourceMappingURL=runTests.js.map