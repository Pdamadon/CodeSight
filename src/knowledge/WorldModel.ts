// WorldModel.ts - Main interface for the persistent knowledge system
// Integrates MongoDB + Pinecone storage with EntityStore, QueryEngine, and ChangeLog

import { EntityStore, Entity, Relationship, Fact } from './EntityStore.js';
import { QueryEngine, WorldModelQuery, WorldModelResponse } from './QueryEngine.js';
import { ChangeLog, ChangeEvent, Inconsistency } from './ChangeLog.js';
import { UnifiedStore, StorageConfig } from '../storage/UnifiedStore.js';
import { Logger } from '../monitoring/Logger.js';

export interface ScrapedData {
  url: string;
  domain: string;
  timestamp: number;
  extractedData: Record<string, any>;
  confidence: number;
  goal: string;
  sessionId?: string;
  success?: boolean;
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

export interface CodePattern {
  type: 'selector' | 'navigation' | 'interaction' | 'data-extraction' | 'error-handling' | 'wait-strategy';
  framework: 'playwright' | 'puppeteer' | 'selenium' | 'cheerio' | 'generic';
  code: string;
  description: string;
  selector?: string;
  confidence: number;
  lineNumber?: number;
  context?: string;
}

export interface WorldModelStats {
  entities: number;
  relationships: number;
  facts: number;
  inconsistencies: number;
  lastUpdated: number;
  domains: string[];
}

export class WorldModel {
  private entityStore: EntityStore;
  private queryEngine: QueryEngine;
  private changeLog: ChangeLog;
  private unifiedStore: UnifiedStore;
  private logger: Logger;
  private sessionId: string;
  private isInitialized: boolean = false;

  constructor(config: StorageConfig, sessionId?: string) {
    this.entityStore = new EntityStore();
    this.queryEngine = new QueryEngine(this.entityStore);
    this.changeLog = new ChangeLog();
    this.unifiedStore = new UnifiedStore(config);
    this.logger = Logger.getInstance();
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await this.unifiedStore.initialize();
      this.isInitialized = true;
      this.logger.info('WorldModel initialized with persistent storage');
    } catch (error) {
      this.logger.error('Failed to initialize WorldModel', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isInitialized) {
      await this.unifiedStore.disconnect();
      this.isInitialized = false;
    }
  }

  // Main method for autonomous scraper to ingest scraped data
  async ingestScrapedData(scrapedData: ScrapedData): Promise<{
    entitiesCreated: number;
    relationshipsCreated: number;
    factsCreated: number;
    inconsistencies: Inconsistency[];
  }> {
    const startTime = Date.now();

    try {
      this.logger.info('Ingesting scraped data', {
        url: scrapedData.url,
        domain: scrapedData.domain,
        goal: scrapedData.goal,
        dataKeys: Object.keys(scrapedData.extractedData)
      });

      // Use unified store for persistent storage with embeddings
      const result = await this.unifiedStore.ingestScrapedData(scrapedData);

      // Also update in-memory stores for immediate access
      const entities = this.extractEntitiesFromScrapedData(scrapedData);
      const relationships = this.extractRelationshipsFromScrapedData(scrapedData, entities);
      const facts = this.extractFactsFromScrapedData(scrapedData, entities);

      // Add to in-memory store
      entities.forEach(entity => this.entityStore.addEntity(entity));
      relationships.forEach(relationship => this.entityStore.addRelationship(relationship));
      facts.forEach(fact => this.entityStore.addFact(fact));

      // Log changes
      entities.forEach(entity => this.logChange('ENTITY_CREATED', { entityId: entity.id }, scrapedData));
      relationships.forEach(relationship => this.logChange('RELATIONSHIP_CREATED', { relationshipId: relationship.id }, scrapedData));
      facts.forEach(fact => this.logChange('FACT_CREATED', { factId: fact.id }, scrapedData));

      // Check for inconsistencies
      const allEntities = this.entityStore.export().entities;
      const allRelationships = this.entityStore.export().relationships;
      const allFacts = this.entityStore.export().facts;
      const inconsistencies = this.changeLog.checkConsistency(allEntities, allRelationships, allFacts);

      this.logger.info('Scraped data ingestion completed', {
        entitiesCreated: result.entitiesCreated,
        relationshipsCreated: result.relationshipsCreated,
        factsCreated: result.factsCreated,
        inconsistencies: inconsistencies.length,
        processingTime: Date.now() - startTime
      });

      return {
        entitiesCreated: result.entitiesCreated,
        relationshipsCreated: result.relationshipsCreated,
        factsCreated: result.factsCreated,
        inconsistencies
      };

    } catch (error) {
      this.logger.error('Failed to ingest scraped data', error as Error, {
        url: scrapedData.url,
        goal: scrapedData.goal
      });
      throw error;
    }
  }

  // Query the world model for autonomous planning
  query(query: WorldModelQuery): WorldModelResponse {
    return this.queryEngine.query(query);
  }

  // Semantic search using vector embeddings
  async semanticSearch(
    query: string,
    options: {
      type?: 'entity' | 'relationship' | 'fact' | 'page_content';
      domain?: string;
      goal?: string;
      limit?: number;
      includeRAG?: boolean;
    } = {}
  ): Promise<{
    results: any[];
    ragContext?: any;
  }> {
    try {
      if (!this.isInitialized) {
        throw new Error('WorldModel not initialized with persistent storage');
      }

      const searchResult = await this.unifiedStore.searchEntities({
        text: query,
        type: options.type === 'entity' ? undefined : undefined, // Map types appropriately
        domain: options.domain,
        goal: options.goal,
        limit: options.limit,
        semanticSearch: true
      });

      return {
        results: searchResult.entities,
        ragContext: searchResult.ragContext
      };
    } catch (error) {
      this.logger.error('Failed to perform semantic search', error as Error, { query });
      throw error;
    }
  }

  // Find similar entities using vector similarity
  async findSimilarEntities(
    entityId: string,
    options: {
      domain?: string;
      goal?: string;
      limit?: number;
    } = {}
  ): Promise<{
    originalEntity: any;
    similarEntities: any[];
    similarityScores: number[];
  }> {
    try {
      if (!this.isInitialized) {
        throw new Error('WorldModel not initialized with persistent storage');
      }

      const result = await this.unifiedStore.findSimilarEntities(entityId, {
        domain: options.domain,
        goal: options.goal,
        topK: options.limit || 5
      });

      return {
        originalEntity: result.originalEntity,
        similarEntities: result.similarEntities,
        similarityScores: result.similarityScores.map(r => r.score)
      };
    } catch (error) {
      this.logger.error('Failed to find similar entities', error as Error, { entityId });
      throw error;
    }
  }

  // Get context for autonomous scraper planning
  async getScrapingContext(url: string, goal: string): Promise<{
    previouslyScraped: boolean;
    relatedEntities: Entity[];
    domainPatterns: any[];
    recommendations: string[];
    ragContext?: any;
  }> {
    try {
      // Get rich context from unified store (MongoDB + Pinecone)
      const context = await this.unifiedStore.getScrapingContext(url, goal);
      
      // Also get in-memory context for immediate access
      const domain = new URL(url).hostname;
      const domainEntities = this.queryEngine.query({
        entities: { sourceUrl: url }
      });

      const goalEntities = this.queryEngine.query({
        entities: { 
          name: goal // Simple name matching for now
        }
      });

      // Combine results
      const allRelatedEntities = [
        ...domainEntities.entities,
        ...goalEntities.entities,
        ...context.relatedEntities
      ];

      // Remove duplicates
      const uniqueEntities = allRelatedEntities.filter((entity, index, self) =>
        index === self.findIndex(e => e.id === entity.id)
      );

      return {
        previouslyScraped: context.previouslyScraped,
        relatedEntities: uniqueEntities,
        domainPatterns: context.scrapingPatterns,
        recommendations: context.recommendations,
        ragContext: context.ragContext
      };
    } catch (error) {
      this.logger.error('Failed to get scraping context', error as Error, { url, goal });
      
      // Fallback to in-memory only
      const domain = new URL(url).hostname;
      const domainEntities = this.queryEngine.query({
        entities: { sourceUrl: url }
      });

      return {
        previouslyScraped: domainEntities.entities.length > 0,
        relatedEntities: domainEntities.entities,
        domainPatterns: [],
        recommendations: ['Using fallback context - persistent storage unavailable']
      };
    }
  }

  // Get statistics for monitoring
  async getStatistics(): Promise<WorldModelStats> {
    try {
      if (this.isInitialized) {
        // Get stats from persistent storage
        const stats = await this.unifiedStore.getStatistics();
        return {
          entities: stats.combined.totalEntities,
          relationships: stats.mongodb.totalRelationships,
          facts: stats.mongodb.totalFacts,
          inconsistencies: 0, // TODO: Get from change log
          lastUpdated: Date.now(),
          domains: stats.combined.topDomains
        };
      } else {
        // Fallback to in-memory stats
        const entityStats = this.entityStore.getStatistics();
        const changeStats = this.changeLog.getConsistencyStatistics();
        
        // Get unique domains
        const domains = new Set<string>();
        for (const entity of this.entityStore.export().entities) {
          try {
            domains.add(new URL(entity.sourceUrl).hostname);
          } catch (e) {
            // Skip invalid URLs
          }
        }

        return {
          entities: entityStats.totalEntities,
          relationships: entityStats.totalRelationships,
          facts: entityStats.totalFacts,
          inconsistencies: changeStats.unresolvedInconsistencies,
          lastUpdated: Date.now(),
          domains: Array.from(domains)
        };
      }
    } catch (error) {
      this.logger.error('Failed to get statistics', error as Error);
      throw error;
    }
  }

  // Export data for persistence
  export(): {
    entities: Entity[];
    relationships: Relationship[];
    facts: Fact[];
    events: ChangeEvent[];
    inconsistencies: Inconsistency[];
  } {
    const storeData = this.entityStore.export();
    const changeData = this.changeLog.export();
    
    return {
      entities: storeData.entities,
      relationships: storeData.relationships,
      facts: storeData.facts,
      events: changeData.events,
      inconsistencies: changeData.inconsistencies
    };
  }

  // Import data from persistence
  import(data: {
    entities: Entity[];
    relationships: Relationship[];
    facts: Fact[];
    events: ChangeEvent[];
    inconsistencies: Inconsistency[];
    rules: any[];
  }): void {
    this.entityStore.import({
      entities: data.entities,
      relationships: data.relationships,
      facts: data.facts
    });
    
    this.changeLog.import({
      events: data.events,
      inconsistencies: data.inconsistencies,
      rules: data.rules
    });
  }

  // Clear all data
  clear(): void {
    this.entityStore.clear();
    this.changeLog.clear();
    this.queryEngine.clearCache();
  }

  private extractEntitiesFromScrapedData(scrapedData: ScrapedData): Entity[] {
    const entities: Entity[] = [];
    const baseId = `${scrapedData.domain}_${Date.now()}`;
    
    for (const [key, value] of Object.entries(scrapedData.extractedData)) {
      if (value && typeof value === 'object' && value.text) {
        const entityType = this.inferEntityType(key, value.text, scrapedData.goal);
        
        entities.push({
          id: `${baseId}_${key}_${entities.length}`,
          type: entityType,
          name: value.text.substring(0, 100), // Limit name length
          properties: {
            originalKey: key,
            selector: value.selector,
            href: value.href,
            src: value.src,
            value: value.value,
            extractedAt: scrapedData.timestamp,
            goal: scrapedData.goal,
            domain: scrapedData.domain
          },
          confidence: scrapedData.confidence,
          sourceUrl: scrapedData.url,
          extractedAt: scrapedData.timestamp,
          lastUpdated: scrapedData.timestamp
        });
      }
    }
    
    return entities;
  }

  private extractRelationshipsFromScrapedData(scrapedData: ScrapedData, entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];
    
    // Create relationships between entities from the same scrape
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // Infer relationship type based on entity types
        const relationshipType = this.inferRelationshipType(entity1.type, entity2.type);
        
        if (relationshipType) {
          relationships.push({
            id: `rel_${entity1.id}_${entity2.id}`,
            type: relationshipType,
            source: entity1.id,
            target: entity2.id,
            properties: {
              coOccurred: true,
              extractedTogether: true,
              domain: scrapedData.domain,
              goal: scrapedData.goal
            },
            confidence: scrapedData.confidence * 0.8, // Slightly lower confidence for inferred relationships
            sourceUrl: scrapedData.url,
            extractedAt: scrapedData.timestamp
          });
        }
      }
    }
    
    return relationships;
  }

  private extractFactsFromScrapedData(scrapedData: ScrapedData, entities: Entity[]): Fact[] {
    const facts: Fact[] = [];
    
    // Create facts about entities
    for (const entity of entities) {
      // Fact about extraction
      facts.push({
        id: `fact_${entity.id}_extracted`,
        subject: entity.id,
        predicate: 'extracted_from',
        object: scrapedData.url,
        confidence: scrapedData.confidence,
        sourceUrl: scrapedData.url,
        extractedAt: scrapedData.timestamp
      });
      
      // Fact about domain
      facts.push({
        id: `fact_${entity.id}_domain`,
        subject: entity.id,
        predicate: 'belongs_to_domain',
        object: scrapedData.domain,
        confidence: 0.95,
        sourceUrl: scrapedData.url,
        extractedAt: scrapedData.timestamp
      });
      
      // Fact about goal
      facts.push({
        id: `fact_${entity.id}_goal`,
        subject: entity.id,
        predicate: 'relevant_to_goal',
        object: scrapedData.goal,
        confidence: scrapedData.confidence,
        sourceUrl: scrapedData.url,
        extractedAt: scrapedData.timestamp
      });
    }
    
    return facts;
  }

  private inferEntityType(key: string, text: string, goal: string): Entity['type'] {
    const keyLower = key.toLowerCase();
    const textLower = text.toLowerCase();
    const goalLower = goal.toLowerCase();
    
    // Price indicators
    if (keyLower.includes('price') || textLower.match(/\$\d+|\d+\.\d+/) || keyLower.includes('cost')) {
      return 'price';
    }
    
    // Product indicators
    if (keyLower.includes('product') || keyLower.includes('item') || keyLower.includes('title')) {
      return 'product';
    }
    
    // Vendor indicators
    if (keyLower.includes('vendor') || keyLower.includes('seller') || keyLower.includes('brand')) {
      return 'vendor';
    }
    
    // Category indicators
    if (keyLower.includes('category') || keyLower.includes('section') || keyLower.includes('department')) {
      return 'category';
    }
    
    // Date indicators
    if (keyLower.includes('date') || keyLower.includes('time') || textLower.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/)) {
      return 'date';
    }
    
    // Location indicators
    if (keyLower.includes('location') || keyLower.includes('address') || keyLower.includes('store')) {
      return 'location';
    }
    
    // Availability indicators
    if (keyLower.includes('stock') || keyLower.includes('available') || textLower.includes('in stock') || textLower.includes('out of stock')) {
      return 'availability';
    }
    
    // Default to product for most content
    return 'product';
  }

  private inferRelationshipType(type1: Entity['type'], type2: Entity['type']): Relationship['type'] | null {
    // Product-Price relationship
    if ((type1 === 'product' && type2 === 'price') || (type1 === 'price' && type2 === 'product')) {
      return 'PRICED_AT';
    }
    
    // Product-Vendor relationship
    if ((type1 === 'product' && type2 === 'vendor') || (type1 === 'vendor' && type2 === 'product')) {
      return 'SOLD_BY';
    }
    
    // Product-Category relationship
    if ((type1 === 'product' && type2 === 'category') || (type1 === 'category' && type2 === 'product')) {
      return 'CATEGORY_OF';
    }
    
    // Product-Location relationship
    if ((type1 === 'product' && type2 === 'location') || (type1 === 'location' && type2 === 'product')) {
      return 'LOCATED_IN';
    }
    
    // Product-Availability relationship
    if ((type1 === 'product' && type2 === 'availability') || (type1 === 'availability' && type2 === 'product')) {
      return 'AVAILABLE_AT';
    }
    
    // Default: no relationship
    return null;
  }

  private generateScrapingRecommendations(entities: Entity[], domain: string, goal: string): string[] {
    const recommendations: string[] = [];
    
    if (entities.length === 0) {
      recommendations.push(`First time scraping ${domain} for "${goal}"`);
      recommendations.push('Focus on extracting primary content elements');
    } else {
      recommendations.push(`Found ${entities.length} related entities from previous scrapes`);
      
      // Analyze successful patterns
      const successfulSelectors = entities
        .map(e => e.properties.selector)
        .filter(Boolean)
        .filter((s, i, arr) => arr.indexOf(s) === i); // unique
      
      if (successfulSelectors.length > 0) {
        recommendations.push(`Consider trying these successful selectors: ${successfulSelectors.slice(0, 3).join(', ')}`);
      }
      
      // Look for consistency patterns
      const entityTypes = entities.map(e => e.type);
      const mostCommonType = entityTypes.reduce((a, b, i, arr) => 
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
      );
      
      recommendations.push(`Most common entity type from ${domain}: ${mostCommonType}`);
    }
    
    return recommendations;
  }

  private logChange(
    type: ChangeEvent['type'], 
    params: { entityId?: string; relationshipId?: string; factId?: string; oldValue?: any; newValue?: any },
    scrapedData: ScrapedData
  ): void {
    this.changeLog.logEvent({
      type,
      entityId: params.entityId,
      relationshipId: params.relationshipId,
      factId: params.factId,
      oldValue: params.oldValue,
      newValue: params.newValue,
      sourceUrl: scrapedData.url,
      timestamp: scrapedData.timestamp,
      confidence: scrapedData.confidence,
      metadata: {
        domain: scrapedData.domain,
        goal: scrapedData.goal,
        sessionId: this.sessionId
      },
      sessionId: this.sessionId
    });
  }
}