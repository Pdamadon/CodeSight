// MongoDBStore.ts - MongoDB storage layer for entities, relationships, and facts

import { MongoClient, Db, Collection, CreateIndexesOptions } from 'mongodb';
import { Entity, Relationship, Fact } from '../knowledge/EntityStore.js';
import { ChangeEvent, Inconsistency } from '../knowledge/ChangeLog.js';
import { Logger } from '../monitoring/Logger.js';

export interface MongoEntity extends Entity {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoRelationship extends Relationship {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoFact extends Fact {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoChangeEvent extends ChangeEvent {
  _id?: string;
  createdAt: Date;
}

export interface MongoInconsistency extends Inconsistency {
  _id?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapingSession {
  _id?: string;
  sessionId: string;
  url: string;
  domain: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  entitiesExtracted: number;
  relationshipsCreated: number;
  factsCreated: number;
  confidence: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoDBStore {
  private client: MongoClient;
  private db: Db;
  private logger: Logger;
  private isConnected: boolean = false;

  // Collections
  private entities: Collection<MongoEntity>;
  private relationships: Collection<MongoRelationship>;
  private facts: Collection<MongoFact>;
  private changeEvents: Collection<MongoChangeEvent>;
  private inconsistencies: Collection<MongoInconsistency>;
  private scrapingSessions: Collection<ScrapingSession>;

  constructor(connectionString: string, databaseName: string = 'codesight') {
    this.client = new MongoClient(connectionString);
    this.db = this.client.db(databaseName);
    this.logger = Logger.getInstance();

    // Initialize collections
    this.entities = this.db.collection<MongoEntity>('entities');
    this.relationships = this.db.collection<MongoRelationship>('relationships');
    this.facts = this.db.collection<MongoFact>('facts');
    this.changeEvents = this.db.collection<MongoChangeEvent>('change_events');
    this.inconsistencies = this.db.collection<MongoInconsistency>('inconsistencies');
    this.scrapingSessions = this.db.collection<ScrapingSession>('scraping_sessions');
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      this.logger.info('Connected to MongoDB');
      
      // Create indexes for performance
      await this.createIndexes();
      
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      this.logger.info('Disconnected from MongoDB');
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // Entity indexes
      await this.entities.createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { type: 1 } },
        { key: { name: 1 } },
        { key: { sourceUrl: 1 } },
        { key: { extractedAt: 1 } },
        { key: { 'properties.domain': 1 } },
        { key: { 'properties.goal': 1 } },
        { key: { confidence: 1 } },
        { key: { createdAt: 1 } },
        { key: { updatedAt: 1 } }
      ]);

      // Relationship indexes
      await this.relationships.createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { type: 1 } },
        { key: { source: 1 } },
        { key: { target: 1 } },
        { key: { source: 1, target: 1 } },
        { key: { sourceUrl: 1 } },
        { key: { extractedAt: 1 } },
        { key: { confidence: 1 } },
        { key: { createdAt: 1 } }
      ]);

      // Fact indexes
      await this.facts.createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { subject: 1 } },
        { key: { predicate: 1 } },
        { key: { object: 1 } },
        { key: { subject: 1, predicate: 1 } },
        { key: { sourceUrl: 1 } },
        { key: { extractedAt: 1 } },
        { key: { confidence: 1 } },
        { key: { createdAt: 1 } }
      ]);

      // Change event indexes
      await this.changeEvents.createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { type: 1 } },
        { key: { timestamp: 1 } },
        { key: { sourceUrl: 1 } },
        { key: { entityId: 1 } },
        { key: { relationshipId: 1 } },
        { key: { factId: 1 } },
        { key: { sessionId: 1 } },
        { key: { createdAt: 1 } }
      ]);

      // Scraping session indexes
      await this.scrapingSessions.createIndexes([
        { key: { sessionId: 1 }, unique: true },
        { key: { url: 1 } },
        { key: { domain: 1 } },
        { key: { goal: 1 } },
        { key: { status: 1 } },
        { key: { startTime: 1 } },
        { key: { confidence: 1 } },
        { key: { createdAt: 1 } }
      ]);

      // Inconsistency indexes
      await this.inconsistencies.createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { type: 1 } },
        { key: { severity: 1 } },
        { key: { resolved: 1 } },
        { key: { detectedAt: 1 } },
        { key: { createdAt: 1 } }
      ]);

      this.logger.info('MongoDB indexes created successfully');
    } catch (error) {
      this.logger.error('Failed to create MongoDB indexes', error as Error);
      throw error;
    }
  }

  // Entity operations
  async addEntity(entity: Entity): Promise<MongoEntity> {
    const now = new Date();
    const mongoEntity: MongoEntity = {
      ...entity,
      createdAt: now,
      updatedAt: now
    };

    try {
      // Try to update existing entity first
      const result = await this.entities.findOneAndUpdate(
        { id: entity.id },
        { 
          $set: { 
            ...mongoEntity, 
            updatedAt: now 
          } 
        },
        { 
          upsert: true, 
          returnDocument: 'after' 
        }
      );

      return result || mongoEntity;
    } catch (error) {
      this.logger.error('Failed to add entity', error as Error, { entityId: entity.id });
      throw error;
    }
  }

  async getEntity(id: string): Promise<MongoEntity | null> {
    try {
      return await this.entities.findOne({ id });
    } catch (error) {
      this.logger.error('Failed to get entity', error as Error, { entityId: id });
      throw error;
    }
  }

  async getEntitiesByType(type: Entity['type']): Promise<MongoEntity[]> {
    try {
      return await this.entities.find({ type }).toArray();
    } catch (error) {
      this.logger.error('Failed to get entities by type', error as Error, { type });
      throw error;
    }
  }

  async getEntitiesByDomain(domain: string): Promise<MongoEntity[]> {
    try {
      return await this.entities.find({ 'properties.domain': domain }).toArray();
    } catch (error) {
      this.logger.error('Failed to get entities by domain', error as Error, { domain });
      throw error;
    }
  }

  async getEntitiesByGoal(goal: string): Promise<MongoEntity[]> {
    try {
      return await this.entities.find({ 'properties.goal': goal }).toArray();
    } catch (error) {
      this.logger.error('Failed to get entities by goal', error as Error, { goal });
      throw error;
    }
  }

  async searchEntities(query: {
    type?: Entity['type'];
    name?: string;
    domain?: string;
    goal?: string;
    sourceUrl?: string;
    confidenceMin?: number;
    dateRange?: { from: Date; to: Date };
    limit?: number;
    skip?: number;
  }): Promise<MongoEntity[]> {
    try {
      const filter: any = {};
      
      if (query.type) filter.type = query.type;
      if (query.name) filter.name = { $regex: query.name, $options: 'i' };
      if (query.domain) filter['properties.domain'] = query.domain;
      if (query.goal) filter['properties.goal'] = query.goal;
      if (query.sourceUrl) filter.sourceUrl = query.sourceUrl;
      if (query.confidenceMin) filter.confidence = { $gte: query.confidenceMin };
      
      if (query.dateRange) {
        filter.extractedAt = {
          $gte: query.dateRange.from.getTime(),
          $lte: query.dateRange.to.getTime()
        };
      }

      let cursor = this.entities.find(filter);
      
      if (query.skip) cursor = cursor.skip(query.skip);
      if (query.limit) cursor = cursor.limit(query.limit);
      
      return await cursor.toArray();
    } catch (error) {
      this.logger.error('Failed to search entities', error as Error, { query });
      throw error;
    }
  }

  // Relationship operations
  async addRelationship(relationship: Relationship): Promise<MongoRelationship> {
    const now = new Date();
    const mongoRelationship: MongoRelationship = {
      ...relationship,
      createdAt: now,
      updatedAt: now
    };

    try {
      const result = await this.relationships.findOneAndUpdate(
        { id: relationship.id },
        { 
          $set: { 
            ...mongoRelationship, 
            updatedAt: now 
          } 
        },
        { 
          upsert: true, 
          returnDocument: 'after' 
        }
      );

      return result || mongoRelationship;
    } catch (error) {
      this.logger.error('Failed to add relationship', error as Error, { relationshipId: relationship.id });
      throw error;
    }
  }

  async getRelationshipsBySource(sourceId: string): Promise<MongoRelationship[]> {
    try {
      return await this.relationships.find({ source: sourceId }).toArray();
    } catch (error) {
      this.logger.error('Failed to get relationships by source', error as Error, { sourceId });
      throw error;
    }
  }

  async getRelationshipsByTarget(targetId: string): Promise<MongoRelationship[]> {
    try {
      return await this.relationships.find({ target: targetId }).toArray();
    } catch (error) {
      this.logger.error('Failed to get relationships by target', error as Error, { targetId });
      throw error;
    }
  }

  async getRelationshipsForEntity(entityId: string): Promise<MongoRelationship[]> {
    try {
      return await this.relationships.find({
        $or: [
          { source: entityId },
          { target: entityId }
        ]
      }).toArray();
    } catch (error) {
      this.logger.error('Failed to get relationships for entity', error as Error, { entityId });
      throw error;
    }
  }

  // Fact operations
  async addFact(fact: Fact): Promise<MongoFact> {
    const now = new Date();
    const mongoFact: MongoFact = {
      ...fact,
      createdAt: now,
      updatedAt: now
    };

    try {
      const result = await this.facts.findOneAndUpdate(
        { id: fact.id },
        { 
          $set: { 
            ...mongoFact, 
            updatedAt: now 
          } 
        },
        { 
          upsert: true, 
          returnDocument: 'after' 
        }
      );

      return result || mongoFact;
    } catch (error) {
      this.logger.error('Failed to add fact', error as Error, { factId: fact.id });
      throw error;
    }
  }

  async getFactsBySubject(subject: string): Promise<MongoFact[]> {
    try {
      return await this.facts.find({ subject }).toArray();
    } catch (error) {
      this.logger.error('Failed to get facts by subject', error as Error, { subject });
      throw error;
    }
  }

  async getFactsByPredicate(predicate: string): Promise<MongoFact[]> {
    try {
      return await this.facts.find({ predicate }).toArray();
    } catch (error) {
      this.logger.error('Failed to get facts by predicate', error as Error, { predicate });
      throw error;
    }
  }

  // Change event operations
  async addChangeEvent(event: ChangeEvent): Promise<MongoChangeEvent> {
    const mongoEvent: MongoChangeEvent = {
      ...event,
      createdAt: new Date()
    };

    try {
      const result = await this.changeEvents.insertOne(mongoEvent);
      return { ...mongoEvent, _id: result.insertedId.toString() };
    } catch (error) {
      this.logger.error('Failed to add change event', error as Error, { eventId: event.id });
      throw error;
    }
  }

  async getChangeEvents(filter?: {
    type?: ChangeEvent['type'];
    entityId?: string;
    sourceUrl?: string;
    sessionId?: string;
    timeRange?: { from: Date; to: Date };
    limit?: number;
  }): Promise<MongoChangeEvent[]> {
    try {
      const query: any = {};
      
      if (filter?.type) query.type = filter.type;
      if (filter?.entityId) query.entityId = filter.entityId;
      if (filter?.sourceUrl) query.sourceUrl = filter.sourceUrl;
      if (filter?.sessionId) query.sessionId = filter.sessionId;
      
      if (filter?.timeRange) {
        query.timestamp = {
          $gte: filter.timeRange.from.getTime(),
          $lte: filter.timeRange.to.getTime()
        };
      }

      let cursor = this.changeEvents.find(query).sort({ timestamp: -1 });
      
      if (filter?.limit) cursor = cursor.limit(filter.limit);
      
      return await cursor.toArray();
    } catch (error) {
      this.logger.error('Failed to get change events', error as Error, { filter });
      throw error;
    }
  }

  // Scraping session operations
  async createScrapingSession(session: Omit<ScrapingSession, '_id' | 'createdAt' | 'updatedAt'>): Promise<ScrapingSession> {
    const now = new Date();
    const mongoSession: ScrapingSession = {
      ...session,
      createdAt: now,
      updatedAt: now
    };

    try {
      const result = await this.scrapingSessions.insertOne(mongoSession);
      return { ...mongoSession, _id: result.insertedId.toString() };
    } catch (error) {
      this.logger.error('Failed to create scraping session', error as Error, { sessionId: session.sessionId });
      throw error;
    }
  }

  async updateScrapingSession(sessionId: string, updates: Partial<ScrapingSession>): Promise<ScrapingSession | null> {
    try {
      const result = await this.scrapingSessions.findOneAndUpdate(
        { sessionId },
        { 
          $set: { 
            ...updates, 
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      );

      return result;
    } catch (error) {
      this.logger.error('Failed to update scraping session', error as Error, { sessionId });
      throw error;
    }
  }

  async getScrapingSession(sessionId: string): Promise<ScrapingSession | null> {
    try {
      return await this.scrapingSessions.findOne({ sessionId });
    } catch (error) {
      this.logger.error('Failed to get scraping session', error as Error, { sessionId });
      throw error;
    }
  }

  async getScrapingSessionsByDomain(domain: string): Promise<ScrapingSession[]> {
    try {
      return await this.scrapingSessions.find({ domain }).sort({ createdAt: -1 }).toArray();
    } catch (error) {
      this.logger.error('Failed to get scraping sessions by domain', error as Error, { domain });
      throw error;
    }
  }

  // Analytics and statistics
  async getStatistics(): Promise<{
    totalEntities: number;
    totalRelationships: number;
    totalFacts: number;
    totalSessions: number;
    entitiesByType: Record<string, number>;
    relationshipsByType: Record<string, number>;
    sessionsByDomain: Record<string, number>;
    averageConfidence: number;
  }> {
    try {
      const [
        totalEntities,
        totalRelationships,
        totalFacts,
        totalSessions,
        entitiesByType,
        relationshipsByType,
        sessionsByDomain,
        avgConfidence
      ] = await Promise.all([
        this.entities.countDocuments(),
        this.relationships.countDocuments(),
        this.facts.countDocuments(),
        this.scrapingSessions.countDocuments(),
        this.entities.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]).toArray(),
        this.relationships.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]).toArray(),
        this.scrapingSessions.aggregate([
          { $group: { _id: '$domain', count: { $sum: 1 } } }
        ]).toArray(),
        this.entities.aggregate([
          { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
        ]).toArray()
      ]);

      return {
        totalEntities,
        totalRelationships,
        totalFacts,
        totalSessions,
        entitiesByType: Object.fromEntries(entitiesByType.map(item => [item._id, item.count])),
        relationshipsByType: Object.fromEntries(relationshipsByType.map(item => [item._id, item.count])),
        sessionsByDomain: Object.fromEntries(sessionsByDomain.map(item => [item._id, item.count])),
        averageConfidence: avgConfidence[0]?.avgConfidence || 0
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', error as Error);
      throw error;
    }
  }

  // Cleanup operations
  async clearOldData(olderThanDays: number): Promise<{
    entitiesDeleted: number;
    relationshipsDeleted: number;
    factsDeleted: number;
    eventsDeleted: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffTimestamp = cutoffDate.getTime();

    try {
      const [entitiesResult, relationshipsResult, factsResult, eventsResult] = await Promise.all([
        this.entities.deleteMany({ extractedAt: { $lt: cutoffTimestamp } }),
        this.relationships.deleteMany({ extractedAt: { $lt: cutoffTimestamp } }),
        this.facts.deleteMany({ extractedAt: { $lt: cutoffTimestamp } }),
        this.changeEvents.deleteMany({ timestamp: { $lt: cutoffTimestamp } })
      ]);

      const result = {
        entitiesDeleted: entitiesResult.deletedCount || 0,
        relationshipsDeleted: relationshipsResult.deletedCount || 0,
        factsDeleted: factsResult.deletedCount || 0,
        eventsDeleted: eventsResult.deletedCount || 0
      };

      this.logger.info('Old data cleanup completed', result);
      return result;
    } catch (error) {
      this.logger.error('Failed to clear old data', error as Error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const adminDb = this.db.admin();
      const result = await adminDb.ping();
      
      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          ping: result,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: this.isConnected,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
  }
}