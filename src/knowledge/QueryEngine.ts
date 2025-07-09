// QueryEngine.ts - Handles complex queries and graph traversal

import { Entity, Relationship, Fact, EntityStore } from './EntityStore.js';

export interface WorldModelQuery {
  entities?: {
    type?: Entity['type'];
    name?: string;
    properties?: Record<string, any>;
    sourceUrl?: string;
  };
  relationships?: {
    type?: Relationship['type'];
    source?: string;
    target?: string;
  };
  facts?: {
    subject?: string;
    predicate?: string;
    object?: string;
  };
  timeRange?: {
    from?: number;
    to?: number;
  };
  graph?: {
    startEntity?: string;
    relationshipTypes?: Relationship['type'][];
    maxDepth?: number;
    direction?: 'outgoing' | 'incoming' | 'both';
  };
  limit?: number;
  offset?: number;
  sortBy?: {
    field: 'extractedAt' | 'lastUpdated' | 'confidence' | 'name';
    direction: 'asc' | 'desc';
  };
}

export interface WorldModelResponse {
  entities: Entity[];
  relationships: Relationship[];
  facts: Fact[];
  graph?: {
    nodes: Entity[];
    edges: Relationship[];
    paths: Array<{
      entities: Entity[];
      relationships: Relationship[];
      length: number;
    }>;
  };
  metadata: {
    totalEntities: number;
    totalRelationships: number;
    totalFacts: number;
    queryTime: number;
    confidence: number;
    hasMore: boolean;
  };
}

export interface GraphTraversalResult {
  nodes: Entity[];
  edges: Relationship[];
  paths: Array<{
    entities: Entity[];
    relationships: Relationship[];
    length: number;
  }>;
}

export class QueryEngine {
  private store: EntityStore;
  private queryCache: Map<string, { result: WorldModelResponse; timestamp: number }> = new Map();
  private cacheTimeout = 60000; // 1 minute

  constructor(store: EntityStore) {
    this.store = store;
  }

  query(query: WorldModelQuery): WorldModelResponse {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(query);
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    let entities: Entity[] = [];
    let relationships: Relationship[] = [];
    let facts: Fact[] = [];
    let graph: GraphTraversalResult | undefined;

    // Handle entity queries
    if (query.entities) {
      entities = this.queryEntities(query.entities, query.timeRange);
    }

    // Handle relationship queries
    if (query.relationships) {
      relationships = this.queryRelationships(query.relationships, query.timeRange);
    }

    // Handle fact queries
    if (query.facts) {
      facts = this.queryFacts(query.facts, query.timeRange);
    }

    // Handle graph traversal
    if (query.graph) {
      graph = this.performGraphTraversal(query.graph);
      
      // If graph query, combine results
      if (graph.nodes.length > 0 && entities.length === 0) {
        entities = graph.nodes;
      }
      if (graph.edges.length > 0 && relationships.length === 0) {
        relationships = graph.edges;
      }
    }

    // Get totals for metadata
    const totalEntities = entities.length;
    const totalRelationships = relationships.length;
    const totalFacts = facts.length;

    // Apply sorting
    if (query.sortBy) {
      entities = this.sortEntities(entities, query.sortBy);
      relationships = this.sortRelationships(relationships, query.sortBy);
      facts = this.sortFacts(facts, query.sortBy);
    }

    // Apply pagination
    const hasMore = Boolean(query.limit && (entities.length > query.limit || 
                           relationships.length > query.limit ||
                           facts.length > query.limit));

    if (query.limit) {
      const offset = query.offset || 0;
      entities = entities.slice(offset, offset + query.limit);
      relationships = relationships.slice(offset, offset + query.limit);
      facts = facts.slice(offset, offset + query.limit);
    }

    const queryTime = Date.now() - startTime;
    const confidence = this.calculateQueryConfidence(entities, relationships, facts);

    const result: WorldModelResponse = {
      entities,
      relationships,
      facts,
      graph: graph ? {
        nodes: graph.nodes,
        edges: graph.edges,
        paths: graph.paths
      } : undefined,
      metadata: {
        totalEntities,
        totalRelationships,
        totalFacts,
        queryTime,
        confidence,
        hasMore
      }
    };

    // Cache the result
    this.queryCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }

  private queryEntities(entityQuery: NonNullable<WorldModelQuery['entities']>, timeRange?: WorldModelQuery['timeRange']): Entity[] {
    let entities: Entity[] = [];

    // Use indexes for efficient filtering
    if (entityQuery.type) {
      entities = this.store.getEntitiesByType(entityQuery.type);
    } else if (entityQuery.name) {
      entities = this.store.getEntitiesByName(entityQuery.name);
    } else if (entityQuery.sourceUrl) {
      entities = this.store.getEntitiesBySource(entityQuery.sourceUrl);
    } else {
      // If no indexed filters, get all entities (less efficient)
      entities = this.store.getEntitiesByType('product')
        .concat(this.store.getEntitiesByType('vendor'))
        .concat(this.store.getEntitiesByType('price'))
        .concat(this.store.getEntitiesByType('location'))
        .concat(this.store.getEntitiesByType('date'))
        .concat(this.store.getEntitiesByType('availability'))
        .concat(this.store.getEntitiesByType('category'));
    }

    // Apply additional filters
    if (entityQuery.name && !entityQuery.name) {
      entities = entities.filter(e => e.name.toLowerCase().includes(entityQuery.name!.toLowerCase()));
    }

    if (entityQuery.properties) {
      entities = entities.filter(e => {
        return Object.entries(entityQuery.properties!).every(([key, value]) => 
          e.properties[key] === value
        );
      });
    }

    if (entityQuery.sourceUrl && !entityQuery.sourceUrl) {
      entities = entities.filter(e => e.sourceUrl === entityQuery.sourceUrl);
    }

    // Apply time range filter
    if (timeRange) {
      entities = this.filterByTimeRange(entities, timeRange);
    }

    return entities;
  }

  private queryRelationships(relationshipQuery: NonNullable<WorldModelQuery['relationships']>, timeRange?: WorldModelQuery['timeRange']): Relationship[] {
    let relationships: Relationship[] = [];

    // Use indexes for efficient filtering
    if (relationshipQuery.type) {
      relationships = this.store.getRelationshipsByType(relationshipQuery.type);
    } else if (relationshipQuery.source) {
      relationships = this.store.getRelationshipsBySource(relationshipQuery.source);
    } else if (relationshipQuery.target) {
      relationships = this.store.getRelationshipsByTarget(relationshipQuery.target);
    } else {
      // If no indexed filters, get all relationships (less efficient)
      relationships = this.store.getRelationshipsByType('SOLD_BY')
        .concat(this.store.getRelationshipsByType('PRICED_AT'))
        .concat(this.store.getRelationshipsByType('LOCATED_IN'))
        .concat(this.store.getRelationshipsByType('CATEGORY_OF'))
        .concat(this.store.getRelationshipsByType('AVAILABLE_AT'))
        .concat(this.store.getRelationshipsByType('CHANGED_FROM'))
        .concat(this.store.getRelationshipsByType('SIMILAR_TO'));
    }

    // Apply additional filters
    if (relationshipQuery.source && !relationshipQuery.source) {
      relationships = relationships.filter(r => r.source === relationshipQuery.source);
    }

    if (relationshipQuery.target && !relationshipQuery.target) {
      relationships = relationships.filter(r => r.target === relationshipQuery.target);
    }

    // Apply time range filter
    if (timeRange) {
      relationships = this.filterByTimeRange(relationships, timeRange);
    }

    return relationships;
  }

  private queryFacts(factQuery: NonNullable<WorldModelQuery['facts']>, timeRange?: WorldModelQuery['timeRange']): Fact[] {
    let facts: Fact[] = [];

    // Use indexes for efficient filtering
    if (factQuery.subject) {
      facts = this.store.getFactsBySubject(factQuery.subject);
    } else if (factQuery.predicate) {
      facts = this.store.getFactsByPredicate(factQuery.predicate);
    } else if (factQuery.object) {
      facts = this.store.getFactsByObject(factQuery.object);
    } else {
      // If no indexed filters, this would be very inefficient
      // For now, return empty array and require at least one filter
      return [];
    }

    // Apply additional filters
    if (factQuery.predicate && !factQuery.predicate) {
      facts = facts.filter(f => f.predicate === factQuery.predicate);
    }

    if (factQuery.object && !factQuery.object) {
      facts = facts.filter(f => f.object === factQuery.object);
    }

    // Apply time range filter
    if (timeRange) {
      facts = this.filterByTimeRange(facts, timeRange);
    }

    return facts;
  }

  private performGraphTraversal(graphQuery: NonNullable<WorldModelQuery['graph']>): GraphTraversalResult {
    const { startEntity, relationshipTypes, maxDepth = 3, direction = 'both' } = graphQuery;

    if (!startEntity) {
      return { nodes: [], edges: [], paths: [] };
    }

    const startEntityObj = this.store.getEntity(startEntity);
    if (!startEntityObj) {
      return { nodes: [], edges: [], paths: [] };
    }

    const visited = new Set<string>();
    const nodes = new Map<string, Entity>();
    const edges = new Map<string, Relationship>();
    const paths: Array<{ entities: Entity[]; relationships: Relationship[]; length: number }> = [];

    // BFS traversal
    const queue: Array<{ entityId: string; depth: number; path: Entity[]; relationshipPath: Relationship[] }> = [
      { entityId: startEntity, depth: 0, path: [startEntityObj], relationshipPath: [] }
    ];

    nodes.set(startEntity, startEntityObj);

    while (queue.length > 0) {
      const { entityId, depth, path, relationshipPath } = queue.shift()!;

      if (depth >= maxDepth) {
        if (path.length > 1) {
          paths.push({ entities: path, relationships: relationshipPath, length: path.length });
        }
        continue;
      }

      if (visited.has(entityId)) {
        continue;
      }
      visited.add(entityId);

      const relationships = this.store.getRelationshipsForEntity(entityId);

      for (const relationship of relationships) {
        // Filter by relationship type if specified
        if (relationshipTypes && !relationshipTypes.includes(relationship.type)) {
          continue;
        }

        let nextEntityId: string | undefined;

        // Determine next entity based on direction
        if (direction === 'outgoing' && relationship.source === entityId) {
          nextEntityId = relationship.target;
        } else if (direction === 'incoming' && relationship.target === entityId) {
          nextEntityId = relationship.source;
        } else if (direction === 'both') {
          nextEntityId = relationship.source === entityId ? relationship.target : relationship.source;
        }

        if (!nextEntityId) continue;

        const nextEntity = this.store.getEntity(nextEntityId);
        if (!nextEntity) continue;

        // Add to results
        nodes.set(nextEntityId, nextEntity);
        edges.set(relationship.id, relationship);

        // Continue traversal
        if (!visited.has(nextEntityId)) {
          queue.push({
            entityId: nextEntityId,
            depth: depth + 1,
            path: [...path, nextEntity],
            relationshipPath: [...relationshipPath, relationship]
          });
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      paths
    };
  }

  private filterByTimeRange<T extends { extractedAt: number }>(items: T[], timeRange: WorldModelQuery['timeRange']): T[] {
    if (!timeRange) return items;

    return items.filter(item => {
      if (timeRange.from && item.extractedAt < timeRange.from) return false;
      if (timeRange.to && item.extractedAt > timeRange.to) return false;
      return true;
    });
  }

  private sortEntities(entities: Entity[], sortBy: NonNullable<WorldModelQuery['sortBy']>): Entity[] {
    return entities.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy.field) {
        case 'extractedAt':
          aValue = a.extractedAt;
          bValue = b.extractedAt;
          break;
        case 'lastUpdated':
          aValue = a.lastUpdated;
          bValue = b.lastUpdated;
          break;
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortBy.direction === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });
  }

  private sortRelationships(relationships: Relationship[], sortBy: NonNullable<WorldModelQuery['sortBy']>): Relationship[] {
    return relationships.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy.field) {
        case 'extractedAt':
          aValue = a.extractedAt;
          bValue = b.extractedAt;
          break;
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        default:
          return 0;
      }

      if (sortBy.direction === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });
  }

  private sortFacts(facts: Fact[], sortBy: NonNullable<WorldModelQuery['sortBy']>): Fact[] {
    return facts.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy.field) {
        case 'extractedAt':
          aValue = a.extractedAt;
          bValue = b.extractedAt;
          break;
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        default:
          return 0;
      }

      if (sortBy.direction === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });
  }

  private calculateQueryConfidence(entities: Entity[], relationships: Relationship[], facts: Fact[]): number {
    const allItems = [...entities, ...relationships, ...facts];
    if (allItems.length === 0) return 0;

    const avgConfidence = allItems.reduce((sum, item) => sum + item.confidence, 0) / allItems.length;
    return avgConfidence;
  }

  private getCacheKey(query: WorldModelQuery): string {
    return JSON.stringify(query);
  }

  // Advanced query methods

  findSimilarEntities(entityId: string, limit: number = 10): Entity[] {
    const entity = this.store.getEntity(entityId);
    if (!entity) return [];

    // Find entities of the same type with similar properties
    const sameTypeEntities = this.store.getEntitiesByType(entity.type);
    
    return sameTypeEntities
      .filter(e => e.id !== entityId)
      .map(e => ({
        entity: e,
        similarity: this.calculateSimilarity(entity, e)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.entity);
  }

  findEntityByPath(startEntityId: string, path: Relationship['type'][]): Entity[] {
    const results: Entity[] = [];
    
    const traverse = (currentEntityId: string, remainingPath: Relationship['type'][], visited: Set<string>) => {
      if (remainingPath.length === 0) {
        const entity = this.store.getEntity(currentEntityId);
        if (entity) results.push(entity);
        return;
      }

      if (visited.has(currentEntityId)) return;
      visited.add(currentEntityId);

      const [nextRelType, ...restPath] = remainingPath;
      const relationships = this.store.getRelationshipsBySource(currentEntityId)
        .filter(r => r.type === nextRelType);

      for (const rel of relationships) {
        traverse(rel.target, restPath, new Set(visited));
      }
    };

    traverse(startEntityId, path, new Set());
    return results;
  }

  getEntityHistory(entityId: string): Array<{ timestamp: number; changes: any }> {
    // This would typically query a separate change log
    // For now, return empty array as this requires the ChangeLog component
    return [];
  }

  private calculateSimilarity(entity1: Entity, entity2: Entity): number {
    let similarity = 0;
    let factors = 0;

    // Name similarity
    if (entity1.name && entity2.name) {
      const name1 = entity1.name.toLowerCase();
      const name2 = entity2.name.toLowerCase();
      if (name1 === name2) {
        similarity += 1;
      } else if (name1.includes(name2) || name2.includes(name1)) {
        similarity += 0.5;
      }
      factors++;
    }

    // Property similarity
    const props1 = Object.keys(entity1.properties);
    const props2 = Object.keys(entity2.properties);
    const commonProps = props1.filter(prop => props2.includes(prop));
    
    if (commonProps.length > 0) {
      const matchingProps = commonProps.filter(prop => 
        entity1.properties[prop] === entity2.properties[prop]
      );
      similarity += matchingProps.length / commonProps.length;
      factors++;
    }

    // Source similarity
    if (entity1.sourceUrl && entity2.sourceUrl) {
      const domain1 = new URL(entity1.sourceUrl).hostname;
      const domain2 = new URL(entity2.sourceUrl).hostname;
      if (domain1 === domain2) {
        similarity += 0.5;
      }
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  // Cache management
  clearCache(): void {
    this.queryCache.clear();
  }

  getCacheStats(): { size: number; hitRate: number } {
    // This would require tracking cache hits/misses
    return { size: this.queryCache.size, hitRate: 0 };
  }
}