// ChangeLog.ts - Manages change events and consistency checking

import { Entity, Relationship, Fact } from './EntityStore.js';

export interface ChangeEvent {
  id: string;
  type: 'ENTITY_CREATED' | 'ENTITY_UPDATED' | 'ENTITY_DELETED' | 
        'RELATIONSHIP_CREATED' | 'RELATIONSHIP_UPDATED' | 'RELATIONSHIP_DELETED' | 
        'FACT_CREATED' | 'FACT_UPDATED' | 'FACT_DELETED';
  entityId?: string;
  relationshipId?: string;
  factId?: string;
  oldValue?: any;
  newValue?: any;
  sourceUrl: string;
  timestamp: number;
  confidence: number;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface Inconsistency {
  id: string;
  type: 'DUPLICATE_ENTITY' | 'CONFLICTING_FACT' | 'ORPHANED_RELATIONSHIP' | 
        'TEMPORAL_INCONSISTENCY' | 'CONFIDENCE_ANOMALY' | 'MISSING_ENTITY';
  description: string;
  entityIds?: string[];
  relationshipIds?: string[];
  factIds?: string[];
  confidence: number;
  detectedAt: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolved?: boolean;
  resolvedAt?: number;
  resolution?: string;
}

export interface ConsistencyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  check: (entities: Entity[], relationships: Relationship[], facts: Fact[]) => Inconsistency[];
}

export class ChangeLog {
  private events: ChangeEvent[] = [];
  private inconsistencies: Map<string, Inconsistency> = new Map();
  private maxEventsInMemory = 10000;
  private eventIndex: Map<string, Set<string>> = new Map(); // type -> event IDs
  private timeIndex: Map<string, Set<string>> = new Map(); // time bucket -> event IDs
  private consistencyRules: Map<string, ConsistencyRule> = new Map();
  private lastConsistencyCheck = 0;
  private consistencyCheckInterval = 60000; // 1 minute

  constructor() {
    this.initializeIndexes();
    this.initializeConsistencyRules();
  }

  private initializeIndexes(): void {
    const eventTypes = [
      'ENTITY_CREATED', 'ENTITY_UPDATED', 'ENTITY_DELETED',
      'RELATIONSHIP_CREATED', 'RELATIONSHIP_UPDATED', 'RELATIONSHIP_DELETED',
      'FACT_CREATED', 'FACT_UPDATED', 'FACT_DELETED'
    ];

    eventTypes.forEach(type => {
      this.eventIndex.set(type, new Set());
    });
  }

  private initializeConsistencyRules(): void {
    // Rule 1: Duplicate Entity Detection
    this.consistencyRules.set('duplicate-entities', {
      id: 'duplicate-entities',
      name: 'Duplicate Entity Detection',
      description: 'Detects entities with identical names and types',
      enabled: true,
      check: (entities, relationships, facts) => {
        const inconsistencies: Inconsistency[] = [];
        const entityGroups = new Map<string, Entity[]>();

        // Group entities by type:name
        for (const entity of entities) {
          const key = `${entity.type}:${entity.name.toLowerCase()}`;
          if (!entityGroups.has(key)) {
            entityGroups.set(key, []);
          }
          entityGroups.get(key)!.push(entity);
        }

        // Check for duplicates
        for (const [key, group] of entityGroups) {
          if (group.length > 1) {
            const highestConfidence = Math.max(...group.map(e => e.confidence));
            const severity = group.length > 3 ? 'HIGH' : 'MEDIUM';
            
            inconsistencies.push({
              id: `duplicate-entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'DUPLICATE_ENTITY',
              description: `Found ${group.length} duplicate entities: ${key}`,
              entityIds: group.map(e => e.id),
              confidence: highestConfidence,
              detectedAt: Date.now(),
              severity: severity as any
            });
          }
        }

        return inconsistencies;
      }
    });

    // Rule 2: Orphaned Relationship Detection
    this.consistencyRules.set('orphaned-relationships', {
      id: 'orphaned-relationships',
      name: 'Orphaned Relationship Detection',
      description: 'Detects relationships referencing non-existent entities',
      enabled: true,
      check: (entities, relationships, facts) => {
        const inconsistencies: Inconsistency[] = [];
        const entityIds = new Set(entities.map(e => e.id));

        for (const relationship of relationships) {
          const missingEntities = [];
          
          if (!entityIds.has(relationship.source)) {
            missingEntities.push(relationship.source);
          }
          if (!entityIds.has(relationship.target)) {
            missingEntities.push(relationship.target);
          }

          if (missingEntities.length > 0) {
            inconsistencies.push({
              id: `orphaned-rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'ORPHANED_RELATIONSHIP',
              description: `Relationship ${relationship.id} references missing entities: ${missingEntities.join(', ')}`,
              relationshipIds: [relationship.id],
              confidence: 0.95,
              detectedAt: Date.now(),
              severity: 'HIGH'
            });
          }
        }

        return inconsistencies;
      }
    });

    // Rule 3: Conflicting Facts Detection
    this.consistencyRules.set('conflicting-facts', {
      id: 'conflicting-facts',
      name: 'Conflicting Facts Detection',
      description: 'Detects facts with same subject/predicate but different objects',
      enabled: true,
      check: (entities, relationships, facts) => {
        const inconsistencies: Inconsistency[] = [];
        const factGroups = new Map<string, Fact[]>();

        // Group facts by subject:predicate
        for (const fact of facts) {
          const key = `${fact.subject}:${fact.predicate}`;
          if (!factGroups.has(key)) {
            factGroups.set(key, []);
          }
          factGroups.get(key)!.push(fact);
        }

        // Check for conflicts
        for (const [key, group] of factGroups) {
          if (group.length > 1) {
            const uniqueObjects = new Set(group.map(f => f.object));
            if (uniqueObjects.size > 1) {
              const avgConfidence = group.reduce((sum, f) => sum + f.confidence, 0) / group.length;
              const severity = uniqueObjects.size > 2 ? 'HIGH' : 'MEDIUM';
              
              inconsistencies.push({
                id: `conflicting-fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'CONFLICTING_FACT',
                description: `Conflicting facts for ${key}: ${Array.from(uniqueObjects).join(', ')}`,
                factIds: group.map(f => f.id),
                confidence: avgConfidence,
                detectedAt: Date.now(),
                severity: severity as any
              });
            }
          }
        }

        return inconsistencies;
      }
    });

    // Rule 4: Temporal Inconsistency Detection
    this.consistencyRules.set('temporal-inconsistencies', {
      id: 'temporal-inconsistencies',
      name: 'Temporal Inconsistency Detection',
      description: 'Detects temporal inconsistencies in entity updates',
      enabled: true,
      check: (entities, relationships, facts) => {
        const inconsistencies: Inconsistency[] = [];

        for (const entity of entities) {
          // Check if lastUpdated is before extractedAt
          if (entity.lastUpdated && entity.lastUpdated < entity.extractedAt) {
            inconsistencies.push({
              id: `temporal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'TEMPORAL_INCONSISTENCY',
              description: `Entity ${entity.id} has lastUpdated before extractedAt`,
              entityIds: [entity.id],
              confidence: 0.9,
              detectedAt: Date.now(),
              severity: 'LOW'
            });
          }

          // Check for future timestamps
          const now = Date.now();
          if (entity.extractedAt > now + 60000) { // 1 minute tolerance
            inconsistencies.push({
              id: `future-timestamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'TEMPORAL_INCONSISTENCY',
              description: `Entity ${entity.id} has future extractedAt timestamp`,
              entityIds: [entity.id],
              confidence: 0.8,
              detectedAt: Date.now(),
              severity: 'MEDIUM'
            });
          }
        }

        return inconsistencies;
      }
    });

    // Rule 5: Confidence Anomaly Detection
    this.consistencyRules.set('confidence-anomalies', {
      id: 'confidence-anomalies',
      name: 'Confidence Anomaly Detection',
      description: 'Detects unusual confidence patterns',
      enabled: true,
      check: (entities, relationships, facts) => {
        const inconsistencies: Inconsistency[] = [];
        const allItems = [...entities, ...relationships, ...facts];
        
        if (allItems.length === 0) return inconsistencies;

        // Calculate confidence statistics
        const confidences = allItems.map(item => item.confidence);
        const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
        const stdDev = Math.sqrt(confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length);

        // Flag items with unusually low or high confidence
        const threshold = 2 * stdDev;
        
        for (const item of allItems) {
          if (Math.abs(item.confidence - avgConfidence) > threshold) {
            const itemType = 'type' in item ? 'entity' : 'id' in item && 'source' in item ? 'relationship' : 'fact';
            const severity = item.confidence < 0.1 ? 'HIGH' : 'MEDIUM';
            
            inconsistencies.push({
              id: `confidence-anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'CONFIDENCE_ANOMALY',
              description: `${itemType} has unusual confidence: ${item.confidence.toFixed(2)} (avg: ${avgConfidence.toFixed(2)})`,
              entityIds: itemType === 'entity' ? [item.id] : undefined,
              relationshipIds: itemType === 'relationship' ? [item.id] : undefined,
              factIds: itemType === 'fact' ? [item.id] : undefined,
              confidence: item.confidence,
              detectedAt: Date.now(),
              severity: severity as any
            });
          }
        }

        return inconsistencies;
      }
    });
  }

  // Event logging
  logEvent(event: Omit<ChangeEvent, 'id'>): void {
    const fullEvent: ChangeEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Add to events array
    this.events.push(fullEvent);

    // Add to indexes
    this.eventIndex.get(event.type)?.add(fullEvent.id);
    
    const timeKey = this.getTimeBucket(event.timestamp);
    if (!this.timeIndex.has(timeKey)) {
      this.timeIndex.set(timeKey, new Set());
    }
    this.timeIndex.get(timeKey)!.add(fullEvent.id);

    // Prune old events if needed
    this.pruneOldEvents();
  }

  private pruneOldEvents(): void {
    if (this.events.length > this.maxEventsInMemory) {
      const eventsToRemove = this.events.length - this.maxEventsInMemory;
      const removedEvents = this.events.splice(0, eventsToRemove);

      // Remove from indexes
      for (const event of removedEvents) {
        this.eventIndex.get(event.type)?.delete(event.id);
        
        const timeKey = this.getTimeBucket(event.timestamp);
        this.timeIndex.get(timeKey)?.delete(event.id);
        
        // Clean up empty time buckets
        if (this.timeIndex.get(timeKey)?.size === 0) {
          this.timeIndex.delete(timeKey);
        }
      }
    }
  }

  // Event queries
  getEvents(filter?: {
    type?: ChangeEvent['type'];
    timeRange?: { from: number; to: number };
    entityId?: string;
    relationshipId?: string;
    factId?: string;
    limit?: number;
    offset?: number;
  }): ChangeEvent[] {
    let events = this.events;

    if (filter) {
      // Filter by type
      if (filter.type) {
        const eventIds = this.eventIndex.get(filter.type) || new Set();
        events = events.filter(e => eventIds.has(e.id));
      }

      // Filter by time range
      if (filter.timeRange) {
        events = events.filter(e => {
          if (filter.timeRange!.from && e.timestamp < filter.timeRange!.from) return false;
          if (filter.timeRange!.to && e.timestamp > filter.timeRange!.to) return false;
          return true;
        });
      }

      // Filter by entity/relationship/fact ID
      if (filter.entityId) {
        events = events.filter(e => e.entityId === filter.entityId);
      }
      if (filter.relationshipId) {
        events = events.filter(e => e.relationshipId === filter.relationshipId);
      }
      if (filter.factId) {
        events = events.filter(e => e.factId === filter.factId);
      }

      // Apply pagination
      if (filter.offset || filter.limit) {
        const offset = filter.offset || 0;
        const limit = filter.limit || events.length;
        events = events.slice(offset, offset + limit);
      }
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  getEventHistory(itemId: string, itemType: 'entity' | 'relationship' | 'fact'): ChangeEvent[] {
    const filterKey = itemType === 'entity' ? 'entityId' : 
                     itemType === 'relationship' ? 'relationshipId' : 'factId';
    
    return this.events
      .filter(e => e[filterKey] === itemId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // Consistency checking
  checkConsistency(entities: Entity[], relationships: Relationship[], facts: Fact[]): Inconsistency[] {
    const now = Date.now();
    
    // Skip if checked recently
    if (now - this.lastConsistencyCheck < this.consistencyCheckInterval) {
      return Array.from(this.inconsistencies.values()).filter(i => !i.resolved);
    }

    this.lastConsistencyCheck = now;
    const allInconsistencies: Inconsistency[] = [];

    // Run all enabled consistency rules
    for (const rule of this.consistencyRules.values()) {
      if (rule.enabled) {
        try {
          const ruleInconsistencies = rule.check(entities, relationships, facts);
          allInconsistencies.push(...ruleInconsistencies);
        } catch (error) {
          console.error(`Consistency rule ${rule.id} failed:`, error);
        }
      }
    }

    // Update inconsistencies map
    for (const inconsistency of allInconsistencies) {
      this.inconsistencies.set(inconsistency.id, inconsistency);
    }

    return allInconsistencies;
  }

  getInconsistencies(filter?: {
    type?: Inconsistency['type'];
    severity?: Inconsistency['severity'];
    resolved?: boolean;
    limit?: number;
  }): Inconsistency[] {
    let inconsistencies = Array.from(this.inconsistencies.values());

    if (filter) {
      if (filter.type) {
        inconsistencies = inconsistencies.filter(i => i.type === filter.type);
      }
      if (filter.severity) {
        inconsistencies = inconsistencies.filter(i => i.severity === filter.severity);
      }
      if (filter.resolved !== undefined) {
        inconsistencies = inconsistencies.filter(i => Boolean(i.resolved) === filter.resolved);
      }
      if (filter.limit) {
        inconsistencies = inconsistencies.slice(0, filter.limit);
      }
    }

    return inconsistencies.sort((a, b) => b.detectedAt - a.detectedAt);
  }

  resolveInconsistency(inconsistencyId: string, resolution: string): boolean {
    const inconsistency = this.inconsistencies.get(inconsistencyId);
    if (!inconsistency) return false;

    inconsistency.resolved = true;
    inconsistency.resolvedAt = Date.now();
    inconsistency.resolution = resolution;

    return true;
  }

  // Consistency rule management
  addConsistencyRule(rule: ConsistencyRule): void {
    this.consistencyRules.set(rule.id, rule);
  }

  removeConsistencyRule(ruleId: string): boolean {
    return this.consistencyRules.delete(ruleId);
  }

  enableConsistencyRule(ruleId: string): boolean {
    const rule = this.consistencyRules.get(ruleId);
    if (!rule) return false;
    
    rule.enabled = true;
    return true;
  }

  disableConsistencyRule(ruleId: string): boolean {
    const rule = this.consistencyRules.get(ruleId);
    if (!rule) return false;
    
    rule.enabled = false;
    return true;
  }

  getConsistencyRules(): ConsistencyRule[] {
    return Array.from(this.consistencyRules.values());
  }

  // Utility methods
  private getTimeBucket(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }

  // Statistics
  getEventStatistics(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsInLast24h: number;
    eventsInLastHour: number;
    averageEventsPerHour: number;
    oldestEvent?: number;
    newestEvent?: number;
  } {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const lastHour = now - (60 * 60 * 1000);

    const eventsByType: Record<string, number> = {};
    let eventsInLast24h = 0;
    let eventsInLastHour = 0;
    let oldestEvent: number | undefined;
    let newestEvent: number | undefined;

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      if (event.timestamp >= last24h) eventsInLast24h++;
      if (event.timestamp >= lastHour) eventsInLastHour++;
      
      if (!oldestEvent || event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
      if (!newestEvent || event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }
    }

    const averageEventsPerHour = oldestEvent && newestEvent ? 
      (this.events.length / ((newestEvent - oldestEvent) / (60 * 60 * 1000))) || 0 : 0;

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsInLast24h,
      eventsInLastHour,
      averageEventsPerHour,
      oldestEvent,
      newestEvent
    };
  }

  getConsistencyStatistics(): {
    totalInconsistencies: number;
    inconsistenciesByType: Record<string, number>;
    inconsistenciesBySeverity: Record<string, number>;
    resolvedInconsistencies: number;
    unresolvedInconsistencies: number;
    averageResolutionTime: number;
  } {
    const inconsistencies = Array.from(this.inconsistencies.values());
    const inconsistenciesByType: Record<string, number> = {};
    const inconsistenciesBySeverity: Record<string, number> = {};
    let resolvedInconsistencies = 0;
    let totalResolutionTime = 0;

    for (const inconsistency of inconsistencies) {
      inconsistenciesByType[inconsistency.type] = (inconsistenciesByType[inconsistency.type] || 0) + 1;
      inconsistenciesBySeverity[inconsistency.severity] = (inconsistenciesBySeverity[inconsistency.severity] || 0) + 1;
      
      if (inconsistency.resolved && inconsistency.resolvedAt) {
        resolvedInconsistencies++;
        totalResolutionTime += inconsistency.resolvedAt - inconsistency.detectedAt;
      }
    }

    const averageResolutionTime = resolvedInconsistencies > 0 ? 
      totalResolutionTime / resolvedInconsistencies : 0;

    return {
      totalInconsistencies: inconsistencies.length,
      inconsistenciesByType,
      inconsistenciesBySeverity,
      resolvedInconsistencies,
      unresolvedInconsistencies: inconsistencies.length - resolvedInconsistencies,
      averageResolutionTime
    };
  }

  // Export/Import
  export(): {
    events: ChangeEvent[];
    inconsistencies: Inconsistency[];
    rules: ConsistencyRule[];
  } {
    return {
      events: this.events,
      inconsistencies: Array.from(this.inconsistencies.values()),
      rules: Array.from(this.consistencyRules.values())
    };
  }

  import(data: {
    events: ChangeEvent[];
    inconsistencies: Inconsistency[];
    rules: ConsistencyRule[];
  }): void {
    this.events = data.events;
    this.inconsistencies.clear();
    this.consistencyRules.clear();

    // Import inconsistencies
    for (const inconsistency of data.inconsistencies) {
      this.inconsistencies.set(inconsistency.id, inconsistency);
    }

    // Import rules
    for (const rule of data.rules) {
      this.consistencyRules.set(rule.id, rule);
    }

    // Rebuild indexes
    this.initializeIndexes();
    for (const event of this.events) {
      this.eventIndex.get(event.type)?.add(event.id);
      
      const timeKey = this.getTimeBucket(event.timestamp);
      if (!this.timeIndex.has(timeKey)) {
        this.timeIndex.set(timeKey, new Set());
      }
      this.timeIndex.get(timeKey)!.add(event.id);
    }
  }

  // Cleanup
  clear(): void {
    this.events = [];
    this.inconsistencies.clear();
    this.initializeIndexes();
  }
}