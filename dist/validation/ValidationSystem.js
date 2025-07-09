import { z } from 'zod';
export class ValidationSystem {
    static validateUrl(url) {
        try {
            const urlSchema = z.string().url();
            urlSchema.parse(url);
            // Additional URL validation
            const urlObj = new URL(url);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return {
                    success: false,
                    errors: [{
                            field: 'url',
                            message: 'URL must use HTTP or HTTPS protocol',
                            code: 'INVALID_PROTOCOL'
                        }]
                };
            }
            return { success: true, errors: [], data: url };
        }
        catch (error) {
            return {
                success: false,
                errors: [{
                        field: 'url',
                        message: 'Invalid URL format',
                        code: 'INVALID_URL'
                    }]
            };
        }
    }
    static validateTargets(targets) {
        const errors = [];
        if (!Array.isArray(targets)) {
            errors.push({
                field: 'targets',
                message: 'Targets must be an array',
                code: 'INVALID_TYPE'
            });
            return { success: false, errors };
        }
        if (targets.length === 0) {
            errors.push({
                field: 'targets',
                message: 'At least one target is required',
                code: 'EMPTY_ARRAY'
            });
            return { success: false, errors };
        }
        if (targets.length > 20) {
            errors.push({
                field: 'targets',
                message: 'Maximum 20 targets allowed',
                code: 'ARRAY_TOO_LARGE'
            });
            return { success: false, errors };
        }
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (typeof target !== 'string') {
                errors.push({
                    field: `targets[${i}]`,
                    message: 'Target must be a string',
                    code: 'INVALID_TYPE'
                });
            }
            else if (target.trim().length === 0) {
                errors.push({
                    field: `targets[${i}]`,
                    message: 'Target cannot be empty',
                    code: 'EMPTY_STRING'
                });
            }
            else if (target.length > 100) {
                errors.push({
                    field: `targets[${i}]`,
                    message: 'Target must be less than 100 characters',
                    code: 'STRING_TOO_LONG'
                });
            }
        }
        return errors.length > 0 ? { success: false, errors } : { success: true, errors: [] };
    }
    static validateInteractions(interactions) {
        if (!interactions) {
            return { success: true, errors: [] };
        }
        const errors = [];
        if (!Array.isArray(interactions)) {
            errors.push({
                field: 'interactions',
                message: 'Interactions must be an array',
                code: 'INVALID_TYPE'
            });
            return { success: false, errors };
        }
        if (interactions.length > 10) {
            errors.push({
                field: 'interactions',
                message: 'Maximum 10 interactions allowed',
                code: 'ARRAY_TOO_LARGE'
            });
            return { success: false, errors };
        }
        for (let i = 0; i < interactions.length; i++) {
            const interaction = interactions[i];
            if (typeof interaction !== 'string') {
                errors.push({
                    field: `interactions[${i}]`,
                    message: 'Interaction must be a string',
                    code: 'INVALID_TYPE'
                });
            }
            else if (interaction.trim().length === 0) {
                errors.push({
                    field: `interactions[${i}]`,
                    message: 'Interaction cannot be empty',
                    code: 'EMPTY_STRING'
                });
            }
            else if (interaction.length > 200) {
                errors.push({
                    field: `interactions[${i}]`,
                    message: 'Interaction must be less than 200 characters',
                    code: 'STRING_TOO_LONG'
                });
            }
        }
        return errors.length > 0 ? { success: false, errors } : { success: true, errors: [] };
    }
    static validateSelector(selector) {
        if (typeof selector !== 'string') {
            return {
                success: false,
                errors: [{
                        field: 'selector',
                        message: 'Selector must be a string',
                        code: 'INVALID_TYPE'
                    }]
            };
        }
        if (selector.trim().length === 0) {
            return {
                success: false,
                errors: [{
                        field: 'selector',
                        message: 'Selector cannot be empty',
                        code: 'EMPTY_STRING'
                    }]
            };
        }
        if (selector.length > 500) {
            return {
                success: false,
                errors: [{
                        field: 'selector',
                        message: 'Selector must be less than 500 characters',
                        code: 'STRING_TOO_LONG'
                    }]
            };
        }
        // Basic CSS selector validation
        try {
            // Try to use the selector in a document query (will throw if invalid)
            document.querySelector(selector);
        }
        catch (error) {
            // Skip validation in Node.js environment
            if (typeof document === 'undefined') {
                // Basic syntax checks for Node.js
                if (selector.includes('<<') || selector.includes('>>')) {
                    return {
                        success: false,
                        errors: [{
                                field: 'selector',
                                message: 'Invalid CSS selector syntax',
                                code: 'INVALID_SELECTOR'
                            }]
                    };
                }
            }
            else {
                return {
                    success: false,
                    errors: [{
                            field: 'selector',
                            message: 'Invalid CSS selector syntax',
                            code: 'INVALID_SELECTOR'
                        }]
                };
            }
        }
        return { success: true, errors: [] };
    }
    static validateTimeout(timeout) {
        if (timeout === undefined) {
            return { success: true, errors: [] };
        }
        if (typeof timeout !== 'number') {
            return {
                success: false,
                errors: [{
                        field: 'timeout',
                        message: 'Timeout must be a number',
                        code: 'INVALID_TYPE'
                    }]
            };
        }
        if (timeout < 1000) {
            return {
                success: false,
                errors: [{
                        field: 'timeout',
                        message: 'Timeout must be at least 1000ms',
                        code: 'VALUE_TOO_SMALL'
                    }]
            };
        }
        if (timeout > 300000) { // 5 minutes
            return {
                success: false,
                errors: [{
                        field: 'timeout',
                        message: 'Timeout must be less than 300000ms (5 minutes)',
                        code: 'VALUE_TOO_LARGE'
                    }]
            };
        }
        return { success: true, errors: [] };
    }
    static validateHtml(html) {
        if (typeof html !== 'string') {
            return {
                success: false,
                errors: [{
                        field: 'html',
                        message: 'HTML must be a string',
                        code: 'INVALID_TYPE'
                    }]
            };
        }
        if (html.trim().length === 0) {
            return {
                success: false,
                errors: [{
                        field: 'html',
                        message: 'HTML cannot be empty',
                        code: 'EMPTY_STRING'
                    }]
            };
        }
        if (html.length > 1000000) { // 1MB
            return {
                success: false,
                errors: [{
                        field: 'html',
                        message: 'HTML must be less than 1MB',
                        code: 'STRING_TOO_LONG'
                    }]
            };
        }
        // Basic HTML validation
        if (!html.includes('<')) {
            return {
                success: false,
                errors: [{
                        field: 'html',
                        message: 'Invalid HTML format',
                        code: 'INVALID_HTML'
                    }]
            };
        }
        return { success: true, errors: [] };
    }
    static validateScrapeRequest(request) {
        const errors = [];
        // Validate URL
        const urlValidation = this.validateUrl(request.url);
        if (!urlValidation.success) {
            errors.push(...urlValidation.errors);
        }
        // Validate targets
        const targetsValidation = this.validateTargets(request.targets);
        if (!targetsValidation.success) {
            errors.push(...targetsValidation.errors);
        }
        // Validate interactions
        const interactionsValidation = this.validateInteractions(request.interactions);
        if (!interactionsValidation.success) {
            errors.push(...interactionsValidation.errors);
        }
        // Validate timeout
        const timeoutValidation = this.validateTimeout(request.timeout);
        if (!timeoutValidation.success) {
            errors.push(...timeoutValidation.errors);
        }
        // Validate waitForSelector if provided
        if (request.waitForSelector) {
            const selectorValidation = this.validateSelector(request.waitForSelector);
            if (!selectorValidation.success) {
                errors.push(...selectorValidation.errors.map(e => ({
                    ...e,
                    field: 'waitForSelector'
                })));
            }
        }
        return errors.length > 0 ? { success: false, errors } : { success: true, errors: [] };
    }
    static validateAnalyzeDomRequest(request) {
        const errors = [];
        // Validate HTML
        const htmlValidation = this.validateHtml(request.html);
        if (!htmlValidation.success) {
            errors.push(...htmlValidation.errors);
        }
        // Validate targets
        const targetsValidation = this.validateTargets(request.targets);
        if (!targetsValidation.success) {
            errors.push(...targetsValidation.errors);
        }
        return errors.length > 0 ? { success: false, errors } : { success: true, errors: [] };
    }
    static validateGenerateScriptRequest(request) {
        const errors = [];
        // Validate URL
        const urlValidation = this.validateUrl(request.url);
        if (!urlValidation.success) {
            errors.push(...urlValidation.errors);
        }
        // Validate selectors
        if (!request.selectors || typeof request.selectors !== 'object') {
            errors.push({
                field: 'selectors',
                message: 'Selectors must be an object',
                code: 'INVALID_TYPE'
            });
        }
        else {
            const selectorEntries = Object.entries(request.selectors);
            if (selectorEntries.length === 0) {
                errors.push({
                    field: 'selectors',
                    message: 'At least one selector is required',
                    code: 'EMPTY_OBJECT'
                });
            }
            for (const [key, value] of selectorEntries) {
                if (typeof value !== 'string') {
                    errors.push({
                        field: `selectors.${key}`,
                        message: 'Selector value must be a string',
                        code: 'INVALID_TYPE'
                    });
                }
                else {
                    const selectorValidation = this.validateSelector(value);
                    if (!selectorValidation.success) {
                        errors.push(...selectorValidation.errors.map(e => ({
                            ...e,
                            field: `selectors.${key}`
                        })));
                    }
                }
            }
        }
        // Validate output format
        if (request.outputFormat && !['playwright', 'puppeteer'].includes(request.outputFormat)) {
            errors.push({
                field: 'outputFormat',
                message: 'Output format must be "playwright" or "puppeteer"',
                code: 'INVALID_VALUE'
            });
        }
        return errors.length > 0 ? { success: false, errors } : { success: true, errors: [] };
    }
}
//# sourceMappingURL=ValidationSystem.js.map