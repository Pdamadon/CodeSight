// EntityStore.ts - Pure storage and indexing for entities and relationships

export interface Entity {
  id: string;
  type: 'product' | 'vendor' | 'price' | 'location' | 'date' | 'availability' | 'category';
  name: string;
  properties: Record<string, any>;
  confidence: number;
  sourceUrl: string;
  extractedAt: number;
  lastUpdated: number;
}

export interface Relationship {
  id: string;
  type: 'SOLD_BY' | 'PRICED_AT' | 'LOCATED_IN' | 'CATEGORY_OF' | 'AVAILABLE_AT' | 'CHANGED_FROM' | 'SIMILAR_TO';
  source: string; // Entity ID
  target: string; // Entity ID
  properties: Record<string, any>;
  confidence: number;
  sourceUrl: string;
  extractedAt: number;
  validFrom?: number;
  validTo?: number;
}

export interface Fact {
  id: string;
  subject: string; // Entity ID
  predicate: string; // Relationship type
  object: string; // Entity ID or value
  confidence: number;
  sourceUrl: string;
  extractedAt: number;
  validFrom?: number;
  validTo?: number;
}

export interface EntityIndex {
  byType: Map<Entity['type'], Set<string>>;
  byName: Map<string, Set<string>>;
  bySource: Map<string, Set<string>>;
  byTimeRange: Map<string, Set<string>>; // date bucket -> entity IDs
}

export interface RelationshipIndex {
  byType: Map<Relationship['type'], Set<string>>;
  bySource: Map<string, Set<string>>;
  byTarget: Map<string, Set<string>>;
  byTimeRange: Map<string, Set<string>>;
}

export interface FactIndex {
  bySubject: Map<string, Set<string>>;
  byPredicate: Map<string, Set<string>>;
  byObject: Map<string, Set<string>>;
  byTimeRange: Map<string, Set<string>>;
}

export class EntityStore {
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private facts: Map<string, Fact> = new Map();
  
  private entityIndex: EntityIndex;
  private relationshipIndex: RelationshipIndex;
  private factIndex: FactIndex;

  constructor() {
    this.entityIndex = this.initializeEntityIndex();
    this.relationshipIndex = this.initializeRelationshipIndex();
    this.factIndex = this.initializeFactIndex();
  }

  private initializeEntityIndex(): EntityIndex {
    const entityTypes: Entity['type'][] = ['product', 'vendor', 'price', 'location', 'date', 'availability', 'category'];
    const byType = new Map<Entity['type'], Set<string>>();
    entityTypes.forEach(type => byType.set(type, new Set()));

    return {
      byType,
      byName: new Map(),
      bySource: new Map(),
      byTimeRange: new Map()
    };
  }

  private initializeRelationshipIndex(): RelationshipIndex {
    const relationshipTypes: Relationship['type'][] = ['SOLD_BY', 'PRICED_AT', 'LOCATED_IN', 'CATEGORY_OF', 'AVAILABLE_AT', 'CHANGED_FROM', 'SIMILAR_TO'];
    const byType = new Map<Relationship['type'], Set<string>>();
    relationshipTypes.forEach(type => byType.set(type, new Set()));

    return {
      byType,
      bySource: new Map(),
      byTarget: new Map(),
      byTimeRange: new Map()
    };
  }

  private initializeFactIndex(): FactIndex {
    return {
      bySubject: new Map(),
      byPredicate: new Map(),
      byObject: new Map(),
      byTimeRange: new Map()
    };
  }

  // Entity operations
  addEntity(entity: Entity): Entity | null {
    const existingEntity = this.entities.get(entity.id);
    
    // Remove old indexes if updating
    if (existingEntity) {
      this.removeEntityFromIndexes(existingEntity);
    }
    
    // Add/update entity
    this.entities.set(entity.id, entity);
    this.addEntityToIndexes(entity);
    
    return existingEntity || null;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;
    
    this.removeEntityFromIndexes(entity);
    this.entities.delete(id);
    return true;
  }

  getEntitiesByType(type: Entity['type']): Entity[] {
    const entityIds = this.entityIndex.byType.get(type) || new Set();
    return Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter((entity): entity is Entity => entity !== undefined);
  }

  getEntitiesByName(name: string): Entity[] {
    const entityIds = this.entityIndex.byName.get(name.toLowerCase()) || new Set();
    return Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter((entity): entity is Entity => entity !== undefined);
  }

  getEntitiesBySource(sourceUrl: string): Entity[] {
    const entityIds = this.entityIndex.bySource.get(sourceUrl) || new Set();
    return Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter((entity): entity is Entity => entity !== undefined);
  }

  private addEntityToIndexes(entity: Entity): void {
    // Type index
    this.entityIndex.byType.get(entity.type)?.add(entity.id);
    
    // Name index
    const nameKey = entity.name.toLowerCase();
    if (!this.entityIndex.byName.has(nameKey)) {
      this.entityIndex.byName.set(nameKey, new Set());
    }
    this.entityIndex.byName.get(nameKey)!.add(entity.id);
    
    // Source index
    if (!this.entityIndex.bySource.has(entity.sourceUrl)) {
      this.entityIndex.bySource.set(entity.sourceUrl, new Set());
    }
    this.entityIndex.bySource.get(entity.sourceUrl)!.add(entity.id);
    
    // Time range index (bucket by day)
    const timeKey = this.getTimeBucket(entity.extractedAt);
    if (!this.entityIndex.byTimeRange.has(timeKey)) {
      this.entityIndex.byTimeRange.set(timeKey, new Set());
    }
    this.entityIndex.byTimeRange.get(timeKey)!.add(entity.id);
  }

  private removeEntityFromIndexes(entity: Entity): void {
    // Type index
    this.entityIndex.byType.get(entity.type)?.delete(entity.id);
    
    // Name index
    const nameKey = entity.name.toLowerCase();
    this.entityIndex.byName.get(nameKey)?.delete(entity.id);
    if (this.entityIndex.byName.get(nameKey)?.size === 0) {
      this.entityIndex.byName.delete(nameKey);
    }
    
    // Source index
    this.entityIndex.bySource.get(entity.sourceUrl)?.delete(entity.id);
    if (this.entityIndex.bySource.get(entity.sourceUrl)?.size === 0) {
      this.entityIndex.bySource.delete(entity.sourceUrl);
    }
    
    // Time range index
    const timeKey = this.getTimeBucket(entity.extractedAt);
    this.entityIndex.byTimeRange.get(timeKey)?.delete(entity.id);
    if (this.entityIndex.byTimeRange.get(timeKey)?.size === 0) {
      this.entityIndex.byTimeRange.delete(timeKey);
    }
  }

  // Relationship operations
  addRelationship(relationship: Relationship): Relationship | null {
    const existingRelationship = this.relationships.get(relationship.id);
    
    // Remove old indexes if updating
    if (existingRelationship) {
      this.removeRelationshipFromIndexes(existingRelationship);
    }
    
    // Add/update relationship
    this.relationships.set(relationship.id, relationship);
    this.addRelationshipToIndexes(relationship);
    
    return existingRelationship || null;
  }

  getRelationship(id: string): Relationship | undefined {
    return this.relationships.get(id);
  }

  removeRelationship(id: string): boolean {
    const relationship = this.relationships.get(id);
    if (!relationship) return false;
    
    this.removeRelationshipFromIndexes(relationship);
    this.relationships.delete(id);
    return true;
  }

  getRelationshipsByType(type: Relationship['type']): Relationship[] {
    const relationshipIds = this.relationshipIndex.byType.get(type) || new Set();
    return Array.from(relationshipIds)
      .map(id => this.relationships.get(id))
      .filter((rel): rel is Relationship => rel !== undefined);
  }

  getRelationshipsBySource(sourceId: string): Relationship[] {
    const relationshipIds = this.relationshipIndex.bySource.get(sourceId) || new Set();
    return Array.from(relationshipIds)
      .map(id => this.relationships.get(id))
      .filter((rel): rel is Relationship => rel !== undefined);
  }

  getRelationshipsByTarget(targetId: string): Relationship[] {
    const relationshipIds = this.relationshipIndex.byTarget.get(targetId) || new Set();
    return Array.from(relationshipIds)
      .map(id => this.relationships.get(id))
      .filter((rel): rel is Relationship => rel !== undefined);
  }

  getRelationshipsForEntity(entityId: string): Relationship[] {
    const sourceRels = this.getRelationshipsBySource(entityId);
    const targetRels = this.getRelationshipsByTarget(entityId);
    
    // Combine and deduplicate
    const allRels = new Map<string, Relationship>();
    sourceRels.forEach(rel => allRels.set(rel.id, rel));
    targetRels.forEach(rel => allRels.set(rel.id, rel));
    
    return Array.from(allRels.values());
  }

  private addRelationshipToIndexes(relationship: Relationship): void {
    // Type index
    this.relationshipIndex.byType.get(relationship.type)?.add(relationship.id);
    
    // Source index
    if (!this.relationshipIndex.bySource.has(relationship.source)) {
      this.relationshipIndex.bySource.set(relationship.source, new Set());
    }
    this.relationshipIndex.bySource.get(relationship.source)!.add(relationship.id);
    
    // Target index
    if (!this.relationshipIndex.byTarget.has(relationship.target)) {
      this.relationshipIndex.byTarget.set(relationship.target, new Set());
    }
    this.relationshipIndex.byTarget.get(relationship.target)!.add(relationship.id);
    
    // Time range index
    const timeKey = this.getTimeBucket(relationship.extractedAt);
    if (!this.relationshipIndex.byTimeRange.has(timeKey)) {
      this.relationshipIndex.byTimeRange.set(timeKey, new Set());
    }
    this.relationshipIndex.byTimeRange.get(timeKey)!.add(relationship.id);
  }

  private removeRelationshipFromIndexes(relationship: Relationship): void {
    // Type index
    this.relationshipIndex.byType.get(relationship.type)?.delete(relationship.id);
    
    // Source index
    this.relationshipIndex.bySource.get(relationship.source)?.delete(relationship.id);
    if (this.relationshipIndex.bySource.get(relationship.source)?.size === 0) {
      this.relationshipIndex.bySource.delete(relationship.source);
    }
    
    // Target index
    this.relationshipIndex.byTarget.get(relationship.target)?.delete(relationship.id);
    if (this.relationshipIndex.byTarget.get(relationship.target)?.size === 0) {
      this.relationshipIndex.byTarget.delete(relationship.target);
    }
    
    // Time range index
    const timeKey = this.getTimeBucket(relationship.extractedAt);
    this.relationshipIndex.byTimeRange.get(timeKey)?.delete(relationship.id);
    if (this.relationshipIndex.byTimeRange.get(timeKey)?.size === 0) {
      this.relationshipIndex.byTimeRange.delete(timeKey);
    }
  }

  // Fact operations
  addFact(fact: Fact): Fact | null {
    const existingFact = this.facts.get(fact.id);
    
    // Remove old indexes if updating
    if (existingFact) {
      this.removeFactFromIndexes(existingFact);
    }
    
    // Add/update fact
    this.facts.set(fact.id, fact);
    this.addFactToIndexes(fact);
    
    return existingFact || null;
  }

  getFact(id: string): Fact | undefined {
    return this.facts.get(id);
  }

  removeFact(id: string): boolean {
    const fact = this.facts.get(id);
    if (!fact) return false;
    
    this.removeFactFromIndexes(fact);
    this.facts.delete(id);
    return true;
  }

  getFactsBySubject(subject: string): Fact[] {
    const factIds = this.factIndex.bySubject.get(subject) || new Set();
    return Array.from(factIds)
      .map(id => this.facts.get(id))
      .filter((fact): fact is Fact => fact !== undefined);
  }

  getFactsByPredicate(predicate: string): Fact[] {
    const factIds = this.factIndex.byPredicate.get(predicate) || new Set();
    return Array.from(factIds)
      .map(id => this.facts.get(id))
      .filter((fact): fact is Fact => fact !== undefined);
  }

  getFactsByObject(object: string): Fact[] {
    const factIds = this.factIndex.byObject.get(object) || new Set();
    return Array.from(factIds)
      .map(id => this.facts.get(id))
      .filter((fact): fact is Fact => fact !== undefined);
  }

  private addFactToIndexes(fact: Fact): void {
    // Subject index
    if (!this.factIndex.bySubject.has(fact.subject)) {
      this.factIndex.bySubject.set(fact.subject, new Set());
    }
    this.factIndex.bySubject.get(fact.subject)!.add(fact.id);
    
    // Predicate index
    if (!this.factIndex.byPredicate.has(fact.predicate)) {
      this.factIndex.byPredicate.set(fact.predicate, new Set());
    }
    this.factIndex.byPredicate.get(fact.predicate)!.add(fact.id);
    
    // Object index
    if (!this.factIndex.byObject.has(fact.object)) {
      this.factIndex.byObject.set(fact.object, new Set());
    }
    this.factIndex.byObject.get(fact.object)!.add(fact.id);
    
    // Time range index
    const timeKey = this.getTimeBucket(fact.extractedAt);
    if (!this.factIndex.byTimeRange.has(timeKey)) {
      this.factIndex.byTimeRange.set(timeKey, new Set());
    }
    this.factIndex.byTimeRange.get(timeKey)!.add(fact.id);
  }

  private removeFactFromIndexes(fact: Fact): void {
    // Subject index
    this.factIndex.bySubject.get(fact.subject)?.delete(fact.id);
    if (this.factIndex.bySubject.get(fact.subject)?.size === 0) {
      this.factIndex.bySubject.delete(fact.subject);
    }
    
    // Predicate index
    this.factIndex.byPredicate.get(fact.predicate)?.delete(fact.id);
    if (this.factIndex.byPredicate.get(fact.predicate)?.size === 0) {
      this.factIndex.byPredicate.delete(fact.predicate);
    }
    
    // Object index
    this.factIndex.byObject.get(fact.object)?.delete(fact.id);
    if (this.factIndex.byObject.get(fact.object)?.size === 0) {
      this.factIndex.byObject.delete(fact.object);
    }
    
    // Time range index
    const timeKey = this.getTimeBucket(fact.extractedAt);
    this.factIndex.byTimeRange.get(timeKey)?.delete(fact.id);
    if (this.factIndex.byTimeRange.get(timeKey)?.size === 0) {
      this.factIndex.byTimeRange.delete(timeKey);
    }
  }

  // Time-based queries
  getEntitiesByTimeRange(from: number, to: number): Entity[] {
    const timeBuckets = this.getTimeBucketsInRange(from, to);
    const entityIds = new Set<string>();
    
    timeBuckets.forEach(bucket => {
      const bucketIds = this.entityIndex.byTimeRange.get(bucket) || new Set();
      bucketIds.forEach(id => entityIds.add(id));
    });
    
    return Array.from(entityIds)
      .map(id => this.entities.get(id))
      .filter((entity): entity is Entity => entity !== undefined)
      .filter(entity => entity.extractedAt >= from && entity.extractedAt <= to);
  }

  getRelationshipsByTimeRange(from: number, to: number): Relationship[] {
    const timeBuckets = this.getTimeBucketsInRange(from, to);
    const relationshipIds = new Set<string>();
    
    timeBuckets.forEach(bucket => {
      const bucketIds = this.relationshipIndex.byTimeRange.get(bucket) || new Set();
      bucketIds.forEach(id => relationshipIds.add(id));
    });
    
    return Array.from(relationshipIds)
      .map(id => this.relationships.get(id))
      .filter((rel): rel is Relationship => rel !== undefined)
      .filter(rel => rel.extractedAt >= from && rel.extractedAt <= to);
  }

  getFactsByTimeRange(from: number, to: number): Fact[] {
    const timeBuckets = this.getTimeBucketsInRange(from, to);
    const factIds = new Set<string>();
    
    timeBuckets.forEach(bucket => {
      const bucketIds = this.factIndex.byTimeRange.get(bucket) || new Set();
      bucketIds.forEach(id => factIds.add(id));
    });
    
    return Array.from(factIds)
      .map(id => this.facts.get(id))
      .filter((fact): fact is Fact => fact !== undefined)
      .filter(fact => fact.extractedAt >= from && fact.extractedAt <= to);
  }

  private getTimeBucket(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private getTimeBucketsInRange(from: number, to: number): string[] {
    const buckets = [];
    const current = new Date(from);
    const end = new Date(to);
    
    while (current <= end) {
      buckets.push(this.getTimeBucket(current.getTime()));
      current.setDate(current.getDate() + 1);
    }
    
    return buckets;
  }

  // Statistics
  getStatistics(): {
    totalEntities: number;
    totalRelationships: number;
    totalFacts: number;
    entityTypeDistribution: Record<string, number>;
    relationshipTypeDistribution: Record<string, number>;
    indexSizes: {
      entityNames: number;
      entitySources: number;
      entityTimeBuckets: number;
      relationshipSources: number;
      relationshipTargets: number;
      relationshipTimeBuckets: number;
      factSubjects: number;
      factPredicates: number;
      factObjects: number;
      factTimeBuckets: number;
    };
  } {
    const entityTypeDistribution: Record<string, number> = {};
    const relationshipTypeDistribution: Record<string, number> = {};

    for (const [type, ids] of this.entityIndex.byType) {
      entityTypeDistribution[type] = ids.size;
    }

    for (const [type, ids] of this.relationshipIndex.byType) {
      relationshipTypeDistribution[type] = ids.size;
    }

    return {
      totalEntities: this.entities.size,
      totalRelationships: this.relationships.size,
      totalFacts: this.facts.size,
      entityTypeDistribution,
      relationshipTypeDistribution,
      indexSizes: {
        entityNames: this.entityIndex.byName.size,
        entitySources: this.entityIndex.bySource.size,
        entityTimeBuckets: this.entityIndex.byTimeRange.size,
        relationshipSources: this.relationshipIndex.bySource.size,
        relationshipTargets: this.relationshipIndex.byTarget.size,
        relationshipTimeBuckets: this.relationshipIndex.byTimeRange.size,
        factSubjects: this.factIndex.bySubject.size,
        factPredicates: this.factIndex.byPredicate.size,
        factObjects: this.factIndex.byObject.size,
        factTimeBuckets: this.factIndex.byTimeRange.size
      }
    };
  }

  // Bulk operations
  clear(): void {
    this.entities.clear();
    this.relationships.clear();
    this.facts.clear();
    this.entityIndex = this.initializeEntityIndex();
    this.relationshipIndex = this.initializeRelationshipIndex();
    this.factIndex = this.initializeFactIndex();
  }

  // Export/Import for persistence
  export(): {
    entities: Entity[];
    relationships: Relationship[];
    facts: Fact[];
  } {
    return {
      entities: Array.from(this.entities.values()),
      relationships: Array.from(this.relationships.values()),
      facts: Array.from(this.facts.values())
    };
  }

  import(data: {
    entities: Entity[];
    relationships: Relationship[];
    facts: Fact[];
  }): void {
    this.clear();
    
    // Import entities
    for (const entity of data.entities) {
      this.addEntity(entity);
    }
    
    // Import relationships
    for (const relationship of data.relationships) {
      this.addRelationship(relationship);
    }
    
    // Import facts
    for (const fact of data.facts) {
      this.addFact(fact);
    }
  }
}