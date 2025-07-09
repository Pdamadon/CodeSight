import * as cheerio from 'cheerio';

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

export class DOMAnalyzer {
  async analyzeDOM(request: DOMAnalysisRequest): Promise<DOMAnalysisResult> {
    const $ = cheerio.load(request.html);
    
    const selectors: Record<string, string> = {};
    const confidence: Record<string, number> = {};
    const alternatives: Record<string, string[]> = {};

    // Analyze structure
    const structure = {
      title: $('title').text() || '',
      forms: $('form').length,
      links: $('a').length,
      images: $('img').length,
      depth: this.calculateDepth($)
    };

    // Find selectors for each target
    for (const target of request.targets) {
      const result = this.findSelectorsForTarget($, target);
      selectors[target] = result.primary;
      confidence[target] = result.confidence;
      alternatives[target] = result.alternatives;
    }

    return {
      selectors,
      confidence,
      alternatives,
      structure
    };
  }

  private findSelectorsForTarget($: cheerio.CheerioAPI, target: string): {
    primary: string;
    confidence: number;
    alternatives: string[];
  } {
    const targetLower = target.toLowerCase();
    const alternatives: string[] = [];
    
    // Define patterns for common data types
    const patterns = {
      title: ['h1', 'h2', '.title', '.name', '[data-testid*="title"]', '.product-name'],
      price: ['.price', '.cost', '.amount', '[data-testid*="price"]', '.currency'],
      description: ['.description', '.desc', '.summary', '.content', 'p'],
      image: ['img', '.image', '.photo', '.picture'],
      link: ['a', '.link', '.url'],
      button: ['button', '.button', '.btn', '[role="button"]'],
      form: ['form', '.form', '.search-form'],
      rating: ['.rating', '.stars', '.score', '[data-testid*="rating"]'],
      review: ['.review', '.comment', '.feedback'],
      address: ['.address', '.location', '.addr'],
      phone: ['.phone', '.tel', '.telephone', '[href^="tel:"]'],
      email: ['.email', '.mail', '[href^="mailto:"]']
    };

    // Find pattern matches
    let bestMatch = '';
    let bestScore = 0;

    for (const [pattern, selectors] of Object.entries(patterns)) {
      if (targetLower.includes(pattern)) {
        for (const selector of selectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            const score = this.calculateSelectorScore($, selector, target);
            alternatives.push(selector);
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = selector;
            }
          }
        }
      }
    }

    // Fallback: search by text content
    if (!bestMatch) {
      const textSearch = this.searchByTextContent($, target);
      if (textSearch.selector) {
        bestMatch = textSearch.selector;
        bestScore = textSearch.score;
      }
    }

    // Final fallback
    if (!bestMatch) {
      bestMatch = 'body';
      bestScore = 0.1;
    }

    return {
      primary: bestMatch,
      confidence: bestScore,
      alternatives: alternatives.slice(0, 5) // Limit alternatives
    };
  }

  private calculateSelectorScore($: cheerio.CheerioAPI, selector: string, target: string): number {
    const elements = $(selector);
    if (elements.length === 0) return 0;

    let score = 0.5; // Base score

    // Prefer unique elements
    if (elements.length === 1) score += 0.3;
    else if (elements.length <= 3) score += 0.1;
    else score -= 0.1;

    // Check if element text is relevant
    const text = elements.first().text().toLowerCase();
    if (text.includes(target.toLowerCase())) {
      score += 0.4;
    }

    // Prefer semantic elements
    if (selector.match(/^h[1-6]$/)) score += 0.2;
    if (selector.includes('[data-testid')) score += 0.3;
    if (selector.includes('.price') || selector.includes('.title')) score += 0.2;

    // Penalize overly generic selectors
    if (selector === 'div' || selector === 'span' || selector === 'p') score -= 0.2;

    return Math.min(score, 1.0);
  }

  private searchByTextContent($: cheerio.CheerioAPI, target: string): { selector: string; score: number } {
    const targetLower = target.toLowerCase();
    let bestSelector = '';
    let bestScore = 0;

    $('*').each((i, element) => {
      const $el = $(element);
      const text = $el.text().toLowerCase();
      
      if (text.includes(targetLower)) {
        const tag = $el.prop('tagName')?.toLowerCase() || 'div';
        const classes = $el.attr('class') || '';
        const id = $el.attr('id') || '';
        
        // Build selector
        let selector = tag;
        if (id) selector += `#${id}`;
        if (classes) selector += `.${classes.split(' ')[0]}`;
        
        const score = this.calculateSelectorScore($, selector, target);
        if (score > bestScore) {
          bestScore = score;
          bestSelector = selector;
        }
      }
    });

    return { selector: bestSelector, score: bestScore };
  }

  private calculateDepth($: cheerio.CheerioAPI): number {
    let maxDepth = 0;
    
    $('*').each((i, element) => {
      let depth = 0;
      let current = element;
      
      while (current.parent) {
        depth++;
        current = current.parent;
      }
      
      maxDepth = Math.max(maxDepth, depth);
    });
    
    return maxDepth;
  }
}