/**
 * Context Graph — SQLite Storage
 *
 * Local-first graph storage with FTS5 for symbol search.
 * Uses sql.js (WASM SQLite) for browser compatibility.
 */

import type { FileNode, Relation, SymbolDef, ContextGraph } from './types.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS file_nodes (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  last_modified INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  tokens INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL REFERENCES file_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  is_exported INTEGER NOT NULL DEFAULT 0,
  doc TEXT,
  tokens INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL REFERENCES file_nodes(id) ON DELETE CASCADE,
  source_symbol TEXT,
  target_file TEXT NOT NULL REFERENCES file_nodes(id) ON DELETE CASCADE,
  target_symbol TEXT,
  kind TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_file);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_file);
CREATE INDEX IF NOT EXISTS idx_relations_kind ON relations(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_file_nodes_path ON file_nodes(path);
`;

// ── In-Memory Implementation ──────────────────────────────────────────────────
// Uses plain Maps for fast access. Can be backed by SQLite for persistence.

export class GraphDB {
  private nodes = new Map<string, FileNode>();
  private relations: Relation[] = [];
  private symbolsByFile = new Map<string, SymbolDef[]>();
  private symbolNameIndex = new Map<string, Set<string>>(); // name → file IDs
  private outgoing = new Map<string, Relation[]>();
  private incoming = new Map<string, Relation[]>();

  /** Get the SQL schema for SQLite persistence */
  static getSchema(): string { return SCHEMA; }

  // ── Node Operations ──────────────────────────────────────────────────────

  upsertNode(node: FileNode): void {
    this.nodes.set(node.id, node);
    this.symbolsByFile.set(node.id, node.symbols);

    // Update symbol name index
    for (const sym of node.symbols) {
      let files = this.symbolNameIndex.get(sym.name);
      if (!files) { files = new Set(); this.symbolNameIndex.set(sym.name, files); }
      files.add(node.id);
    }
  }

  getNode(id: string): FileNode | undefined {
    return this.nodes.get(id);
  }

  getNodeByPath(path: string): FileNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.path === path) return node;
    }
    return undefined;
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove from symbol index
    for (const sym of node.symbols) {
      const files = this.symbolNameIndex.get(sym.name);
      if (files) {
        files.delete(id);
        if (files.size === 0) this.symbolNameIndex.delete(sym.name);
      }
    }

    // Remove relations
    this.relations = this.relations.filter(
      r => r.sourceFile !== id && r.targetFile !== id
    );
    this.outgoing.delete(id);
    this.incoming.delete(id);
    this.rebuildRelationIndexes();

    this.symbolsByFile.delete(id);
    this.nodes.delete(id);
  }

  getAllNodes(): FileNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  // ── Relation Operations ───────────────────────────────────────────────────

  addRelation(rel: Relation): void {
    // Deduplicate: same source+target+kind
    const exists = this.relations.some(
      r => r.sourceFile === rel.sourceFile &&
           r.targetFile === rel.targetFile &&
           r.kind === rel.kind &&
           r.sourceSymbol === rel.sourceSymbol &&
           r.targetSymbol === rel.targetSymbol
    );
    if (exists) return;

    this.relations.push(rel);

    // Update indexes
    const out = this.outgoing.get(rel.sourceFile) ?? [];
    out.push(rel);
    this.outgoing.set(rel.sourceFile, out);

    const inc = this.incoming.get(rel.targetFile) ?? [];
    inc.push(rel);
    this.incoming.set(rel.targetFile, inc);
  }

  addRelations(rels: Relation[]): void {
    for (const r of rels) this.addRelation(r);
  }

  removeRelationsForSource(fileId: string): number {
    const before = this.relations.length;
    this.relations = this.relations.filter(r => r.sourceFile !== fileId);
    this.rebuildRelationIndexes();
    return before - this.relations.length;
  }

  getOutgoing(fileId: string): Relation[] {
    return this.outgoing.get(fileId) ?? [];
  }

  getIncoming(fileId: string): Relation[] {
    return this.incoming.get(fileId) ?? [];
  }

  getAllRelations(): Relation[] {
    return this.relations;
  }

  getRelationCount(): number {
    return this.relations.length;
  }

  // ── Symbol Lookup ─────────────────────────────────────────────────────────

  findFilesBySymbol(symbolName: string): FileNode[] {
    const fileIds = this.symbolNameIndex.get(symbolName);
    if (!fileIds) return [];
    return Array.from(fileIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is FileNode => n !== undefined);
  }

  searchSymbols(query: string): Array<{ symbol: SymbolDef; file: FileNode }> {
    const q = query.toLowerCase();
    const results: Array<{ symbol: SymbolDef; file: FileNode }> = [];

    for (const [fileId, symbols] of this.symbolsByFile) {
      for (const sym of symbols) {
        if (sym.name.toLowerCase().includes(q)) {
          const file = this.nodes.get(fileId);
          if (file) results.push({ symbol: sym, file });
        }
      }
    }

    return results.sort((a, b) => {
      // Exact match first, then prefix, then contains
      const aExact = a.symbol.name.toLowerCase() === q ? 0 : 1;
      const bExact = b.symbol.name.toLowerCase() === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aPrefix = a.symbol.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.symbol.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix;
    });
  }

  getSymbolIndex(): Map<string, FileNode[]> {
    const index = new Map<string, FileNode[]>();
    for (const [name, fileIds] of this.symbolNameIndex) {
      const files = Array.from(fileIds)
        .map(id => this.nodes.get(id))
        .filter((n): n is FileNode => n !== undefined);
      if (files.length > 0) index.set(name, files);
    }
    return index;
  }

  // ── Graph Assembly ────────────────────────────────────────────────────────

  toContextGraph(rootPath: string): ContextGraph {
    return {
      nodes: new Map(this.nodes),
      relations: [...this.relations],
      outgoing: new Map(this.outgoing.entries()),
      incoming: new Map(this.incoming.entries()),
      symbolIndex: this.getSymbolIndex(),
      rootPath,
      lastFullScan: Date.now(),
      version: 1,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats(): { nodes: number; symbols: number; relations: number } {
    let symbolCount = 0;
    for (const syms of this.symbolsByFile.values()) symbolCount += syms.length;
    return {
      nodes: this.nodes.size,
      symbols: symbolCount,
      relations: this.relations.length,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private rebuildRelationIndexes(): void {
    this.outgoing.clear();
    this.incoming.clear();
    for (const rel of this.relations) {
      const out = this.outgoing.get(rel.sourceFile) ?? [];
      out.push(rel);
      this.outgoing.set(rel.sourceFile, out);

      const inc = this.incoming.get(rel.targetFile) ?? [];
      inc.push(rel);
      this.incoming.set(rel.targetFile, inc);
    }
  }

  /** Clear all data */
  clear(): void {
    this.nodes.clear();
    this.relations = [];
    this.symbolsByFile.clear();
    this.symbolNameIndex.clear();
    this.outgoing.clear();
    this.incoming.clear();
  }
}
