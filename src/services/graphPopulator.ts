/**
 * Auto-populate MCP Knowledge Graph from indexed repo data.
 * When a repo is indexed, this converts the scan metadata into graph entities
 * so the agent can query the knowledge graph and find real data.
 */

import { useMcpStore } from '../store/mcpStore';

interface RepoScan {
  name: string;
  stack: string[];
  totalFiles: number;
  totalTokens: number;
  features: { name: string; keyFiles: string[]; stores?: string[]; routes?: string[]; componentCount?: number }[];
  conventions?: string[];
  modules?: { name: string; files: string[] }[];
}

interface GraphEntity {
  name: string;
  entityType: string;
  observations: string[];
}

interface GraphRelation {
  from: string;
  to: string;
  relationType: string;
}

function buildEntitiesFromScan(repoName: string, scan: RepoScan): { entities: GraphEntity[]; relations: GraphRelation[] } {
  const entities: GraphEntity[] = [];
  const relations: GraphRelation[] = [];

  // Root repo entity
  entities.push({
    name: repoName,
    entityType: 'repository',
    observations: [
      `Tech stack: ${scan.stack.join(', ')}`,
      `Total files: ${scan.totalFiles}`,
      `Total tokens: ${scan.totalTokens}`,
      ...(scan.conventions ?? []).map(c => `Convention: ${c}`),
    ],
  });

  // Feature entities
  for (const feature of scan.features) {
    const featureName = `${repoName}/${feature.name}`;
    entities.push({
      name: featureName,
      entityType: 'feature',
      observations: [
        `Key files: ${feature.keyFiles.join(', ')}`,
        ...(feature.stores ?? []).map(s => `Store: ${s}`),
        ...(feature.routes ?? []).map(r => `Route: ${r}`),
        ...(feature.componentCount ? [`Components: ${feature.componentCount}`] : []),
      ],
    });
    relations.push({ from: repoName, to: featureName, relationType: 'has_feature' });

    // Key file entities
    for (const file of feature.keyFiles.slice(0, 5)) {
      const fileName = `${repoName}:${file}`;
      entities.push({
        name: fileName,
        entityType: 'file',
        observations: [`Path: ${file}`, `Feature: ${feature.name}`],
      });
      relations.push({ from: featureName, to: fileName, relationType: 'contains_file' });
    }
  }

  // Module entities
  for (const mod of scan.modules ?? []) {
    const modName = `${repoName}/module:${mod.name}`;
    entities.push({
      name: modName,
      entityType: 'module',
      observations: [`Files: ${mod.files.length}`, `Key files: ${mod.files.slice(0, 5).join(', ')}`],
    });
    relations.push({ from: repoName, to: modName, relationType: 'has_module' });
  }

  return { entities, relations };
}

/**
 * Populate the MCP knowledge graph with indexed repo data.
 * Finds the memory MCP server, calls create_entities + create_relations.
 * Silently no-ops if no memory server is connected.
 */
export async function populateGraphFromScan(repoName: string, scan: RepoScan): Promise<void> {
  const mcpStore = useMcpStore.getState();
  
  // Find a connected memory/graph MCP server
  const memoryServer = mcpStore.servers.find(
    s => s.status === 'connected' && s.tools.some(t => t.name === 'create_entities'),
  );
  
  if (!memoryServer) return; // No graph server connected — silent skip

  const { entities, relations } = buildEntitiesFromScan(repoName, scan);

  try {
    // Create entities first
    if (entities.length > 0) {
      await mcpStore.callTool(memoryServer.id, 'create_entities', { entities });
    }
    // Then relations
    if (relations.length > 0) {
      await mcpStore.callTool(memoryServer.id, 'create_relations', { relations });
    }
  } catch {
    // Best effort — don't break the indexing flow
  }
}

/**
 * Populate graph from multiple indexed repos.
 */
export async function populateGraphFromMultiScan(
  repos: { name: string; scan: RepoScan }[],
): Promise<void> {
  for (const { name, scan } of repos) {
    await populateGraphFromScan(name, scan);
  }
}
