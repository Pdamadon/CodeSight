// PineconeStore.ts - Pinecone vector store for semantic search and RAG

import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { Logger } from '../monitoring/Logger.js';

export interface VectorDocument {
  id: string;
  values: number[];
  metadata: {
    type: 'entity' | 'relationship' | 'fact' | 'page_content' | 'scraping_pattern';
    entityId?: string;
    relationshipId?: string;
    factId?: string;
    url?: string;
    domain?: string;
    goal?: string;
    content: string;
    timestamp: number;
    confidence: number;
    sessionId?: string;
    [key: string]: any;
  };
}

export interface SimilaritySearchResult {
  id: string;
  score: number;
  metadata: VectorDocument['metadata'];
}

export interface RAGContext {
  query: string;
  results: SimilaritySearchResult[];
  context: string;
  confidence: number;
}

export class PineconeStore {
  private pinecone: Pinecone;
  private openai: OpenAI;
  private logger: Logger;
  private indexName: string;
  private dimension: number = 1536; // OpenAI ada-002 embedding dimension
  private isInitialized: boolean = false;

  constructor(
    apiKey: string,
    openaiApiKey: string,
    indexName: string = 'codesight-vectors',
    environment: string = 'us-east-1-aws'
  ) {
    this.pinecone = new Pinecone({
      apiKey: apiKey
    });
    
    this.openai = new OpenAI({
      apiKey: openaiApiKey
    });
    
    this.logger = Logger.getInstance();
    this.indexName = indexName;
  }

  async initialize(): Promise<void> {
    try {
      // Check if index exists
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        this.logger.info('Creating Pinecone index', { indexName: this.indexName });
        
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await this.waitForIndexReady();
      }

      this.isInitialized = true;
      this.logger.info('Pinecone store initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Pinecone store', error as Error);
      throw error;
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 2000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const indexStats = await this.pinecone.index(this.indexName).describeIndexStats();
        if (indexStats) {
          this.logger.info('Pinecone index is ready');
          return;
        }
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw new Error(`Index not ready after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000) // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error as Error, { textLength: text.length });
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // Process in batches to avoid API limits
      const batchSize = 100;
      const embeddings: number[][] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: batch.map(text => text.substring(0, 8000))
        });
        
        embeddings.push(...response.data.map(item => item.embedding));
      }

      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate batch embeddings', error as Error, { textsCount: texts.length });
      throw error;
    }
  }

  async upsertEntityEmbedding(
    entityId: string,
    content: string,
    metadata: Omit<VectorDocument['metadata'], 'type' | 'content'>
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);
      
      const vector: VectorDocument = {
        id: `entity_${entityId}`,
        values: embedding,
        metadata: {
          type: 'entity',
          entityId,
          content,
          timestamp: Date.now(),
          confidence: 0.8,
          ...metadata
        }
      };

      await this.pinecone.index(this.indexName).upsert([vector]);
      
      this.logger.debug('Entity embedding upserted', { entityId, contentLength: content.length });
    } catch (error) {
      this.logger.error('Failed to upsert entity embedding', error as Error, { entityId });
      throw error;
    }
  }

  async upsertRelationshipEmbedding(
    relationshipId: string,
    content: string,
    metadata: Omit<VectorDocument['metadata'], 'type' | 'content'>
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);
      
      const vector: VectorDocument = {
        id: `relationship_${relationshipId}`,
        values: embedding,
        metadata: {
          type: 'relationship',
          relationshipId,
          content,
          timestamp: Date.now(),
          confidence: 0.8,
          ...metadata
        }
      };

      await this.pinecone.index(this.indexName).upsert([vector]);
      
      this.logger.debug('Relationship embedding upserted', { relationshipId, contentLength: content.length });
    } catch (error) {
      this.logger.error('Failed to upsert relationship embedding', error as Error, { relationshipId });
      throw error;
    }
  }

  async upsertPageContentEmbedding(
    url: string,
    content: string,
    metadata: Omit<VectorDocument['metadata'], 'type' | 'content'>
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);
      
      const vector: VectorDocument = {
        id: `page_${Buffer.from(url).toString('base64')}`,
        values: embedding,
        metadata: {
          type: 'page_content',
          url,
          content,
          timestamp: Date.now(),
          confidence: 0.8,
          ...metadata
        }
      };

      await this.pinecone.index(this.indexName).upsert([vector]);
      
      this.logger.debug('Page content embedding upserted', { url, contentLength: content.length });
    } catch (error) {
      this.logger.error('Failed to upsert page content embedding', error as Error, { url });
      throw error;
    }
  }

  async upsertScrapingPatternEmbedding(
    patternId: string,
    content: string,
    metadata: Omit<VectorDocument['metadata'], 'type' | 'content'>
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);
      
      const vector: VectorDocument = {
        id: `pattern_${patternId}`,
        values: embedding,
        metadata: {
          type: 'scraping_pattern',
          content,
          timestamp: Date.now(),
          confidence: 0.8,
          ...metadata
        }
      };

      await this.pinecone.index(this.indexName).upsert([vector]);
      
      this.logger.debug('Scraping pattern embedding upserted', { patternId, contentLength: content.length });
    } catch (error) {
      this.logger.error('Failed to upsert scraping pattern embedding', error as Error, { patternId });
      throw error;
    }
  }

  async batchUpsertEmbeddings(vectors: VectorDocument[]): Promise<void> {
    try {
      // Upsert in batches to avoid API limits
      const batchSize = 100;
      
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.pinecone.index(this.indexName).upsert(batch);
      }

      this.logger.info('Batch embeddings upserted', { count: vectors.length });
    } catch (error) {
      this.logger.error('Failed to batch upsert embeddings', error as Error, { vectorsCount: vectors.length });
      throw error;
    }
  }

  async similaritySearch(
    query: string,
    options: {
      type?: VectorDocument['metadata']['type'];
      domain?: string;
      goal?: string;
      topK?: number;
      scoreThreshold?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<SimilaritySearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const filter: any = {};
      if (options.type) filter.type = options.type;
      if (options.domain) filter.domain = options.domain;
      if (options.goal) filter.goal = options.goal;

      const searchResponse = await this.pinecone.index(this.indexName).query({
        vector: queryEmbedding,
        topK: options.topK || 10,
        includeMetadata: options.includeMetadata !== false,
        filter: Object.keys(filter).length > 0 ? filter : undefined
      });

      const results: SimilaritySearchResult[] = searchResponse.matches
        ?.filter(match => (match.score || 0) >= (options.scoreThreshold || 0.7))
        .map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as VectorDocument['metadata']
        })) || [];

      this.logger.debug('Similarity search completed', { 
        query: query.substring(0, 100),
        resultsCount: results.length,
        topScore: results[0]?.score || 0
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to perform similarity search', error as Error, { query: query.substring(0, 100) });
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
  ): Promise<SimilaritySearchResult[]> {
    try {
      // Get the entity's embedding
      const entityVector = await this.pinecone.index(this.indexName).fetch([`entity_${entityId}`]);
      const entityEmbedding = entityVector.records[`entity_${entityId}`]?.values;
      
      if (!entityEmbedding) {
        throw new Error(`Entity embedding not found: ${entityId}`);
      }

      const filter: any = { type: 'entity' };
      if (options.domain) filter.domain = options.domain;
      if (options.goal) filter.goal = options.goal;

      const searchResponse = await this.pinecone.index(this.indexName).query({
        vector: entityEmbedding,
        topK: (options.topK || 10) + 1, // +1 to account for the entity itself
        includeMetadata: true,
        filter
      });

      const results: SimilaritySearchResult[] = searchResponse.matches
        ?.filter(match => 
          match.id !== `entity_${entityId}` && // Exclude the entity itself
          (match.score || 0) >= (options.scoreThreshold || 0.7)
        )
        .map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as VectorDocument['metadata']
        })) || [];

      return results;
    } catch (error) {
      this.logger.error('Failed to find similar entities', error as Error, { entityId });
      throw error;
    }
  }

  async generateRAGContext(
    query: string,
    options: {
      type?: VectorDocument['metadata']['type'];
      domain?: string;
      goal?: string;
      maxResults?: number;
      scoreThreshold?: number;
    } = {}
  ): Promise<RAGContext> {
    try {
      const results = await this.similaritySearch(query, {
        ...options,
        topK: options.maxResults || 5
      });

      // Build context from search results
      const contextParts = results.map(result => {
        const { content, type, domain, goal } = result.metadata;
        return `[${type}] ${content} (domain: ${domain}, goal: ${goal}, score: ${result.score.toFixed(2)})`;
      });

      const context = contextParts.join('\n\n');
      const avgConfidence = results.length > 0 
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
        : 0;

      return {
        query,
        results,
        context,
        confidence: avgConfidence
      };
    } catch (error) {
      this.logger.error('Failed to generate RAG context', error as Error, { query: query.substring(0, 100) });
      throw error;
    }
  }

  async getScrapingPatterns(
    domain: string,
    goal: string,
    options: {
      topK?: number;
      scoreThreshold?: number;
    } = {}
  ): Promise<SimilaritySearchResult[]> {
    try {
      const query = `scraping patterns for ${goal} on ${domain}`;
      
      return await this.similaritySearch(query, {
        type: 'scraping_pattern',
        domain,
        goal,
        topK: options.topK || 5,
        scoreThreshold: options.scoreThreshold || 0.6
      });
    } catch (error) {
      this.logger.error('Failed to get scraping patterns', error as Error, { domain, goal });
      throw error;
    }
  }

  async deleteEmbedding(id: string): Promise<void> {
    try {
      await this.pinecone.index(this.indexName).deleteOne(id);
      this.logger.debug('Embedding deleted', { id });
    } catch (error) {
      this.logger.error('Failed to delete embedding', error as Error, { id });
      throw error;
    }
  }

  async deleteEmbeddingsByFilter(filter: {
    type?: VectorDocument['metadata']['type'];
    domain?: string;
    goal?: string;
    sessionId?: string;
  }): Promise<void> {
    try {
      await this.pinecone.index(this.indexName).deleteMany(filter);
      this.logger.info('Embeddings deleted by filter', { filter });
    } catch (error) {
      this.logger.error('Failed to delete embeddings by filter', error as Error, { filter });
      throw error;
    }
  }

  async getIndexStats(): Promise<{
    totalVectors: number;
    dimension: number;
    indexFullness: number;
    namespaces: Record<string, { vectorCount: number }>;
  }> {
    try {
      const stats = await this.pinecone.index(this.indexName).describeIndexStats();
      
      return {
        totalVectors: stats.totalRecordCount || 0,
        dimension: stats.dimension || 0,
        indexFullness: stats.indexFullness || 0,
        namespaces: Object.fromEntries(
          Object.entries(stats.namespaces || {}).map(([key, value]) => [
            key, 
            { vectorCount: value.recordCount || 0 }
          ])
        )
      };
    } catch (error) {
      this.logger.error('Failed to get index stats', error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const stats = await this.getIndexStats();
      
      return {
        status: 'healthy',
        details: {
          initialized: this.isInitialized,
          indexName: this.indexName,
          totalVectors: stats.totalVectors,
          dimension: stats.dimension,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          initialized: this.isInitialized,
          indexName: this.indexName,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
  }

  async clearAllVectors(): Promise<void> {
    try {
      await this.pinecone.index(this.indexName).deleteAll();
      this.logger.info('All vectors cleared from index');
    } catch (error) {
      this.logger.error('Failed to clear all vectors', error as Error);
      throw error;
    }
  }
}