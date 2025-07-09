#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ScrapingAgent } from './agents/ScrapingAgent.js';
import { DOMAnalyzer } from './analyzers/DOMAnalyzer.js';
import { ScriptGenerator } from './generators/ScriptGenerator.js';
import { ValidationSystem } from './validation/ValidationSystem.js';
import { RetryManager } from './utils/RetryManager.js';
import { Monitor } from './monitoring/Monitor.js';
import { Logger } from './monitoring/Logger.js';
import * as dotenv from 'dotenv';
dotenv.config();
// Tool parameter schemas
const ScrapeWebsiteSchema = z.object({
    url: z.string().url(),
    targets: z.array(z.string()).describe('Data to extract (e.g., "title", "price", "description")'),
    waitForSelector: z.string().optional().describe('CSS selector to wait for before scraping'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
    headless: z.boolean().optional().default(true).describe('Run browser in headless mode'),
    interactions: z.array(z.string()).optional().describe('Interaction goals (e.g., "click load more button", "fill search form")'),
    autonomous: z.boolean().optional().default(false).describe('Enable fully autonomous mode with OpenAI decision making'),
});
const AnalyzeDOMSchema = z.object({
    html: z.string().describe('HTML content to analyze'),
    targets: z.array(z.string()).describe('Data to find selectors for'),
});
const GenerateScriptSchema = z.object({
    url: z.string().url(),
    selectors: z.record(z.string()).describe('Object mapping target names to CSS selectors'),
    outputFormat: z.enum(['playwright', 'puppeteer']).optional().default('playwright'),
});
const GetLearningMetricsSchema = z.object({}).optional();
const GetHealthCheckSchema = z.object({}).optional();
const GetPerformanceMetricsSchema = z.object({}).optional();
class CodeSightMCPServer {
    server;
    scrapingAgent;
    domAnalyzer;
    scriptGenerator;
    monitor;
    logger;
    constructor() {
        this.server = new Server({
            name: 'codesight-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.scrapingAgent = new ScrapingAgent();
        this.domAnalyzer = new DOMAnalyzer();
        this.scriptGenerator = new ScriptGenerator();
        this.monitor = Monitor.getInstance();
        this.logger = Logger.getInstance();
        this.setupToolHandlers();
        this.logger.info('CodeSight MCP Server initialized');
    }
    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'scrape_website',
                        description: 'Scrape data from a website using autonomous AI agent with interaction support',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                url: { type: 'string', format: 'uri' },
                                targets: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Data to extract (e.g., "title", "price", "description")'
                                },
                                waitForSelector: { type: 'string', description: 'CSS selector to wait for' },
                                timeout: { type: 'number', default: 30000 },
                                headless: { type: 'boolean', default: true },
                                interactions: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Interaction goals like "click load more button", "fill search form"'
                                },
                                autonomous: {
                                    type: 'boolean',
                                    default: false,
                                    description: 'Enable fully autonomous mode with OpenAI decision making'
                                }
                            },
                            required: ['url', 'targets'],
                        },
                    },
                    {
                        name: 'analyze_dom',
                        description: 'Analyze HTML DOM structure and suggest selectors for target data',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                html: { type: 'string', description: 'HTML content to analyze' },
                                targets: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Data to find selectors for'
                                }
                            },
                            required: ['html', 'targets'],
                        },
                    },
                    {
                        name: 'generate_script',
                        description: 'Generate Playwright/Puppeteer script for scraping',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                url: { type: 'string', format: 'uri' },
                                selectors: {
                                    type: 'object',
                                    description: 'Object mapping target names to CSS selectors'
                                },
                                outputFormat: { type: 'string', enum: ['playwright', 'puppeteer'], default: 'playwright' }
                            },
                            required: ['url', 'selectors'],
                        },
                    },
                    {
                        name: 'get_learning_metrics',
                        description: 'Get learning system metrics and performance statistics',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: 'health_check',
                        description: 'Check system health and component status',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: 'get_performance_metrics',
                        description: 'Get comprehensive performance metrics and monitoring data',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                ],
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'scrape_website': {
                        // Validate input
                        const validation = ValidationSystem.validateScrapeRequest(args);
                        if (!validation.success) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            errors: validation.errors,
                                            message: 'Validation failed'
                                        }, null, 2),
                                    },
                                ],
                                isError: true,
                            };
                        }
                        const params = ScrapeWebsiteSchema.parse(args);
                        // Execute with retry and circuit breaker
                        const result = await RetryManager.executeWithCircuitBreaker(() => this.scrapingAgent.scrapeWebsite(params), `scrape_${new URL(params.url).hostname}`, { maxRetries: 2 });
                        if (result.success) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            ...result.data,
                                            meta: {
                                                attempts: result.attempts,
                                                totalTime: result.totalTime
                                            }
                                        }, null, 2),
                                    },
                                ],
                            };
                        }
                        else {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            error: result.error?.toJSON(),
                                            meta: {
                                                attempts: result.attempts,
                                                totalTime: result.totalTime
                                            }
                                        }, null, 2),
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case 'analyze_dom': {
                        // Validate input
                        const validation = ValidationSystem.validateAnalyzeDomRequest(args);
                        if (!validation.success) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            errors: validation.errors,
                                            message: 'Validation failed'
                                        }, null, 2),
                                    },
                                ],
                                isError: true,
                            };
                        }
                        const params = AnalyzeDOMSchema.parse(args);
                        const result = await this.domAnalyzer.analyzeDOM(params);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    }
                    case 'generate_script': {
                        // Validate input
                        const validation = ValidationSystem.validateGenerateScriptRequest(args);
                        if (!validation.success) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            errors: validation.errors,
                                            message: 'Validation failed'
                                        }, null, 2),
                                    },
                                ],
                                isError: true,
                            };
                        }
                        const params = GenerateScriptSchema.parse(args);
                        const result = await this.scriptGenerator.generateScript(params);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: result,
                                },
                            ],
                        };
                    }
                    case 'get_learning_metrics': {
                        const metrics = await this.scrapingAgent.getLearningMetrics();
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(metrics, null, 2),
                                },
                            ],
                        };
                    }
                    case 'health_check': {
                        const health = await this.monitor.healthCheck();
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(health, null, 2),
                                },
                            ],
                        };
                    }
                    case 'get_performance_metrics': {
                        const metrics = await this.monitor.getMetrics();
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(metrics, null, 2),
                                },
                            ],
                        };
                    }
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${errorMessage}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('CodeSight MCP Server started');
    }
}
// Start the server
const server = new CodeSightMCPServer();
server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map