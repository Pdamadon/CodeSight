// UnifiedStore.ts - Unified storage layer combining MongoDB and Pinecone

import { MongoDBStore, MongoEntity, MongoRelationship, MongoFact } from './MongoDBStore.js';
import { PineconeStore, SimilaritySearchResult, RAGContext } from './PineconeStore.js';
import { Entity, Relationship, Fact } from '../knowledge/EntityStore.js';
import { ChangeEvent } from '../knowledge/ChangeLog.js';
import { ScrapedData } from '../knowledge/WorldModel.js';
import { Logger } from '../monitoring/Logger.js';

export interface UnifiedSearchResult {
  entities: MongoEntity[];
  relationships: MongoRelationship[];
  facts: MongoFact[];
  similarityResults: SimilaritySearchResult[];
  ragContext?: RAGContext;
}

export interface StorageConfig {
  mongodb: {
    connectionString: string;
    databaseName?: string;
  };
  pinecone: {
    apiKey: string;
    indexName?: string;
    environment?: string;
  };
  openai: {
    apiKey: string;
  };
}

export class UnifiedStore {
  private mongoStore: MongoDBStore;
  private pineconeStore: PineconeStore;
  private logger: Logger;
  private isInitialized: boolean = false;

  constructor(config: StorageConfig) {
    this.mongoStore = new MongoDBStore(
      config.mongodb.connectionString,
      config.mongodb.databaseName
    );
    
    this.pineconeStore = new PineconeStore(
      config.pinecone.apiKey,
      config.openai.apiKey,
      config.pinecone.indexName,
      config.pinecone.environment
    );
    
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing unified store...');
      
      // Initialize both stores in parallel
      await Promise.all([
        this.mongoStore.connect(),
        this.pineconeStore.initialize()
      ]);
      
      this.isInitialized = true;
      this.logger.info('Unified store initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize unified store', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isInitialized) {
      await this.mongoStore.disconnect();
      this.isInitialized = false;
      this.logger.info('Unified store disconnected');
    }
  }

  // Entity operations with automatic embedding generation
  async addEntity(entity: Entity): Promise<MongoEntity> {
    try {
      // Store in MongoDB
      const mongoEntity = await this.mongoStore.addEntity(entity);
      
      // Generate content for embedding
      const content = this.generateEntityContent(entity);
      
      // Store embedding in Pinecone
      await this.pineconeStore.upsertEntityEmbedding(
        entity.id,
        content,
        {
          url: entity.sourceUrl,
          domain: this.extractDomain(entity.sourceUrl),
          goal: entity.properties.goal || 'unknown',
          timestamp: entity.extractedAt,
          confidence: entity.confidence,
          sessionId: entity.properties.sessionId
        }
      );
      
      return mongoEntity;
    } catch (error) {
      this.logger.error('Failed to add entity', error as Error, { entityId: entity.id });
      throw error;
    }
  }

  async addRelationship(relationship: Relationship): Promise<MongoRelationship> {
    try {
      // Store in MongoDB
      const mongoRelationship = await this.mongoStore.addRelationship(relationship);
      
      // Generate content for embedding
      const content = this.generateRelationshipContent(relationship);
      
      // Store embedding in Pinecone
      await this.pineconeStore.upsertRelationshipEmbedding(
        relationship.id,
        content,
        {
          url: relationship.sourceUrl,
          domain: this.extractDomain(relationship.sourceUrl),
          goal: relationship.properties.goal || 'unknown',
          timestamp: relationship.extractedAt,
          confidence: relationship.confidence,
          sessionId: relationship.properties.sessionId
        }
      );
      
      return mongoRelationship;
    } catch (error) {
      this.logger.error('Failed to add relationship', error as Error, { relationshipId: relationship.id });
      throw error;
    }
  }

  async addFact(fact: Fact): Promise<MongoFact> {
    try {
      // Store in MongoDB
      const mongoFact = await this.mongoStore.addFact(fact);
      
      // Facts are typically stored as embeddings within entity/relationship content
      // No separate fact embedding needed unless it's a complex fact
      
      return mongoFact;
    } catch (error) {
      this.logger.error('Failed to add fact', error as Error, { factId: fact.id });
      throw error;
    }
  }

  // Scraping session operations
  async ingestScrapedData(scrapedData: ScrapedData): Promise<{
    entitiesCreated: number;
    relationshipsCreated: number;
    factsCreated: number;
  }> {
    try {
      let entitiesCreated = 0;
      let relationshipsCreated = 0;
      let factsCreated = 0;

      // Store page content embedding
      const pageContent = this.generatePageContent(scrapedData);
      await this.pineconeStore.upsertPageContentEmbedding(
        scrapedData.url,
        pageContent,
        {
          domain: scrapedData.domain,
          goal: scrapedData.goal,
          timestamp: scrapedData.timestamp,
          confidence: scrapedData.confidence,
          sessionId: scrapedData.sessionId
        }
      );

      // Process extracted data
      const entities = this.extractEntitiesFromScrapedData(scrapedData);
      const relationships = this.extractRelationshipsFromScrapedData(scrapedData, entities);
      const facts = this.extractFactsFromScrapedData(scrapedData, entities);

      // Store entities
      for (const entity of entities) {
        await this.addEntity(entity);
        entitiesCreated++;
      }

      // Store relationships
      for (const relationship of relationships) {
        await this.addRelationship(relationship);
        relationshipsCreated++;
      }

      // Store facts
      for (const fact of facts) {
        await this.addFact(fact);
        factsCreated++;
      }

      return {
        entitiesCreated,
        relationshipsCreated,
        factsCreated
      };
    } catch (error) {
      this.logger.error('Failed to ingest scraped data', error as Error, { url: scrapedData.url });
      throw error;
    }
  }

  // Unified search operations
  async searchEntities(query: {
    text?: string;
    type?: Entity['type'];
    domain?: string;
    goal?: string;
    sourceUrl?: string;
    confidenceMin?: number;
    dateRange?: { from: Date; to: Date };
    limit?: number;
    skip?: number;
    semanticSearch?: boolean;
  }): Promise<UnifiedSearchResult> {
    try {
      // Structured search in MongoDB
      const entities = await this.mongoStore.searchEntities({
        type: query.type,
        name: query.text,
        domain: query.domain,
        goal: query.goal,
        sourceUrl: query.sourceUrl,
        confidenceMin: query.confidenceMin,
        dateRange: query.dateRange,
        limit: query.limit,
        skip: query.skip
      });

      let similarityResults: SimilaritySearchResult[] = [];
      let ragContext: RAGContext | undefined;

      // Semantic search in Pinecone if requested
      if (query.semanticSearch && query.text) {
        similarityResults = await this.pineconeStore.similaritySearch(query.text, {
          type: 'entity',
          domain: query.domain,
          goal: query.goal,
          topK: query.limit || 10
        });

        // Generate RAG context
        ragContext = await this.pineconeStore.generateRAGContext(query.text, {
          type: 'entity',
          domain: query.domain,
          goal: query.goal,
          maxResults: 5
        });
      }

      return {
        entities,
        relationships: [],
        facts: [],
        similarityResults,
        ragContext
      };
    } catch (error) {
      this.logger.error('Failed to search entities', error as Error, { query });
      throw error;
    }
  }

  async findSimilarEntities(
    entityId: string,
    options: {
      domain?: string;
      goal?: string;
      topK?: number;
      scoreThreshold?: number;
    } = {}
  ): Promise<{
    originalEntity: MongoEntity | null;
    similarEntities: MongoEntity[];
    similarityScores: SimilaritySearchResult[];
  }> {
    try {
      // Get original entity
      const originalEntity = await this.mongoStore.getEntity(entityId);
      
      // Find similar entities using vector search
      const similarityResults = await this.pineconeStore.findSimilarEntities(entityId, options);
      
      // Get full entity details from MongoDB
      const similarEntities: MongoEntity[] = [];
      for (const result of similarityResults) {
        if (result.metadata.entityId) {
          const entity = await this.mongoStore.getEntity(result.metadata.entityId);
          if (entity) {
            similarEntities.push(entity);
          }
        }
      }

      return {
        originalEntity,
        similarEntities,
        similarityScores: similarityResults
      };
    } catch (error) {
      this.logger.error('Failed to find similar entities', error as Error, { entityId });
      throw error;
    }
  }

  async getScrapingContext(
    url: string,
    goal: string
  ): Promise<{
    previouslyScraped: boolean;
    relatedEntities: MongoEntity[];
    scrapingPatterns: SimilaritySearchResult[];
    ragContext: RAGContext;
    recommendations: string[];
  }> {
    try {
      const domain = this.extractDomain(url);
      
      // Get entities from this domain
      const domainEntities = await this.mongoStore.getEntitiesByDomain(domain);
      
      // Get scraping patterns for this domain and goal
      const scrapingPatterns = await this.pineconeStore.getScrapingPatterns(domain, goal);
      
      // Generate RAG context for autonomous planning
      const ragContext = await this.pineconeStore.generateRAGContext(
        `scraping ${goal} from ${domain}`,
        {
          domain,
          goal,
          maxResults: 10
        }
      );

      // Generate recommendations
      const recommendations = this.generateScrapingRecommendations(
        domainEntities,
        scrapingPatterns,
        ragContext
      );

      return {
        previouslyScraped: domainEntities.length > 0,
        relatedEntities: domainEntities,
        scrapingPatterns,
        ragContext,
        recommendations
      };
    } catch (error) {
      this.logger.error('Failed to get scraping context', error as Error, { url, goal });
      throw error;
    }
  }

  // Analytics and monitoring
  async getStatistics(): Promise<{
    mongodb: any;
    pinecone: any;
    combined: {
      totalEntities: number;
      totalVectors: number;
      avgConfidence: number;
      topDomains: string[];
      topGoals: string[];
    };
  }> {
    try {
      const [mongoStats, pineconeStats] = await Promise.all([
        this.mongoStore.getStatistics(),
        this.pineconeStore.getIndexStats()
      ]);

      return {
        mongodb: mongoStats,
        pinecone: pineconeStats,
        combined: {
          totalEntities: mongoStats.totalEntities,
          totalVectors: pineconeStats.totalVectors,
          avgConfidence: mongoStats.averageConfidence,
          topDomains: Object.keys(mongoStats.sessionsByDomain).slice(0, 5),
          topGoals: [] // TODO: Extract from session data
        }
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    mongodb: any;
    pinecone: any;
    unified: any;
  }> {
    try {
      const [mongoHealth, pineconeHealth] = await Promise.all([
        this.mongoStore.healthCheck(),
        this.pineconeStore.healthCheck()
      ]);

      const overallStatus = mongoHealth.status === 'healthy' && pineconeHealth.status === 'healthy'
        ? 'healthy'
        : 'unhealthy';

      return {
        status: overallStatus,
        mongodb: mongoHealth,
        pinecone: pineconeHealth,
        unified: {
          initialized: this.isInitialized,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        mongodb: { status: 'unhealthy', error: 'Connection failed' },
        pinecone: { status: 'unhealthy', error: 'Connection failed' },
        unified: {
          initialized: this.isInitialized,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
  }

  // Cleanup operations
  async clearOldData(olderThanDays: number): Promise<void> {
    try {
      // Clear old data from MongoDB
      await this.mongoStore.clearOldData(olderThanDays);
      
      // Clear old vectors from Pinecone (by date filter)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      await this.pineconeStore.deleteEmbeddingsByFilter({
        // Note: This requires timestamp to be in metadata
        // Implementation depends on Pinecone's filtering capabilities
      });
      
      this.logger.info('Old data cleanup completed', { olderThanDays });
    } catch (error) {
      this.logger.error('Failed to clear old data', error as Error);
      throw error;
    }
  }

  // Helper methods
  private generateEntityContent(entity: Entity): string {
    const parts = [
      `Entity: ${entity.name}`,
      `Type: ${entity.type}`,
      `Properties: ${JSON.stringify(entity.properties)}`,
      `Source: ${entity.sourceUrl}`,
      `Confidence: ${entity.confidence}`
    ];
    
    return parts.join('\n');
  }

  private generateRelationshipContent(relationship: Relationship): string {
    const parts = [
      `Relationship: ${relationship.type}`,
      `Source: ${relationship.source}`,
      `Target: ${relationship.target}`,
      `Properties: ${JSON.stringify(relationship.properties)}`,
      `Confidence: ${relationship.confidence}`
    ];
    
    return parts.join('\n');
  }

  private generatePageContent(scrapedData: ScrapedData): string {
    const parts = [
      `Page: ${scrapedData.url}`,
      `Domain: ${scrapedData.domain}`,
      `Goal: ${scrapedData.goal}`,
      `Extracted Data: ${JSON.stringify(scrapedData.extractedData)}`,
      `Confidence: ${scrapedData.confidence}`
    ];
    
    return parts.join('\n');
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  private extractEntitiesFromScrapedData(scrapedData: ScrapedData): Entity[] {
    const entities: Entity[] = [];
    const baseId = `${scrapedData.domain}_${Date.now()}`;
    
    for (const [key, value] of Object.entries(scrapedData.extractedData)) {
      if (value && typeof value === 'object' && value.text) {
        entities.push({
          id: `${baseId}_${key}_${entities.length}`,
          type: this.inferEntityType(key, value.text, scrapedData.goal),
          name: value.text.substring(0, 100),
          properties: {
            originalKey: key,
            selector: value.selector,
            href: value.href,
            src: value.src,
            value: value.value,
            goal: scrapedData.goal,
            domain: scrapedData.domain,
            sessionId: scrapedData.sessionId
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
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
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
              goal: scrapedData.goal,
              sessionId: scrapedData.sessionId
            },
            confidence: scrapedData.confidence * 0.8,
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
    
    for (const entity of entities) {
      facts.push({
        id: `fact_${entity.id}_extracted`,
        subject: entity.id,
        predicate: 'extracted_from',
        object: scrapedData.url,
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
    
    if (keyLower.includes('price') || textLower.match(/\$\d+|\d+\.\d+/)) {
      return 'price';
    }
    
    if (keyLower.includes('product') || keyLower.includes('item') || keyLower.includes('title')) {
      return 'product';
    }
    
    if (keyLower.includes('vendor') || keyLower.includes('seller') || keyLower.includes('brand')) {
      return 'vendor';
    }
    
    if (keyLower.includes('category') || keyLower.includes('section')) {
      return 'category';
    }
    
    if (keyLower.includes('date') || keyLower.includes('time')) {
      return 'date';
    }
    
    if (keyLower.includes('location') || keyLower.includes('address')) {
      return 'location';
    }
    
    if (keyLower.includes('stock') || keyLower.includes('available')) {
      return 'availability';
    }
    
    return 'product';
  }

  private inferRelationshipType(type1: Entity['type'], type2: Entity['type']): Relationship['type'] | null {
    if ((type1 === 'product' && type2 === 'price') || (type1 === 'price' && type2 === 'product')) {
      return 'PRICED_AT';
    }
    
    if ((type1 === 'product' && type2 === 'vendor') || (type1 === 'vendor' && type2 === 'product')) {
      return 'SOLD_BY';
    }
    
    if ((type1 === 'product' && type2 === 'category') || (type1 === 'category' && type2 === 'product')) {
      return 'CATEGORY_OF';
    }
    
    if ((type1 === 'product' && type2 === 'location') || (type1 === 'location' && type2 === 'product')) {
      return 'LOCATED_IN';
    }
    
    if ((type1 === 'product' && type2 === 'availability') || (type1 === 'availability' && type2 === 'product')) {
      return 'AVAILABLE_AT';
    }
    
    return null;
  }

  private generateScrapingRecommendations(
    entities: MongoEntity[],
    patterns: SimilaritySearchResult[],
    ragContext: RAGContext
  ): string[] {
    const recommendations: string[] = [];
    
    if (entities.length === 0) {
      recommendations.push('First time scraping this domain');
      recommendations.push('Focus on extracting primary content elements');
    } else {
      recommendations.push(`Found ${entities.length} related entities from previous scrapes`);
    }
    
    if (patterns.length > 0) {
      recommendations.push(`Found ${patterns.length} similar scraping patterns`);
      recommendations.push(`Average pattern confidence: ${patterns.reduce((sum, p) => sum + p.score, 0) / patterns.length}`);
    }
    
    if (ragContext.confidence > 0.7) {
      recommendations.push('High confidence RAG context available for autonomous planning');
    }
    
    return recommendations;
  }
}