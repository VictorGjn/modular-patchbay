import { type KnowledgeType } from '../store/knowledgeBase.js';

interface SourceBlock {
  name: string;
  type: KnowledgeType;
  content: string;
}

interface ContradictionResult {
  sources: SourceBlock[];
  annotations: string[];
  contradictionsFound: number;
}

const TYPE_PRIORITY: Record<string, number> = {
  'ground-truth': 0, 'guideline': 1, 'framework': 2, 'evidence': 3, 'signal': 4, 'hypothesis': 5,
};

const STOPWORDS = new Set(['The','This','That','These','Those','With','From','Into','About','After','Before','Between','Under','Over','Through','During','Against','Without','Within','Along','Around','Among','Beyond','Behind','Above','Below','Across','Inside','Outside','Upon','Near','South','North','East','West','New','Old','First','Last','Next','Each','Every','Both','Such','Other','Another','United','States','National']);

/**
 * Extracts entities from content using capitalized multi-word phrases
 * Filters out stopwords from entity parts
 */
function extractEntities(content: string): Set<string> {
  const entityRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  const entities = new Set<string>();

  let match;
  while ((match = entityRegex.exec(content)) !== null) {
    const entity = match[0];
    // Filter out entities that contain only stopwords
    const words = entity.split(/\s+/);
    const nonStopWords = words.filter(word => !STOPWORDS.has(word));

    if (nonStopWords.length >= 2) {
      // Normalize the entity (remove extra spaces, maintain case for first letter of each word)
      const normalizedEntity = nonStopWords.join(' ');
      entities.add(normalizedEntity);
    }
  }

  return entities;
}

/**
 * Resolves contradictions between sources by prioritizing higher-authority sources
 * For same entities appearing in multiple sources with different types
 */
export function resolveContradictions(sources: SourceBlock[]): ContradictionResult {
  if (sources.length === 0) {
    return { sources: [], annotations: [], contradictionsFound: 0 };
  }

  // Extract entities from each source
  const sourceEntities = sources.map(source => ({
    source,
    entities: extractEntities(source.content)
  }));

  // Find all entities and track which sources contain them
  const entityToSources = new Map<string, { source: SourceBlock; entities: Set<string> }[]>();

  for (const { source, entities } of sourceEntities) {
    for (const entity of entities) {
      if (!entityToSources.has(entity)) {
        entityToSources.set(entity, []);
      }
      entityToSources.get(entity)!.push({ source, entities });
    }
  }

  const keptSources = new Set<SourceBlock>();
  const annotations: string[] = [];
  let contradictionsFound = 0;

  // Process each entity that appears in multiple sources
  for (const [entity, entitySources] of entityToSources.entries()) {
    if (entitySources.length < 2) {
      // Entity appears in only one source - no contradiction
      keptSources.add(entitySources[0].source);
      continue;
    }

    // Group sources by type for this entity
    const sourcesByType = new Map<KnowledgeType, { source: SourceBlock; entities: Set<string> }[]>();
    for (const entitySource of entitySources) {
      const type = entitySource.source.type;
      if (!sourcesByType.has(type)) {
        sourcesByType.set(type, []);
      }
      sourcesByType.get(type)!.push(entitySource);
    }

    if (sourcesByType.size === 1) {
      // All sources have same type - pick largest
      const sameTypeSources = Array.from(sourcesByType.values())[0];
      const largest = sameTypeSources.reduce((max, current) =>
        current.source.content.length > max.source.content.length ? current : max
      );

      keptSources.add(largest.source);

      // Add dropped sources as annotation if multiple sources of same type
      if (sameTypeSources.length > 1) {
        const droppedNames = sameTypeSources
          .filter(s => s.source !== largest.source)
          .map(s => s.source.name);
        if (droppedNames.length > 0) {
          annotations.push(`Dropped duplicate ${largest.source.type} sources for "${entity}": ${droppedNames.join(', ')}`);
          contradictionsFound++;
        }
      }
    } else {
      // Multiple types - pick highest priority (lowest number)
      const typeEntries = Array.from(sourcesByType.entries());
      typeEntries.sort((a, b) => TYPE_PRIORITY[a[0]] - TYPE_PRIORITY[b[0]]);

      const [winningType, winningSources] = typeEntries[0];

      // Pick largest source from winning type
      const winner = winningSources.reduce((max, current) =>
        current.source.content.length > max.source.content.length ? current : max
      );
      keptSources.add(winner.source);

      // Add annotation about dropped sources
      const droppedTypes = typeEntries.slice(1).map(([type, sources]) =>
        `${type} (${sources.map(s => s.source.name).join(', ')})`
      );

      annotations.push(`Kept ${winningType} source "${winner.source.name}" for "${entity}"; dropped ${droppedTypes.join(', ')}`);
      contradictionsFound++;
    }
  }

  // Add any sources that don't contain any entities
  for (const source of sources) {
    const hasEntities = (sourceEntities.find(se => se.source === source)?.entities.size ?? 0) > 0;
    if (!hasEntities) {
      keptSources.add(source);
    }
  }

  return {
    sources: Array.from(keptSources),
    annotations,
    contradictionsFound
  };
}