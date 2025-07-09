export interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
}
export interface TestSuite {
    name: string;
    tests: TestResult[];
    passed: number;
    failed: number;
    duration: number;
}
export declare class TestRunner {
    private agent;
    private domAnalyzer;
    private db;
    constructor();
    runAllTests(): Promise<TestSuite[]>;
    private runValidationTests;
    private runDOMAnalyzerTests;
    private runLearningSystemTests;
    private runIntegrationTests;
    private runErrorHandlingTests;
    private runTest;
    private printTestSummary;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=TestRunner.d.ts.map