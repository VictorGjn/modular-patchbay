/**
 * Graph Store
 *
 * Mirrors the server-side context graph in frontend Zustand state.
 * Provides scan, query, status, node selection, and readiness metrics.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FileNode, Relation, ScanResult, TaskType } from '../graph/types';
import { API_BASE } from '../config';

// ── Shape ─────────────────────────────────────────────────────────────────────

export interface GraphStats {
  nodes: number;
  symbols: number;
  relations: number;
}

export interface QueryResult {
  items: Array<{
    path: string;
    language: string;
    depth: number;
    tokens: number;
    relevance: number;
    symbols: Array<{ name: string; kind: string; exported: boolean }>;
  }>;
  totalTokens: number;
  budgetUtilization: number;
  entryPoints: Array<{
    fileId: string;
    symbol?: string;
    confidence: number;
    reason: string;
  }>;
}

export interface ReadinessMetrics {
  /** % files that participate in at least one relation */
  coverage: number;
  /** % non-test source files that have a tested_by relation */
  testCoupling: number;
  /** % directories that have a documents relation */
  docCoupling: number;
  /** count of detected import cycles */
  circularDeps: number;
  /** max fan-in / total nodes (0-1) */
  hubConcentration: number;
  /** files with zero relations */
  orphanFiles: number;
  /** weighted composite 0-100 */
  score: number;
}

interface PersistedState {
  lastScanTime: number | null;
  rootPath: string | null;
}

interface GraphStore extends PersistedState {
  nodes: FileNode[];
  relations: Relation[];
  stats: GraphStats | null;
  lastScanResult: Pick<ScanResult, 'totalFiles' | 'totalSymbols' | 'totalRelations' | 'durationMs'> | null;
  lastQueryResult: QueryResult | null;
  readiness: ReadinessMetrics | null;
  selectedNodeId: string | null;
  highlightIds: Set<string>;
  scanning: boolean;
  querying: boolean;
  error: string | null;

  // Actions
  scan: (rootPath: string) => Promise<void>;
  scanSources: (sources: Array<{ path: string; content: string }>) => Promise<void>;
  query: (text: string, tokenBudget?: number, taskType?: TaskType) => Promise<void>;
  fetchStatus: () => Promise<void>;
  selectNode: (id: string | null) => void;
  setHighlights: (ids: Set<string>) => void;
  computeReadiness: () => void;
  clearError: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectCycles(nodes: FileNode[], relations: Relation[]): number {
  // Build adjacency map for import relations only
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const r of relations) {
    if (r.kind === 'imports') {
      adj.get(r.sourceFile)?.push(r.targetFile);
    }
  }

  let cycles = 0;
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);

  function dfs(id: string): void {
    color.set(id, GRAY);
    for (const neighbor of adj.get(id) ?? []) {
      if (color.get(neighbor) === GRAY) {
        cycles++;
      } else if (color.get(neighbor) === WHITE) {
        dfs(neighbor);
      }
    }
    color.set(id, BLACK);
  }

  for (const n of nodes) {
    if (color.get(n.id) === WHITE) dfs(n.id);
  }

  return cycles;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGraphStore = create<GraphStore>()(
  persist(
    (set, get) => ({
      // State
      nodes: [],
      relations: [],
      stats: null,
      lastScanResult: null,
      lastQueryResult: null,
      readiness: null,
      selectedNodeId: null,
      highlightIds: new Set(),
      scanning: false,
      querying: false,
      error: null,
      lastScanTime: null,
      rootPath: null,

      // ── scan ────────────────────────────────────────────────────────────────

      scan: async (rootPath: string) => {
        set({ scanning: true, error: null });
        try {
          const scanResp = await fetch(`${API_BASE}/graph/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rootPath }),
          });
          const scanJson = await scanResp.json() as
            | { status: 'ok'; data: ScanResult }
            | { status: 'error'; error: string };

          if (scanJson.status !== 'ok') {
            throw new Error(scanJson.error);
          }

          const { totalFiles, totalSymbols, totalRelations, durationMs } = scanJson.data;

          // Fetch full graph data (nodes + relations) for visualization
          const dataResp = await fetch(`${API_BASE}/graph/data`);
          const dataJson = await dataResp.json() as
            | { status: 'ok'; data: { nodes: FileNode[]; relations: Relation[] } }
            | { status: 'error'; error: string };

          const graphNodes = dataJson.status === 'ok' ? dataJson.data.nodes : [];
          const graphRelations = dataJson.status === 'ok' ? dataJson.data.relations : [];

          set({
            nodes: graphNodes,
            relations: graphRelations,
            lastScanResult: { totalFiles, totalSymbols, totalRelations, durationMs },
            stats: { nodes: graphNodes.length, symbols: 0, relations: graphRelations.length },
            lastScanTime: Date.now(),
            rootPath,
            scanning: false,
          });

          get().computeReadiness();
        } catch (err) {
          set({ scanning: false, error: err instanceof Error ? err.message : String(err) });
        }
      },

      // ── scanSources — scan from pre-loaded content (any source) ────────────

      scanSources: async (sources: Array<{ path: string; content: string }>) => {
        set({ scanning: true, error: null });
        try {
          const scanResp = await fetch(`${API_BASE}/graph/scan-sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources }),
          });
          const scanJson = await scanResp.json() as
            | { status: 'ok'; data: ScanResult }
            | { status: 'error'; error: string };

          if (scanJson.status !== 'ok') throw new Error(scanJson.error);

          const { totalFiles, totalSymbols, totalRelations, durationMs } = scanJson.data;

          // Fetch full graph data for visualization
          const dataResp = await fetch(`${API_BASE}/graph/data`);
          const dataJson = await dataResp.json() as
            | { status: 'ok'; data: { nodes: FileNode[]; relations: Relation[] } }
            | { status: 'error'; error: string };

          const graphNodes = dataJson.status === 'ok' ? dataJson.data.nodes : [];
          const graphRelations = dataJson.status === 'ok' ? dataJson.data.relations : [];

          set({
            nodes: graphNodes,
            relations: graphRelations,
            lastScanResult: { totalFiles, totalSymbols, totalRelations, durationMs },
            stats: { nodes: graphNodes.length, symbols: 0, relations: graphRelations.length },
            lastScanTime: Date.now(),
            rootPath: '(all sources)',
            scanning: false,
          });

          get().computeReadiness();
        } catch (err) {
          set({ scanning: false, error: err instanceof Error ? err.message : String(err) });
        }
      },

      // ── query ───────────────────────────────────────────────────────────────

      query: async (text: string, tokenBudget?: number, taskType?: TaskType) => {
        set({ querying: true, error: null });
        try {
          const resp = await fetch(`${API_BASE}/graph/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text, tokenBudget, taskType }),
          });
          const json = await resp.json() as
            | { status: 'ok'; data: QueryResult }
            | { status: 'error'; error: string };

          if (json.status !== 'ok') {
            throw new Error(json.error);
          }

          const highlightIds = new Set(json.data.entryPoints.map(ep => ep.fileId));

          set({
            lastQueryResult: json.data,
            highlightIds,
            querying: false,
          });
        } catch (err) {
          set({ querying: false, error: err instanceof Error ? err.message : String(err) });
        }
      },

      // ── fetchStatus ─────────────────────────────────────────────────────────

      fetchStatus: async () => {
        try {
          const resp = await fetch(`${API_BASE}/graph/status`);
          const json = await resp.json() as
            | { status: 'ok'; data: GraphStats }
            | { status: 'error'; error: string };

          if (json.status === 'ok') {
            set({ stats: json.data });
          }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      // ── selectNode ──────────────────────────────────────────────────────────

      selectNode: (id: string | null) => set({ selectedNodeId: id }),

      // ── setHighlights ───────────────────────────────────────────────────────

      setHighlights: (ids: Set<string>) => set({ highlightIds: ids }),

      // ── computeReadiness ────────────────────────────────────────────────────

      computeReadiness: () => {
        const { nodes, relations } = get();
        if (nodes.length === 0) {
          set({ readiness: null });
          return;
        }

        // Files that participate in at least one relation
        const connectedIds = new Set<string>();
        for (const r of relations) {
          connectedIds.add(r.sourceFile);
          connectedIds.add(r.targetFile);
        }
        const coverage = nodes.length > 0 ? connectedIds.size / nodes.length : 0;

        // Non-test source files with tested_by relation
        const nonTestFiles = nodes.filter(n =>
          !n.path.includes('.test.') && !n.path.includes('.spec.') && !n.path.includes('__tests__')
        );
        const testedIds = new Set(
          relations.filter(r => r.kind === 'tested_by').map(r => r.sourceFile)
        );
        const testCoupling = nonTestFiles.length > 0
          ? nonTestFiles.filter(n => testedIds.has(n.id)).length / nonTestFiles.length
          : 0;

        // Directories with documents relation
        const allDirs = new Set(nodes.map(n => n.path.split('/').slice(0, -1).join('/')));
        const docSourcePaths = new Set(
          relations
            .filter(r => r.kind === 'documents')
            .map(r => {
              const node = nodes.find(n => n.id === r.sourceFile);
              return node?.path.split('/').slice(0, -1).join('/') ?? '';
            })
        );
        const docCoupling = allDirs.size > 0 ? docSourcePaths.size / allDirs.size : 0;

        // Import cycles (DFS)
        const circularDeps = detectCycles(nodes, relations);

        // Hub concentration: max fan-in / total nodes
        const fanIn = new Map<string, number>();
        for (const r of relations) {
          if (r.kind === 'imports') {
            fanIn.set(r.targetFile, (fanIn.get(r.targetFile) ?? 0) + 1);
          }
        }
        const maxFanIn = fanIn.size > 0 ? Math.max(...Array.from(fanIn.values())) : 0;
        const hubConcentration = nodes.length > 0 ? maxFanIn / nodes.length : 0;

        // Orphan files (zero relations)
        const orphanFiles = nodes.filter(n => !connectedIds.has(n.id)).length;

        // Weighted score 0-100
        // coverage (30%), testCoupling (25%), docCoupling (15%),
        // penalize circularDeps (-5 each, max -20), hubConcentration penalty (-10),
        // orphan ratio penalty (-20)
        const orphanPenalty = nodes.length > 0 ? (orphanFiles / nodes.length) * 20 : 0;
        const cyclePenalty = Math.min(circularDeps * 5, 20);
        const hubPenalty = hubConcentration * 10;
        const raw =
          coverage * 30 +
          testCoupling * 25 +
          docCoupling * 15 +
          30 - orphanPenalty - cyclePenalty - hubPenalty;
        const score = Math.max(0, Math.min(100, Math.round(raw)));

        set({
          readiness: {
            coverage,
            testCoupling,
            docCoupling,
            circularDeps,
            hubConcentration,
            orphanFiles,
            score,
          },
        });
      },

      // ── clearError ──────────────────────────────────────────────────────────

      clearError: () => set({ error: null }),
    }),
    {
      name: 'modular-graph-store',
      partialize: (state) => ({
        lastScanTime: state.lastScanTime,
        rootPath: state.rootPath,
      }),
    }
  )
);
