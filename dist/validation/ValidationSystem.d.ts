export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
export interface ValidationResult {
    success: boolean;
    errors: ValidationError[];
    data?: any;
}
export declare class ValidationSystem {
    static validateUrl(url: string): ValidationResult;
    static validateTargets(targets: string[]): ValidationResult;
    static validateInteractions(interactions?: string[]): ValidationResult;
    static validateSelector(selector: string): ValidationResult;
    static validateTimeout(timeout?: number): ValidationResult;
    static validateHtml(html: string): ValidationResult;
    static validateScrapeRequest(request: any): ValidationResult;
    static validateAnalyzeDomRequest(request: any): ValidationResult;
    static validateGenerateScriptRequest(request: any): ValidationResult;
}
//# sourceMappingURL=ValidationSystem.d.ts.map