export interface DOMAnalysisRequest {
    html: string;
    targets: string[];
}
export interface DOMAnalysisResult {
    selectors: Record<string, string>;
    confidence: Record<string, number>;
    alternatives: Record<string, string[]>;
    structure: {
        title: string;
        forms: number;
        links: number;
        images: number;
        depth: number;
    };
}
export declare class DOMAnalyzer {
    analyzeDOM(request: DOMAnalysisRequest): Promise<DOMAnalysisResult>;
    private findSelectorsForTarget;
    private calculateSelectorScore;
    private searchByTextContent;
    private calculateDepth;
}
//# sourceMappingURL=DOMAnalyzer.d.ts.map