import OpenAI from 'openai';
export class LLMPlanner {
    openai = null;
    constructor() {
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        }
    }
    async generateScrapingPlan(request) {
        // If no OpenAI key, fall back to suggested selectors
        if (!this.openai) {
            return {
                selectors: request.suggestedSelectors,
                strategy: 'fallback',
                confidence: 0.6,
                reasoning: 'Using DOM analysis fallback (no OpenAI key provided)'
            };
        }
        try {
            const prompt = this.buildPrompt(request);
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert web scraping assistant. Analyze HTML and provide optimal CSS selectors for data extraction.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 1000
            });
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }
            return this.parseResponse(content, request.suggestedSelectors);
        }
        catch (error) {
            console.error('LLM Planning error:', error);
            // Fallback to suggested selectors
            return {
                selectors: request.suggestedSelectors,
                strategy: 'fallback',
                confidence: 0.6,
                reasoning: `LLM failed, using DOM analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    buildPrompt(request) {
        return `
Analyze this HTML and provide optimal CSS selectors for extracting the following data:

URL: ${request.url}
Targets: ${request.targets.join(', ')}

HTML (truncated):
\`\`\`html
${request.html}
\`\`\`

Suggested selectors from DOM analysis:
${JSON.stringify(request.suggestedSelectors, null, 2)}

Please provide a JSON response with:
1. "selectors": object mapping each target to its best CSS selector
2. "strategy": brief description of the approach
3. "confidence": score 0-1 for how confident you are
4. "reasoning": explanation of selector choices

Focus on:
- Specificity without being too fragile
- Semantic meaning over styling classes
- Fallback options for dynamic content
- Common patterns for the target data types

Response format:
\`\`\`json
{
  "selectors": {
    "target1": "css-selector",
    "target2": "css-selector"
  },
  "strategy": "description",
  "confidence": 0.85,
  "reasoning": "explanation"
}
\`\`\`
`;
    }
    parseResponse(content, fallbackSelectors) {
        try {
            // Extract JSON from response
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[1]);
            return {
                selectors: parsed.selectors || fallbackSelectors,
                strategy: parsed.strategy || 'llm-generated',
                confidence: parsed.confidence || 0.7,
                reasoning: parsed.reasoning || 'LLM-generated selectors'
            };
        }
        catch (error) {
            return {
                selectors: fallbackSelectors,
                strategy: 'fallback',
                confidence: 0.6,
                reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
//# sourceMappingURL=LLMPlanner.js.map