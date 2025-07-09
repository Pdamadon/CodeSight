import OpenAI from 'openai';
import { Logger } from '../monitoring/Logger.js';
import { Monitor } from '../monitoring/Monitor.js';
import { ScrapingPatterns } from '../knowledge/ScrapingPatterns.js';

export interface AutonomousDecision {
  action: 'scrape' | 'click' | 'fill' | 'navigate' | 'wait' | 'analyze';
  reasoning: string;
  confidence: number;
  parameters: Record<string, any>;
  fallbackOptions?: AutonomousDecision[];
}

export interface AutonomousContext {
  url: string;
  goal: string;
  currentHtml: string;
  previousAttempts: string[];
  availableElements: Array<{
    tag: string;
    text: string;
    attributes: Record<string, string>;
    selector: string;
  }>;
  currentData: Record<string, any>;
  pageStructure?: {
    title: string;
    headings: string[];
    links: number;
    forms: number;
    images: number;
    contentType: 'news' | 'ecommerce' | 'social' | 'search' | 'wiki' | 'generic';
  };
  extractionTargets?: Array<{
    name: string;
    expected: string;
    currentValue?: any;
    confidence?: number;
  }>;
  failureAnalysis?: {
    failedSelectors: string[];
    reasons: string[];
    suggestions: string[];
  };
}

export class AutonomousPlanner {
  private openai: OpenAI;
  private logger: Logger;
  private monitor: Monitor;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for autonomous operation');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.logger = Logger.getInstance();
    this.monitor = Monitor.getInstance();
  }

  async makeAutonomousDecision(context: AutonomousContext): Promise<AutonomousDecision> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Making autonomous decision', { 
        url: context.url, 
        goal: context.goal,
        previousAttempts: context.previousAttempts.length
      });

      const prompt = this.buildDecisionPrompt(context);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const decision = this.parseDecisionResponse(response.choices[0]?.message?.content);
      
      this.logger.info('Autonomous decision made', {
        action: decision.action,
        confidence: decision.confidence,
        duration: Date.now() - startTime
      });

      this.monitor.recordLearningEvent('autonomous_decision', {
        action: decision.action,
        confidence: decision.confidence,
        goal: context.goal
      });

      return decision;

    } catch (error) {
      this.logger.error('Autonomous decision failed', error as Error, { 
        url: context.url, 
        goal: context.goal 
      });

      // Return fallback decision
      return {
        action: 'analyze',
        reasoning: 'Failed to make autonomous decision, falling back to analysis',
        confidence: 0.3,
        parameters: { fallback: true }
      };
    }
  }

  async planInteractionSequence(context: AutonomousContext): Promise<AutonomousDecision[]> {
    try {
      this.logger.info('Planning interaction sequence', { 
        url: context.url, 
        goal: context.goal 
      });

      const prompt = this.buildSequencePrompt(context);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSequenceSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const sequence = this.parseSequenceResponse(response.choices[0]?.message?.content);
      
      this.logger.info('Interaction sequence planned', {
        steps: sequence.length,
        goal: context.goal
      });

      return sequence;

    } catch (error) {
      this.logger.error('Sequence planning failed', error as Error, { 
        url: context.url, 
        goal: context.goal 
      });

      return [{
        action: 'analyze',
        reasoning: 'Failed to plan sequence, falling back to analysis',
        confidence: 0.3,
        parameters: { fallback: true }
      }];
    }
  }

  async generateImprovedSelectors(context: AutonomousContext, failedSelectors: string[]): Promise<{
    selectors: Record<string, string>;
    reasoning: string;
    confidence: number;
  }> {
    try {
      this.logger.info('Generating improved selectors', { 
        url: context.url,
        failedSelectors: failedSelectors.length
      });

      const prompt = this.buildSelectorPrompt(context, failedSelectors);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSelectorSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const result = this.parseSelectorResponse(response.choices[0]?.message?.content);
      
      this.logger.info('Improved selectors generated', {
        selectorsCount: Object.keys(result.selectors).length,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      this.logger.error('Selector generation failed', error as Error, { 
        url: context.url 
      });

      return {
        selectors: {},
        reasoning: 'Failed to generate improved selectors',
        confidence: 0.2
      };
    }
  }

  private getSystemPrompt(): string {
    return `You are an advanced autonomous web scraping agent with deep understanding of web page structures and semantic HTML. Your job is to make intelligent, context-aware decisions about how to interact with web pages to extract specific data.

You can perform these actions:
- scrape: Extract data using intelligent selector generation
- click: Click on buttons, links, or interactive elements
- fill: Fill out form fields
- navigate: Navigate to a different page
- wait: Wait for dynamic content to load
- analyze: Analyze page structure and content patterns

You must respond with a JSON object containing:
{
  "action": "scrape|click|fill|navigate|wait|analyze",
  "reasoning": "detailed explanation based on semantic analysis and content patterns",
  "confidence": 0.0-1.0,
  "parameters": {
    "selector": "CSS selector or multiple alternatives",
    "value": "value for fill actions",
    "url": "URL for navigate actions",
    "timeout": "timeout in ms for wait actions",
    "strategy": "extraction strategy: semantic|hierarchical|pattern|hybrid",
    "alternatives": ["alternative selector 1", "alternative selector 2"]
  }
}

Key principles:
1. **Semantic Understanding**: Prioritize semantic HTML elements over styling-based selectors
2. **Content Type Awareness**: Adapt strategy based on page type (news, ecommerce, social, etc.)
3. **Failure Learning**: Use previous failures to inform better approaches
4. **Validation Focus**: Ensure extracted data actually matches the intended targets
5. **Robustness**: Generate selectors that work across similar page structures

Always provide your confidence level and reasoning based on the semantic analysis provided.`;
  }

  private getSequenceSystemPrompt(): string {
    return `You are planning a sequence of web interactions to accomplish a specific goal. 

Plan a series of actions that will efficiently accomplish the goal. Each action should be:
1. Specific and actionable
2. Based on the actual page content
3. Ordered logically
4. Include fallback options for critical steps

Respond with a JSON object:
{
  "sequence": [
    {
      "action": "action_type",
      "reasoning": "why this step is needed",
      "confidence": 0.0-1.0,
      "parameters": { "selector": "...", "value": "...", etc }
    }
  ]
}

Keep sequences focused and efficient - typically 2-5 steps.`;
  }

  private getSelectorSystemPrompt(): string {
    return `You are an expert at generating intelligent, robust CSS selectors for web scraping with deep understanding of HTML semantics and content patterns.

Given detailed HTML analysis and failed selectors, generate better alternatives using:

**Semantic Approach**: Use HTML5 semantic elements (article, section, header, main, etc.)
**Content Pattern Recognition**: Identify patterns specific to the website type
**Hierarchy Analysis**: Leverage parent-child relationships for robust selection
**Attribute Intelligence**: Use meaningful attributes over generic classes
**Fallback Strategies**: Provide multiple approaches for each target

Respond with a JSON object:
{
  "selectors": {
    "target_name": "primary_css_selector"
  },
  "alternatives": {
    "target_name": ["alternative_1", "alternative_2", "alternative_3"]
  },
  "strategies": {
    "target_name": "semantic|hierarchical|pattern|attribute|hybrid"
  },
  "reasoning": "detailed explanation of selector logic and why it should work",
  "confidence": 0.0-1.0
}

Prioritize selectors that:
1. Use semantic meaning and content hierarchy
2. Are resilient to styling changes
3. Leverage the specific content type patterns
4. Include multiple fallback options
5. Match the actual target content, not just similar-looking elements`;
  }

  private buildDecisionPrompt(context: AutonomousContext): string {
    const pageStructure = context.pageStructure || this.inferPageStructure(context.currentHtml);
    const extractionTargets = context.extractionTargets || this.buildExtractionTargets(context.goal, context.currentData);
    const failureAnalysis = context.failureAnalysis || this.analyzeFailures(context.previousAttempts);

    const elementsDescription = context.availableElements
      .slice(0, 15)
      .map(el => {
        const relevance = this.calculateElementRelevance(el, context.goal, pageStructure.contentType);
        return `${el.tag}: "${el.text.substring(0, 80)}" (${el.selector}) [relevance: ${relevance.toFixed(2)}]`;
      })
      .join('\n');

    const semanticHtml = this.extractSemanticStructure(context.currentHtml);

    return `
GOAL: ${context.goal}
CURRENT URL: ${context.url}
PREVIOUS ATTEMPTS: ${context.previousAttempts.join(', ') || 'None'}

PAGE ANALYSIS:
- Content Type: ${pageStructure.contentType}
- Title: ${pageStructure.title}
- Structure: ${pageStructure.headings.length} headings, ${pageStructure.links} links, ${pageStructure.forms} forms
- Main Content Areas: ${semanticHtml.contentAreas.join(', ')}

EXTRACTION TARGETS:
${extractionTargets.map(target => `- ${target.name}: ${target.expected} ${target.currentValue ? '(FOUND)' : '(MISSING)'} confidence: ${(target.confidence || 0).toFixed(2)}`).join('\n')}

FAILURE ANALYSIS:
${failureAnalysis.failedSelectors.length > 0 ? `Failed selectors: ${failureAnalysis.failedSelectors.join(', ')}\nReasons: ${failureAnalysis.reasons.join(', ')}\nSuggestions: ${failureAnalysis.suggestions.join(', ')}` : 'No previous failures'}

CURRENT DATA EXTRACTED:
${JSON.stringify(context.currentData, null, 2)}

RELEVANT INTERACTIVE ELEMENTS:
${elementsDescription}

SEMANTIC HTML STRUCTURE:
${semanticHtml.structure}

Based on this analysis, what action should I take next? Consider:
1. What specific data targets are still missing?
2. What semantic elements might contain the target information?
3. What interactions could reveal hidden content?
4. What extraction strategies haven't been tried?
5. How confident are you in different approaches?

Make an intelligent decision that maximizes the probability of extracting the target data.`;
  }

  private buildSequencePrompt(context: AutonomousContext): string {
    return `
GOAL: ${context.goal}
CURRENT URL: ${context.url}
CURRENT DATA: ${JSON.stringify(context.currentData, null, 2)}

AVAILABLE ELEMENTS:
${context.availableElements.map(el => `${el.tag}: "${el.text}" (${el.selector})`).join('\n')}

HTML CONTEXT:
${context.currentHtml.substring(0, 3000)}

Plan a sequence of interactions to accomplish this goal. Consider:
1. What steps are needed in what order?
2. What elements need to be clicked or filled?
3. What data needs to be extracted and when?
4. What might go wrong and how to handle it?

Create an efficient sequence that maximizes success probability.`;
  }

  private buildSelectorPrompt(context: AutonomousContext, failedSelectors: string[]): string {
    const pageStructure = context.pageStructure || this.inferPageStructure(context.currentHtml);
    const semanticHtml = this.extractSemanticStructure(context.currentHtml);
    const extractionTargets = context.extractionTargets || this.buildExtractionTargets(context.goal, context.currentData);
    
    // Get proven selector patterns from working scrapers
    const domain = new URL(context.url).hostname;
    const smartSelectors = ScrapingPatterns.generateSmartSelectors(context.goal, domain, pageStructure);
    const fewShotExamples = ScrapingPatterns.getFewShotExamples(pageStructure.contentType);
    
    return `
GOAL: Extract data for: ${context.goal}
PAGE TYPE: ${pageStructure.contentType}
DOMAIN: ${domain}
FAILED SELECTORS: ${failedSelectors.join(', ')}

EXTRACTION TARGETS:
${extractionTargets.map(target => `- ${target.name}: Looking for ${target.expected}`).join('\n')}

PROVEN SELECTOR PATTERNS (from working scrapers):
${smartSelectors.slice(0, 8).map(sel => `- ${sel}`).join('\n')}

SEMANTIC STRUCTURE:
${semanticHtml.structure}

CONTENT AREAS:
${semanticHtml.contentAreas.map(area => `- ${area}`).join('\n')}

HTML ANALYSIS:
${this.generateHtmlAnalysis(context.currentHtml, context.goal)}

SUCCESSFUL EXTRACTION EXAMPLES:
${fewShotExamples}

The failed selectors couldn't find the target elements. Generate better selectors using:

1. **Proven Patterns First**: Use the proven selector patterns above that have worked on similar sites
2. **Multi-Selector Strategy**: Provide 3-5 alternatives in order of confidence
3. **Content Validation**: Ensure selectors target elements with meaningful content
4. **Fallback Chain**: Include generic fallbacks that work across different site structures

Generate selectors that are:
- Based on proven patterns from successful scrapers
- Semantically meaningful for ${pageStructure.contentType} content
- Robust to layout changes
- Validated against content quality

For each target, provide the best selector plus 2-3 alternatives with reasoning.`;
  }

  private parseDecisionResponse(content: string | null): AutonomousDecision {
    if (!content) {
      throw new Error('No response content received');
    }

    try {
      const parsed = JSON.parse(content);
      return {
        action: parsed.action || 'analyze',
        reasoning: parsed.reasoning || 'No reasoning provided',
        confidence: parsed.confidence || 0.5,
        parameters: parsed.parameters || {}
      };
    } catch (error) {
      throw new Error(`Failed to parse decision response: ${error}`);
    }
  }

  private parseSequenceResponse(content: string | null): AutonomousDecision[] {
    if (!content) {
      throw new Error('No response content received');
    }

    try {
      const parsed = JSON.parse(content);
      return parsed.sequence || [];
    } catch (error) {
      throw new Error(`Failed to parse sequence response: ${error}`);
    }
  }

  private parseSelectorResponse(content: string | null): {
    selectors: Record<string, string>;
    reasoning: string;
    confidence: number;
  } {
    if (!content) {
      throw new Error('No response content received');
    }

    try {
      const parsed = JSON.parse(content);
      return {
        selectors: parsed.selectors || {},
        reasoning: parsed.reasoning || 'No reasoning provided',
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      throw new Error(`Failed to parse selector response: ${error}`);
    }
  }

  private inferPageStructure(html: string): {
    title: string;
    headings: string[];
    links: number;
    forms: number;
    images: number;
    contentType: 'news' | 'ecommerce' | 'social' | 'search' | 'wiki' | 'generic';
  } {
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 'Unknown';
    const headings = Array.from(html.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi)).map(match => match[1]);
    const links = (html.match(/<a[^>]*href/gi) || []).length;
    const forms = (html.match(/<form[^>]*>/gi) || []).length;
    const images = (html.match(/<img[^>]*>/gi) || []).length;
    
    // Infer content type from URL and content patterns
    let contentType: 'news' | 'ecommerce' | 'social' | 'search' | 'wiki' | 'generic' = 'generic';
    
    if (html.includes('news') || html.includes('article') || html.includes('headline')) {
      contentType = 'news';
    } else if (html.includes('price') || html.includes('cart') || html.includes('buy') || html.includes('product')) {
      contentType = 'ecommerce';
    } else if (html.includes('twitter') || html.includes('facebook') || html.includes('instagram') || html.includes('social')) {
      contentType = 'social';
    } else if (html.includes('search') || html.includes('query') || html.includes('results')) {
      contentType = 'search';
    } else if (html.includes('wikipedia') || html.includes('wiki') || html.includes('encyclopedia')) {
      contentType = 'wiki';
    }
    
    return { title, headings, links, forms, images, contentType };
  }

  private buildExtractionTargets(goal: string, currentData: Record<string, any>): Array<{
    name: string;
    expected: string;
    currentValue?: any;
    confidence?: number;
  }> {
    const targets = [];
    const goalLower = goal.toLowerCase();
    
    // Parse common extraction targets from goal
    if (goalLower.includes('title')) {
      targets.push({
        name: 'title',
        expected: 'Main page or article title',
        currentValue: currentData.title,
        confidence: currentData.title ? 0.9 : 0.0
      });
    }
    
    if (goalLower.includes('headline')) {
      targets.push({
        name: 'headline',
        expected: 'News article headline or main heading',
        currentValue: currentData.headline,
        confidence: currentData.headline ? 0.9 : 0.0
      });
    }
    
    if (goalLower.includes('price')) {
      targets.push({
        name: 'price',
        expected: 'Product price or cost information',
        currentValue: currentData.price,
        confidence: currentData.price ? 0.9 : 0.0
      });
    }
    
    if (goalLower.includes('summary') || goalLower.includes('description')) {
      targets.push({
        name: 'summary',
        expected: 'Article summary or product description',
        currentValue: currentData.summary,
        confidence: currentData.summary ? 0.9 : 0.0
      });
    }
    
    // Add generic targets if none found
    if (targets.length === 0) {
      targets.push({
        name: 'content',
        expected: 'Main content related to: ' + goal,
        currentValue: currentData.content,
        confidence: currentData.content ? 0.7 : 0.0
      });
    }
    
    return targets;
  }

  private analyzeFailures(previousAttempts: string[]): {
    failedSelectors: string[];
    reasons: string[];
    suggestions: string[];
  } {
    const failedSelectors: string[] = [];
    const reasons: string[] = [];
    const suggestions: string[] = [];
    
    for (const attempt of previousAttempts) {
      if (attempt.includes('scrape:false')) {
        failedSelectors.push('previous_selector');
        reasons.push('Element not found or no content');
        suggestions.push('Try more specific selectors or check for dynamic content');
      }
      if (attempt.includes('click:false')) {
        reasons.push('Click target not found or not clickable');
        suggestions.push('Look for alternative clickable elements or wait for page load');
      }
    }
    
    return { failedSelectors, reasons, suggestions };
  }

  private calculateElementRelevance(element: any, goal: string, contentType: string): number {
    let relevance = 0.5; // Base relevance
    
    const goalLower = goal.toLowerCase();
    const textLower = element.text.toLowerCase();
    const tagLower = element.tag.toLowerCase();
    
    // Tag-based relevance
    if (goalLower.includes('title') && ['h1', 'h2', 'title'].includes(tagLower)) {
      relevance += 0.3;
    }
    if (goalLower.includes('link') && tagLower === 'a') {
      relevance += 0.3;
    }
    if (goalLower.includes('button') && ['button', 'input'].includes(tagLower)) {
      relevance += 0.3;
    }
    
    // Content-based relevance
    if (textLower.includes(goalLower)) {
      relevance += 0.2;
    }
    
    // Content type specific relevance
    if (contentType === 'news' && ['article', 'header', 'time'].includes(tagLower)) {
      relevance += 0.2;
    }
    if (contentType === 'ecommerce' && textLower.includes('price')) {
      relevance += 0.2;
    }
    
    return Math.min(relevance, 1.0);
  }

  private extractSemanticStructure(html: string): {
    structure: string;
    contentAreas: string[];
  } {
    const semanticTags = ['main', 'article', 'section', 'header', 'nav', 'aside', 'footer'];
    const contentAreas: string[] = [];
    
    let structure = 'HTML Structure:\n';
    
    for (const tag of semanticTags) {
      const matches = html.match(new RegExp(`<${tag}[^>]*>`, 'gi'));
      if (matches) {
        structure += `- ${matches.length} ${tag} element(s)\n`;
        contentAreas.push(tag);
      }
    }
    
    // Add heading structure
    const headings = html.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi) || [];
    if (headings.length > 0) {
      structure += `- ${headings.length} heading(s): ${headings.slice(0, 3).map(h => h.replace(/<[^>]*>/g, '')).join(', ')}\n`;
    }
    
    return { structure, contentAreas };
  }

  private generateHtmlAnalysis(html: string, goal: string): string {
    const analysis = [];
    
    // Look for data attributes that might be useful
    const dataAttributes = html.match(/data-[a-z-]+="[^"]*"/gi) || [];
    if (dataAttributes.length > 0) {
      analysis.push(`Data attributes found: ${dataAttributes.slice(0, 3).join(', ')}`);
    }
    
    // Look for common class patterns
    const classes = html.match(/class="[^"]*"/gi) || [];
    const relevantClasses = classes.filter(cls => {
      const lowerCls = cls.toLowerCase();
      return lowerCls.includes('title') || lowerCls.includes('content') || lowerCls.includes('text') || lowerCls.includes('article');
    });
    if (relevantClasses.length > 0) {
      analysis.push(`Relevant classes: ${relevantClasses.slice(0, 3).join(', ')}`);
    }
    
    // Look for microdata or schema.org markup
    if (html.includes('itemtype') || html.includes('schema.org')) {
      analysis.push('Schema.org markup detected - use itemtype/itemprop attributes');
    }
    
    return analysis.join('\n');
  }

  async validateExtractionResult(context: AutonomousContext, extractedData: Record<string, any>): Promise<{
    isValid: boolean;
    confidence: number;
    suggestions: string[];
    missingTargets: string[];
  }> {
    try {
      const extractionTargets = this.buildExtractionTargets(context.goal, {});
      const missingTargets: string[] = [];
      const suggestions: string[] = [];
      
      let validTargets = 0;
      let totalTargets = extractionTargets.length;
      let totalConfidence = 0;
      
      for (const target of extractionTargets) {
        const data = extractedData[target.name];
        if (!data || !data.text || data.text.trim().length === 0) {
          missingTargets.push(target.name);
          suggestions.push(`Missing ${target.name}: ${target.expected}`);
        } else {
          // Use proven validation patterns from working scrapers
          const validation = ScrapingPatterns.validateAndClean(data.text, target.name);
          
          if (validation.isValid) {
            validTargets++;
            totalConfidence += validation.confidence;
            
            // Update the data with cleaned content
            data.text = validation.cleaned;
            data.confidence = validation.confidence;
            
            if (validation.confidence < 0.5) {
              suggestions.push(`${target.name} has low confidence (${(validation.confidence * 100).toFixed(1)}%)`);
            }
          } else {
            suggestions.push(`${target.name} content failed validation: "${data.text.substring(0, 50)}..."`);
          }
        }
      }
      
      const avgConfidence = totalTargets > 0 ? totalConfidence / totalTargets : 0;
      const isValid = avgConfidence > 0.5 && missingTargets.length === 0;
      
      return {
        isValid,
        confidence: avgConfidence,
        suggestions,
        missingTargets
      };
    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        suggestions: ['Validation failed: ' + (error as Error).message],
        missingTargets: []
      };
    }
  }
}