export interface ScriptGenerationRequest {
    url: string;
    selectors: Record<string, string>;
    outputFormat: 'playwright' | 'puppeteer';
}
export declare class ScriptGenerator {
    generateScript(request: ScriptGenerationRequest): Promise<string>;
    private generatePlaywrightScript;
    private generatePuppeteerScript;
}
//# sourceMappingURL=ScriptGenerator.d.ts.map