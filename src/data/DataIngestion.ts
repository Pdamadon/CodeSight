// DataIngestion.ts - System for loading data from external scrapers

import { WorldModel, CodePattern } from '../knowledge/WorldModel.js';
import { Logger } from '../monitoring/Logger.js';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Transform } from 'stream';

export interface ScraperData {
  url: string;
  domain: string;
  timestamp: number;
  goal: string;
  success: boolean;
  extractedData: Record<string, any>;
  confidence: number;
  sessionId?: string;
  metadata?: {
    scraper: string;
    version?: string;
    technique?: string;
    processingTime?: number;
    language?: string;
    fileSize?: number;
  };
  codePatterns?: CodePattern[];
}

export interface DataSource {
  name: string;
  type: 'json' | 'csv' | 'jsonl' | 'xml' | 'scrapy' | 'playwright' | 'puppeteer' | 'selenium' | 'javascript' | 'typescript';
  path: string;
  format: DataFormat;
  enabled: boolean;
  lastProcessed?: number;
  totalRecords?: number;
  successRate?: number;
}

export interface DataFormat {
  url: string | string[];
  domain?: string | string[];
  timestamp: string | string[];
  data: string | string[];
  metadata?: Record<string, string | string[]>;
  transforms?: DataTransform[];
}

export interface DataTransform {
  type: 'rename' | 'extract' | 'combine' | 'clean' | 'validate';
  field: string;
  operation: string;
  params?: Record<string, any>;
}

export interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  errors: string[];
  warnings: string[];
  processingTime: number;
  patterns: ScrapingPattern[];
}

export interface ScrapingPattern {
  domain: string;
  selector: string;
  dataType: string;
  frequency: number;
  confidence: number;
  examples: string[];
}

export interface SelectorRecommendation {
  type: 'domain-specific' | 'data-type-generic' | 'framework-specific';
  domain: string;
  dataType: string;
  selectors: {
    selector: string;
    confidence: number;
    frequency: number;
    dataType: string;
    examples: string[];
  }[];
  confidence: number;
  priority: number;
}

export class DataIngestion {
  private worldModel: WorldModel;
  private logger: Logger;
  private dataSources: Map<string, DataSource>;
  private transformers: Map<string, DataTransformer>;

  constructor(worldModel: WorldModel) {
    this.worldModel = worldModel;
    this.logger = Logger.getInstance();
    this.dataSources = new Map();
    this.transformers = new Map();
    this.initializeTransformers();
  }

  private initializeTransformers() {
    // Register built-in transformers
    this.transformers.set('scrapy', new ScrapyTransformer());
    this.transformers.set('playwright', new PlaywrightTransformer());
    this.transformers.set('puppeteer', new PuppeteerTransformer());
    this.transformers.set('selenium', new SeleniumTransformer());
    this.transformers.set('beautifulsoup', new BeautifulSoupTransformer());
    this.transformers.set('javascript', new JavaScriptTransformer());
    this.transformers.set('typescript', new TypeScriptTransformer());
    this.transformers.set('generic', new GenericTransformer());
  }

  // Register a new data source
  async registerDataSource(source: DataSource): Promise<void> {
    try {
      // Validate source configuration
      await this.validateDataSource(source);
      
      this.dataSources.set(source.name, source);
      this.logger.info('Data source registered', { 
        name: source.name, 
        type: source.type,
        path: source.path 
      });
    } catch (error) {
      this.logger.error('Failed to register data source', error as Error, { source: source.name });
      throw error;
    }
  }

  // Import data from a specific source
  async importFromSource(sourceName: string, options: {
    limit?: number;
    offset?: number;
    filter?: (record: any) => boolean;
    transform?: boolean;
  } = {}): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      success: false,
      recordsProcessed: 0,
      recordsImported: 0,
      errors: [],
      warnings: [],
      processingTime: 0,
      patterns: []
    };

    try {
      const source = this.dataSources.get(sourceName);
      if (!source) {
        throw new Error(`Data source not found: ${sourceName}`);
      }

      if (!source.enabled) {
        throw new Error(`Data source is disabled: ${sourceName}`);
      }

      this.logger.info('Starting data import', { 
        source: sourceName, 
        type: source.type,
        options 
      });

      // Get appropriate transformer
      const transformer = this.getTransformer(source.type);
      
      // Load and transform data
      const records = await this.loadData(source, options);
      const patterns = new Map<string, ScrapingPattern>();

      for (const record of records) {
        result.recordsProcessed++;

        try {
          // Apply filter if provided
          if (options.filter && !options.filter(record)) {
            continue;
          }

          // Transform record to standard format
          const scrapedData = await transformer.transform(record, source.format);
          
          // Validate transformed data
          const validation = this.validateScrapedData(scrapedData);
          if (!validation.valid) {
            result.warnings.push(`Invalid data at record ${result.recordsProcessed}: ${validation.errors.join(', ')}`);
            continue;
          }

          // Ingest into WorldModel
          await this.worldModel.ingestScrapedData(scrapedData);
          result.recordsImported++;

          // Extract patterns
          const recordPatterns = this.extractPatterns(scrapedData);
          recordPatterns.forEach(pattern => {
            const key = `${pattern.domain}_${pattern.selector}`;
            if (patterns.has(key)) {
              const existing = patterns.get(key)!;
              existing.frequency++;
              existing.examples.push(...pattern.examples);
            } else {
              patterns.set(key, pattern);
            }
          });

          // Progress logging
          if (result.recordsProcessed % 100 === 0) {
            this.logger.info('Import progress', {
              source: sourceName,
              processed: result.recordsProcessed,
              imported: result.recordsImported
            });
          }

        } catch (error) {
          result.errors.push(`Error processing record ${result.recordsProcessed}: ${error}`);
          this.logger.warn('Failed to process record', error as Error);
        }
      }

      // Finalize patterns
      result.patterns = Array.from(patterns.values());
      
      // Update source metadata
      source.lastProcessed = Date.now();
      source.totalRecords = result.recordsProcessed;
      source.successRate = result.recordsImported / result.recordsProcessed;

      result.success = true;
      result.processingTime = Date.now() - startTime;

      this.logger.info('Data import completed', {
        source: sourceName,
        recordsProcessed: result.recordsProcessed,
        recordsImported: result.recordsImported,
        errors: result.errors.length,
        warnings: result.warnings.length,
        processingTime: result.processingTime,
        patterns: result.patterns.length
      });

    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
      this.logger.error('Data import failed', error as Error);
    }

    return result;
  }

  // Import from multiple sources
  async importFromMultipleSources(
    sourceNames: string[],
    options: {
      parallel?: boolean;
      continueOnError?: boolean;
      limit?: number;
    } = {}
  ): Promise<Map<string, ImportResult>> {
    const results = new Map<string, ImportResult>();

    if (options.parallel) {
      // Parallel import
      const promises = sourceNames.map(async (sourceName) => {
        try {
          const result = await this.importFromSource(sourceName, { limit: options.limit });
          return { sourceName, result };
        } catch (error) {
          if (!options.continueOnError) throw error;
          return { 
            sourceName, 
            result: {
              success: false,
              recordsProcessed: 0,
              recordsImported: 0,
              errors: [error as string],
              warnings: [],
              processingTime: 0,
              patterns: []
            }
          };
        }
      });

      const completed = await Promise.allSettled(promises);
      completed.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.set(result.value.sourceName, result.value.result);
        } else {
          results.set(sourceNames[index], {
            success: false,
            recordsProcessed: 0,
            recordsImported: 0,
            errors: [result.reason],
            warnings: [],
            processingTime: 0,
            patterns: []
          });
        }
      });
    } else {
      // Sequential import
      for (const sourceName of sourceNames) {
        try {
          const result = await this.importFromSource(sourceName, { limit: options.limit });
          results.set(sourceName, result);
        } catch (error) {
          results.set(sourceName, {
            success: false,
            recordsProcessed: 0,
            recordsImported: 0,
            errors: [error as string],
            warnings: [],
            processingTime: 0,
            patterns: []
          });
          
          if (!options.continueOnError) break;
        }
      }
    }

    return results;
  }

  // Auto-discover data sources in a directory
  async discoverDataSources(directory: string): Promise<DataSource[]> {
    const sources: DataSource[] = [];
    
    try {
      const files = await fs.promises.readdir(directory, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(directory, file.name);
          const source = await this.analyzeFile(filePath);
          if (source) {
            sources.push(source);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to discover data sources', error as Error, { directory });
    }

    return sources;
  }

  // Analyze a file to determine its format and structure
  private async analyzeFile(filePath: string): Promise<DataSource | null> {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath, ext);
    
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.size === 0) return null;

      let type: DataSource['type'];
      let format: DataFormat;

      switch (ext) {
        case '.json':
          type = 'json';
          format = await this.analyzeJsonFile(filePath);
          break;
        case '.jsonl':
          type = 'jsonl';
          format = await this.analyzeJsonlFile(filePath);
          break;
        case '.csv':
          type = 'csv';
          format = await this.analyzeCsvFile(filePath);
          break;
        case '.js':
          type = 'javascript';
          format = await this.analyzeJavaScriptFile(filePath);
          break;
        case '.ts':
          type = 'typescript';
          format = await this.analyzeTypeScriptFile(filePath);
          break;
        default:
          return null;
      }

      return {
        name: basename,
        type,
        path: filePath,
        format,
        enabled: true
      };
    } catch (error) {
      this.logger.warn('Failed to analyze file', { filePath, error: (error as Error).message });
      return null;
    }
  }

  // Create learning pipeline from imported data
  async createLearningPipeline(): Promise<void> {
    this.logger.info('Creating learning pipeline from imported data');
    
    try {
      // Analyze all imported data for patterns
      const stats = await this.worldModel.getStatistics();
      
      // Extract common scraping patterns
      const patterns = await this.extractCommonPatterns();
      
      // Build selector recommendations
      const recommendations = await this.buildSelectorRecommendations(patterns);
      
      // Update learning system
      await this.updateLearningSystem(recommendations);
      
      this.logger.info('Learning pipeline created successfully', {
        totalEntities: stats.entities,
        totalFacts: stats.facts,
        patterns: patterns.length,
        recommendations: recommendations.length
      });
    } catch (error) {
      this.logger.error('Failed to create learning pipeline', error as Error);
      throw error;
    }
  }

  // Helper methods
  private async validateDataSource(source: DataSource): Promise<void> {
    if (!fs.existsSync(source.path)) {
      throw new Error(`Data source file not found: ${source.path}`);
    }

    const stats = await fs.promises.stat(source.path);
    if (stats.size === 0) {
      throw new Error(`Data source file is empty: ${source.path}`);
    }
  }

  private getTransformer(type: string): DataTransformer {
    return this.transformers.get(type) || this.transformers.get('generic')!;
  }

  private async loadData(source: DataSource, options: any): Promise<any[]> {
    const records: any[] = [];
    
    if (source.type === 'json') {
      const content = await fs.promises.readFile(source.path, 'utf-8');
      const data = JSON.parse(content);
      records.push(...(Array.isArray(data) ? data : [data]));
    } else if (source.type === 'jsonl') {
      const content = await fs.promises.readFile(source.path, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      records.push(...lines.map(line => JSON.parse(line)));
    } else if (source.type === 'csv') {
      return new Promise((resolve, reject) => {
        const results: any[] = [];
        fs.createReadStream(source.path)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (source.type === 'javascript' || source.type === 'typescript') {
      const content = await fs.promises.readFile(source.path, 'utf-8');
      const stats = await fs.promises.stat(source.path);
      
      // Create a single record representing the entire file
      records.push({
        filename: path.basename(source.path),
        filepath: source.path,
        content: content,
        mtime: stats.mtime.getTime(),
        size: stats.size,
        language: source.type
      });
    }

    if (options.limit) {
      return records.slice(options.offset || 0, (options.offset || 0) + options.limit);
    }

    return records;
  }

  private validateScrapedData(data: ScraperData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.url) errors.push('URL is required');
    if (!data.domain) errors.push('Domain is required');
    if (!data.timestamp) errors.push('Timestamp is required');
    if (!data.extractedData || Object.keys(data.extractedData).length === 0) errors.push('Data is required');
    
    // For code imports, the URL is a file path, not a web URL
    if (data.goal !== 'javascript_code_import' && data.goal !== 'typescript_code_import') {
      try {
        new URL(data.url);
      } catch {
        errors.push('Invalid URL format');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private extractPatterns(data: ScraperData): ScrapingPattern[] {
    const patterns: ScrapingPattern[] = [];
    
    for (const [key, value] of Object.entries(data.extractedData)) {
      if (value && typeof value === 'object' && value.selector) {
        patterns.push({
          domain: data.domain,
          selector: value.selector,
          dataType: key,
          frequency: 1,
          confidence: data.confidence || 0.5,
          examples: [value.text || value.value || String(value)]
        });
      }
    }

    return patterns;
  }

  private async analyzeJsonFile(filePath: string): Promise<DataFormat> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const sample = JSON.parse(content);
    const first = Array.isArray(sample) ? sample[0] : sample;
    
    return {
      url: this.findField(first, ['url', 'link', 'href']),
      domain: this.findField(first, ['domain', 'host', 'site']),
      timestamp: this.findField(first, ['timestamp', 'time', 'date', 'created_at']),
      data: this.findField(first, ['data', 'content', 'extracted', 'scraped'])
    };
  }

  private async analyzeJsonlFile(filePath: string): Promise<DataFormat> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const firstLine = content.split('\n')[0];
    const sample = JSON.parse(firstLine);
    
    return {
      url: this.findField(sample, ['url', 'link', 'href']),
      domain: this.findField(sample, ['domain', 'host', 'site']),
      timestamp: this.findField(sample, ['timestamp', 'time', 'date', 'created_at']),
      data: this.findField(sample, ['data', 'content', 'extracted', 'scraped'])
    };
  }

  private async analyzeCsvFile(filePath: string): Promise<DataFormat> {
    return new Promise((resolve, reject) => {
      const headers: string[] = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers.push(...headerList);
        })
        .on('data', (data) => {
          // Just need first row to analyze structure
          resolve({
            url: this.findField(data, ['url', 'link', 'href']),
            domain: this.findField(data, ['domain', 'host', 'site']),
            timestamp: this.findField(data, ['timestamp', 'time', 'date', 'created_at']),
            data: this.findField(data, ['data', 'content', 'extracted', 'scraped'])
          });
        })
        .on('error', reject);
    });
  }

  private async analyzeJavaScriptFile(filePath: string): Promise<DataFormat> {
    // For JavaScript files, we'll extract code patterns rather than traditional data
    return {
      url: 'filename', // Use filename as identifier
      domain: 'filepath', // Use filepath as domain
      timestamp: 'mtime', // Use modification time
      data: 'content' // Use file content
    };
  }

  private async analyzeTypeScriptFile(filePath: string): Promise<DataFormat> {
    // For TypeScript files, we'll extract code patterns rather than traditional data
    return {
      url: 'filename', // Use filename as identifier
      domain: 'filepath', // Use filepath as domain  
      timestamp: 'mtime', // Use modification time
      data: 'content' // Use file content
    };
  }

  private findField(obj: any, candidates: string[]): string {
    for (const candidate of candidates) {
      if (obj && obj.hasOwnProperty(candidate)) {
        return candidate;
      }
    }
    return candidates[0] || 'unknown'; // Default to first candidate
  }

  private async extractCommonPatterns(): Promise<ScrapingPattern[]> {
    this.logger.info('Extracting common patterns from imported code and data');
    
    const patterns: ScrapingPattern[] = [];
    
    try {
      // Query the WorldModel for all imported scraped data
      // Since entities are typed based on content, we need to query by source characteristics
      const allData = await this.worldModel.query({
        entities: {} // Get all entities, we'll filter by their properties
      });
      
      this.logger.info('Querying for patterns', {
        totalEntities: allData.entities.length,
        entityTypes: allData.entities.map(e => e.type),
        sampleEntity: allData.entities[0]
      });
      
      // Process each data entry to extract patterns
      for (const entity of allData.entities) {
        const data = entity.properties;
        
        // Filter to only entities that have scraped data characteristics
        if (!data.goal && !data.extractedData && !data.codePatterns) {
          continue;
        }
        
        this.logger.info('Processing entity for patterns', {
          entityType: entity.type,
          entityName: entity.name,
          hasGoal: !!data.goal,
          goal: data.goal,
          hasCodePatterns: !!data.codePatterns,
          codePatternCount: data.codePatterns?.length || 0
        });
        
        // Extract patterns from JavaScript code imports
        if (data.goal === 'javascript_code_import' && data.codePatterns) {
          for (const codePattern of data.codePatterns) {
            // Convert code patterns to scraping patterns
            if (codePattern.selector) {
              const existingPattern = patterns.find(p => 
                p.selector === codePattern.selector && p.domain === data.domain
              );
              
              if (existingPattern) {
                existingPattern.frequency++;
                existingPattern.confidence = Math.max(existingPattern.confidence, codePattern.confidence);
                existingPattern.examples.push(codePattern.code);
              } else {
                patterns.push({
                  domain: data.domain,
                  selector: codePattern.selector,
                  dataType: codePattern.type,
                  frequency: 1,
                  confidence: codePattern.confidence,
                  examples: [codePattern.code]
                });
              }
            }
          }
        }
        
        // Extract patterns from regular scraped data
        if (data.extractedData && typeof data.extractedData === 'object') {
          for (const [key, value] of Object.entries(data.extractedData)) {
            if (value && typeof value === 'object' && (value as any).selector) {
              const valueObj = value as any;
              const existingPattern = patterns.find(p => 
                p.selector === valueObj.selector && p.domain === data.domain
              );
              
              if (existingPattern) {
                existingPattern.frequency++;
                existingPattern.examples.push(valueObj.text || valueObj.value || String(value));
              } else {
                patterns.push({
                  domain: data.domain,
                  selector: valueObj.selector,
                  dataType: key,
                  frequency: 1,
                  confidence: data.confidence || 0.5,
                  examples: [valueObj.text || valueObj.value || String(value)]
                });
              }
            }
          }
        }
      }
      
      // Sort patterns by frequency and confidence
      patterns.sort((a, b) => {
        if (a.frequency !== b.frequency) return b.frequency - a.frequency;
        return b.confidence - a.confidence;
      });
      
      this.logger.info('Pattern extraction completed', { 
        totalPatterns: patterns.length,
        domains: [...new Set(patterns.map(p => p.domain))],
        topSelectors: patterns.slice(0, 5).map(p => p.selector)
      });
      
      return patterns;
      
    } catch (error) {
      this.logger.error('Failed to extract common patterns', error as Error);
      return [];
    }
  }

  private async buildSelectorRecommendations(patterns: ScrapingPattern[]): Promise<SelectorRecommendation[]> {
    this.logger.info('Building selector recommendations from patterns', { patternCount: patterns.length });
    
    const recommendations: SelectorRecommendation[] = [];
    
    try {
      // Group patterns by domain and data type
      const domainGroups = new Map<string, ScrapingPattern[]>();
      const dataTypeGroups = new Map<string, ScrapingPattern[]>();
      
      for (const pattern of patterns) {
        // Group by domain
        if (!domainGroups.has(pattern.domain)) {
          domainGroups.set(pattern.domain, []);
        }
        domainGroups.get(pattern.domain)!.push(pattern);
        
        // Group by data type
        if (!dataTypeGroups.has(pattern.dataType)) {
          dataTypeGroups.set(pattern.dataType, []);
        }
        dataTypeGroups.get(pattern.dataType)!.push(pattern);
      }
      
      // Create domain-specific recommendations
      for (const [domain, domainPatterns] of domainGroups) {
        const highConfidencePatterns = domainPatterns.filter(p => p.confidence > 0.7);
        
        if (highConfidencePatterns.length > 0) {
          recommendations.push({
            type: 'domain-specific',
            domain,
            dataType: 'mixed',
            selectors: highConfidencePatterns.map(p => ({
              selector: p.selector,
              confidence: p.confidence,
              frequency: p.frequency,
              dataType: p.dataType,
              examples: p.examples.slice(0, 3) // Keep top 3 examples
            })),
            confidence: this.calculateAverageConfidence(highConfidencePatterns),
            priority: highConfidencePatterns.length * 0.1 + this.calculateAverageConfidence(highConfidencePatterns)
          });
        }
      }
      
      // Create data-type-specific recommendations
      for (const [dataType, typePatterns] of dataTypeGroups) {
        const crossDomainPatterns = typePatterns.filter(p => p.frequency > 1);
        
        if (crossDomainPatterns.length > 0) {
          recommendations.push({
            type: 'data-type-generic',
            domain: 'generic',
            dataType,
            selectors: crossDomainPatterns.map(p => ({
              selector: p.selector,
              confidence: p.confidence,
              frequency: p.frequency,
              dataType: p.dataType,
              examples: p.examples.slice(0, 3)
            })),
            confidence: this.calculateAverageConfidence(crossDomainPatterns),
            priority: crossDomainPatterns.length * 0.15 + this.calculateAverageConfidence(crossDomainPatterns)
          });
        }
      }
      
      // Create framework-specific recommendations
      const frameworkPatterns = patterns.filter(p => 
        p.examples.some(ex => ex.includes('page.') || ex.includes('driver.') || ex.includes('$'))
      );
      
      if (frameworkPatterns.length > 0) {
        const playwrightPatterns = frameworkPatterns.filter(p => 
          p.examples.some(ex => ex.includes('page.'))
        );
        
        if (playwrightPatterns.length > 0) {
          recommendations.push({
            type: 'framework-specific',
            domain: 'playwright',
            dataType: 'mixed',
            selectors: playwrightPatterns.map(p => ({
              selector: p.selector,
              confidence: p.confidence,
              frequency: p.frequency,
              dataType: p.dataType,
              examples: p.examples.filter(ex => ex.includes('page.')).slice(0, 3)
            })),
            confidence: this.calculateAverageConfidence(playwrightPatterns),
            priority: playwrightPatterns.length * 0.2 + this.calculateAverageConfidence(playwrightPatterns)
          });
        }
      }
      
      // Sort recommendations by priority (highest first)
      recommendations.sort((a, b) => b.priority - a.priority);
      
      this.logger.info('Selector recommendations built', {
        totalRecommendations: recommendations.length,
        domainSpecific: recommendations.filter(r => r.type === 'domain-specific').length,
        dataTypeGeneric: recommendations.filter(r => r.type === 'data-type-generic').length,
        frameworkSpecific: recommendations.filter(r => r.type === 'framework-specific').length
      });
      
      return recommendations;
      
    } catch (error) {
      this.logger.error('Failed to build selector recommendations', error as Error);
      return [];
    }
  }
  
  private calculateAverageConfidence(patterns: ScrapingPattern[]): number {
    if (patterns.length === 0) return 0;
    const sum = patterns.reduce((acc, p) => acc + p.confidence, 0);
    return sum / patterns.length;
  }

  private async updateLearningSystem(recommendations: SelectorRecommendation[]): Promise<void> {
    this.logger.info('Updating learning system with recommendations', { count: recommendations.length });
    
    try {
      // Store recommendations in the WorldModel for the autonomous scraper to use
      for (const recommendation of recommendations) {
        await this.worldModel.ingestScrapedData({
          url: `learning://selector_recommendation/${recommendation.type}`,
          domain: recommendation.domain,
          timestamp: Date.now(),
          goal: 'selector_recommendation',
          success: true,
          extractedData: {
            type: recommendation.type,
            dataType: recommendation.dataType,
            selectors: recommendation.selectors,
            confidence: recommendation.confidence,
            priority: recommendation.priority
          },
          confidence: recommendation.confidence,
          metadata: {
            scraper: 'learning_pipeline',
            technique: 'pattern_analysis'
          }
        });
      }
      
      // Create summary statistics for the learning system
      const stats = {
        totalRecommendations: recommendations.length,
        domainSpecific: recommendations.filter(r => r.type === 'domain-specific').length,
        dataTypeGeneric: recommendations.filter(r => r.type === 'data-type-generic').length,
        frameworkSpecific: recommendations.filter(r => r.type === 'framework-specific').length,
        averageConfidence: recommendations.reduce((acc, r) => acc + r.confidence, 0) / recommendations.length,
        topDomains: this.getTopDomains(recommendations),
        topDataTypes: this.getTopDataTypes(recommendations),
        lastUpdated: Date.now()
      };
      
      // Store learning system statistics
      await this.worldModel.ingestScrapedData({
        url: 'learning://system/statistics',
        domain: 'learning_system',
        timestamp: Date.now(),
        goal: 'learning_statistics',
        success: true,
        extractedData: stats,
        confidence: 1.0,
        metadata: {
          scraper: 'learning_pipeline',
          technique: 'statistics_generation'
        }
      });
      
      // Create domain-specific learning data
      const domainLearning = new Map<string, any>();
      for (const recommendation of recommendations) {
        if (recommendation.type === 'domain-specific') {
          domainLearning.set(recommendation.domain, {
            selectors: recommendation.selectors,
            confidence: recommendation.confidence,
            priority: recommendation.priority,
            lastUpdated: Date.now()
          });
        }
      }
      
      // Store domain-specific learning data
      for (const [domain, learningData] of domainLearning) {
        await this.worldModel.ingestScrapedData({
          url: `learning://domain/${domain}`,
          domain: domain,
          timestamp: Date.now(),
          goal: 'domain_learning',
          success: true,
          extractedData: learningData,
          confidence: learningData.confidence,
          metadata: {
            scraper: 'learning_pipeline',
            technique: 'domain_analysis'
          }
        });
      }
      
      this.logger.info('Learning system updated successfully', {
        recommendations: recommendations.length,
        domains: domainLearning.size,
        averageConfidence: stats.averageConfidence
      });
      
    } catch (error) {
      this.logger.error('Failed to update learning system', error as Error);
      throw error;
    }
  }
  
  private getTopDomains(recommendations: SelectorRecommendation[]): string[] {
    const domainCounts = new Map<string, number>();
    
    for (const rec of recommendations) {
      if (rec.type === 'domain-specific') {
        domainCounts.set(rec.domain, (domainCounts.get(rec.domain) || 0) + 1);
      }
    }
    
    return Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain]) => domain);
  }
  
  private getTopDataTypes(recommendations: SelectorRecommendation[]): string[] {
    const dataTypeCounts = new Map<string, number>();
    
    for (const rec of recommendations) {
      if (rec.type === 'data-type-generic') {
        dataTypeCounts.set(rec.dataType, (dataTypeCounts.get(rec.dataType) || 0) + 1);
      }
    }
    
    return Array.from(dataTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([dataType]) => dataType);
  }
}

// Base transformer interface
export interface DataTransformer {
  transform(record: any, format: DataFormat): Promise<ScraperData>;
}

// Transformer implementations
class GenericTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    const url = this.extractValue(record, format.url);
    const domainValue = format.domain ? this.extractValue(record, format.domain) : undefined;
    return {
      url: url || 'unknown',
      domain: domainValue || this.extractDomain(url || 'http://unknown.com'),
      timestamp: this.extractTimestamp(record, format.timestamp || 'timestamp'),
      goal: 'imported_data',
      success: true,
      extractedData: this.extractValue(record, format.data || 'data') || record,
      confidence: 0.5,
      metadata: {
        scraper: 'generic'
      }
    };
  }

  private extractValue(record: any, field: string | string[]): any {
    if (Array.isArray(field)) {
      for (const f of field) {
        if (record[f] !== undefined) return record[f];
      }
      return undefined;
    }
    return record[field];
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private extractTimestamp(record: any, field: string | string[]): number {
    const value = this.extractValue(record, field);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? Date.now() : date.getTime();
    }
    return Date.now();
  }
}

class ScrapyTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    // Scrapy-specific transformation logic
    return {
      url: record.url || record.response?.url,
      domain: record.domain || new URL(record.url || record.response?.url).hostname,
      timestamp: record.timestamp || Date.now(),
      goal: 'scrapy_import',
      success: record.success !== false,
      extractedData: record.items || record.data || record,
      confidence: 0.8,
      metadata: {
        scraper: 'scrapy',
        version: record.scrapy_version
      }
    };
  }
}

class PlaywrightTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    // Playwright-specific transformation logic
    return {
      url: record.url || record.page?.url,
      domain: record.domain || new URL(record.url || record.page?.url).hostname,
      timestamp: record.timestamp || Date.now(),
      goal: 'playwright_import',
      success: record.success !== false,
      extractedData: record.extracted || record.data || record,
      confidence: 0.8,
      metadata: {
        scraper: 'playwright'
      }
    };
  }
}

class PuppeteerTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    // Puppeteer-specific transformation logic
    return {
      url: record.url || record.page?.url,
      domain: record.domain || new URL(record.url || record.page?.url).hostname,
      timestamp: record.timestamp || Date.now(),
      goal: 'puppeteer_import',
      success: record.success !== false,
      extractedData: record.scraped || record.data || record,
      confidence: 0.8,
      metadata: {
        scraper: 'puppeteer'
      }
    };
  }
}

class SeleniumTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    // Selenium-specific transformation logic
    return {
      url: record.url || record.driver?.current_url,
      domain: record.domain || new URL(record.url || record.driver?.current_url).hostname,
      timestamp: record.timestamp || Date.now(),
      goal: 'selenium_import',
      success: record.success !== false,
      extractedData: record.elements || record.data || record,
      confidence: 0.8,
      metadata: {
        scraper: 'selenium'
      }
    };
  }
}

class BeautifulSoupTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    // Beautiful Soup-specific transformation logic
    return {
      url: record.url,
      domain: record.domain || new URL(record.url).hostname,
      timestamp: record.timestamp || Date.now(),
      goal: 'beautifulsoup_import',
      success: record.success !== false,
      extractedData: record.parsed || record.data || record,
      confidence: 0.7,
      metadata: {
        scraper: 'beautifulsoup'
      }
    };
  }
}

class JavaScriptTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    const codePatterns = this.extractCodePatterns(record.content, 'javascript');
    const domain = this.extractDomainFromPath(record.filepath);
    
    return {
      url: record.filepath,
      domain: domain,
      timestamp: record.mtime,
      goal: 'javascript_code_import',
      success: true,
      extractedData: {
        filename: record.filename,
        filepath: record.filepath,
        language: 'javascript',
        size: record.size,
        codePatterns: codePatterns.map(p => p.description).join(', '),
        selectors: codePatterns.filter(p => p.selector).map(p => p.selector),
        techniques: codePatterns.map(p => p.type)
      },
      confidence: 0.9,
      codePatterns: codePatterns,
      metadata: {
        scraper: 'javascript_code',
        language: 'javascript',
        fileSize: record.size
      }
    };
  }

  private extractCodePatterns(content: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Extract Playwright patterns
      if (trimmed.includes('page.')) {
        patterns.push(this.extractPlaywrightPattern(trimmed, index + 1, language));
      }
      
      // Extract Puppeteer patterns
      if (trimmed.includes('await page.') || trimmed.includes('page.evaluate')) {
        patterns.push(this.extractPuppeteerPattern(trimmed, index + 1, language));
      }
      
      // Extract Selenium patterns
      if (trimmed.includes('driver.') || trimmed.includes('findElement')) {
        patterns.push(this.extractSeleniumPattern(trimmed, index + 1, language));
      }
      
      // Extract Cheerio patterns
      if (trimmed.includes('$') && (trimmed.includes('.text()') || trimmed.includes('.html()') || trimmed.includes('.attr('))) {
        patterns.push(this.extractCheerioPattern(trimmed, index + 1, language));
      }
      
      // Extract error handling patterns
      if (trimmed.includes('try {') || trimmed.includes('catch') || trimmed.includes('.catch(')) {
        patterns.push({
          type: 'error-handling',
          framework: 'generic',
          code: trimmed,
          description: 'Error handling pattern',
          confidence: 0.8,
          lineNumber: index + 1
        });
      }
      
      // Extract wait strategies
      if (trimmed.includes('waitFor') || trimmed.includes('sleep') || trimmed.includes('timeout')) {
        patterns.push({
          type: 'wait-strategy',
          framework: 'generic',
          code: trimmed,
          description: 'Wait/timing strategy',
          confidence: 0.7,
          lineNumber: index + 1
        });
      }
    });
    
    return patterns.filter(p => p.code.length > 0);
  }
  
  private extractPlaywrightPattern(line: string, lineNumber: number, language: string): CodePattern {
    const selectorMatch = line.match(/['"`]([^'"`]+)['"`]/);
    const selector = selectorMatch ? selectorMatch[1] : undefined;
    
    let type: CodePattern['type'] = 'interaction';
    let description = 'Playwright interaction';
    
    if (line.includes('goto') || line.includes('navigate')) {
      type = 'navigation';
      description = 'Page navigation';
    } else if (line.includes('textContent') || line.includes('innerText') || line.includes('innerHTML')) {
      type = 'data-extraction';
      description = 'Text content extraction';
    } else if (line.includes('click') || line.includes('fill') || line.includes('press')) {
      type = 'interaction';
      description = 'User interaction';
    } else if (line.includes('waitFor')) {
      type = 'wait-strategy';
      description = 'Wait strategy';
    }
    
    return {
      type,
      framework: 'playwright',
      code: line,
      description,
      selector,
      confidence: 0.9,
      lineNumber
    };
  }
  
  private extractPuppeteerPattern(line: string, lineNumber: number, language: string): CodePattern {
    const selectorMatch = line.match(/['"`]([^'"`]+)['"`]/);
    const selector = selectorMatch ? selectorMatch[1] : undefined;
    
    let type: CodePattern['type'] = 'interaction';
    let description = 'Puppeteer interaction';
    
    if (line.includes('goto')) {
      type = 'navigation';
      description = 'Page navigation';
    } else if (line.includes('evaluate') || line.includes('$eval') || line.includes('$$eval')) {
      type = 'data-extraction';
      description = 'Data extraction';
    } else if (line.includes('click') || line.includes('type') || line.includes('focus')) {
      type = 'interaction';
      description = 'User interaction';
    } else if (line.includes('waitFor')) {
      type = 'wait-strategy';
      description = 'Wait strategy';
    }
    
    return {
      type,
      framework: 'puppeteer',
      code: line,
      description,
      selector,
      confidence: 0.9,
      lineNumber
    };
  }
  
  private extractSeleniumPattern(line: string, lineNumber: number, language: string): CodePattern {
    const selectorMatch = line.match(/By\.([^(]+)\((['"`])([^'"`]+)\2\)/);
    const selector = selectorMatch ? selectorMatch[3] : undefined;
    
    let type: CodePattern['type'] = 'interaction';
    let description = 'Selenium interaction';
    
    if (line.includes('get(') || line.includes('navigate')) {
      type = 'navigation';
      description = 'Page navigation';
    } else if (line.includes('getText') || line.includes('getAttribute')) {
      type = 'data-extraction';
      description = 'Data extraction';
    } else if (line.includes('click') || line.includes('sendKeys') || line.includes('submit')) {
      type = 'interaction';
      description = 'User interaction';
    } else if (line.includes('WebDriverWait') || line.includes('until')) {
      type = 'wait-strategy';
      description = 'Wait strategy';
    }
    
    return {
      type,
      framework: 'selenium',
      code: line,
      description,
      selector,
      confidence: 0.9,
      lineNumber
    };
  }
  
  private extractCheerioPattern(line: string, lineNumber: number, language: string): CodePattern {
    const selectorMatch = line.match(/\$\(['"`]([^'"`]+)['"`]\)/);
    const selector = selectorMatch ? selectorMatch[1] : undefined;
    
    return {
      type: 'data-extraction',
      framework: 'cheerio',
      code: line,
      description: 'Cheerio data extraction',
      selector,
      confidence: 0.8,
      lineNumber
    };
  }
  
  private extractDomainFromPath(filepath: string): string {
    const filename = path.basename(filepath);
    
    // Extract domain from filename patterns
    const domainMatch = filename.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.(js|ts)/);
    if (domainMatch) {
      return domainMatch[1];
    }
    
    // Extract from common patterns
    if (filename.includes('terra-bella')) return 'terrabellaflowers.com';
    if (filename.includes('uniqlo')) return 'uniqlo.com';
    if (filename.includes('nordstrom')) return 'nordstrom.com';
    if (filename.includes('everlane')) return 'everlane.com';
    
    return 'unknown.com';
  }
}

class TypeScriptTransformer implements DataTransformer {
  async transform(record: any, format: DataFormat): Promise<ScraperData> {
    // TypeScript uses same pattern extraction as JavaScript
    const jsTransformer = new JavaScriptTransformer();
    const result = await jsTransformer.transform(record, format);
    
    // Update metadata to reflect TypeScript
    result.metadata = {
      scraper: 'typescript_code',
      language: 'typescript',
      fileSize: result.metadata?.fileSize
    };
    
    result.extractedData.language = 'typescript';
    result.goal = 'typescript_code_import';
    
    return result;
  }
}