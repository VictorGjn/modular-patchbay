/**
 * Memory Store — filesystem-backed memory persistence.
 *
 * Stores memories as JSON files organized by type.
 * Supports CRUD, extraction, team sync, and consolidation.
 */

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type MemoryType = 'decision' | 'pattern' | 'gotcha' | 'preference' | 'learning';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  source: string;
  project?: string;
  tags: string[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
}

const MEMORY_TYPES: MemoryType[] = ['decision', 'pattern', 'gotcha', 'preference', 'learning'];

export class MemoryStore {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.ensureDirs();
  }

  private ensureDirs(): void {
    const dirs = [
      this.basePath,
      join(this.basePath, 'project'),
      join(this.basePath, 'agents'),
      join(this.basePath, 'team'),
    ];
    for (const d of dirs) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
    }
  }

  private filePath(type: MemoryType): string {
    return join(this.basePath, 'project', `${type}s.json`);
  }

  private loadFile(type: MemoryType): Memory[] {
    const fp = this.filePath(type);
    if (!existsSync(fp)) return [];
    try {
      return JSON.parse(readFileSync(fp, 'utf-8'));
    } catch { return []; }
  }

  private saveFile(type: MemoryType, memories: Memory[]): void {
    writeFileSync(this.filePath(type), JSON.stringify(memories, null, 2));
  }

  save(input: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>): Memory {
    const now = new Date().toISOString();
    const memory: Memory = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };
    const all = this.loadFile(memory.type);
    all.push(memory);
    this.saveFile(memory.type, all);
    return memory;
  }

  get(id: string): Memory | null {
    for (const type of MEMORY_TYPES) {
      const all = this.loadFile(type);
      const found = all.find(m => m.id === id);
      if (found) {
        found.accessCount++;
        this.saveFile(type, all);
        return found;
      }
    }
    return null;
  }

  search(query: string, limit = 10): Memory[] {
    const terms = query.toLowerCase().split(/\s+/);
    const all: Memory[] = [];
    for (const type of MEMORY_TYPES) {
      all.push(...this.loadFile(type));
    }
    const scored = all.map(m => {
      const text = `${m.content} ${m.tags.join(' ')} ${m.project || ''}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
      return { memory: m, score };
    }).filter(s => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.memory);
  }

  update(id: string, updates: Partial<Memory>): Memory {
    for (const type of MEMORY_TYPES) {
      const all = this.loadFile(type);
      const idx = all.findIndex(m => m.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
        this.saveFile(type, all);
        return all[idx];
      }
    }
    throw new Error(`Memory ${id} not found`);
  }

  delete(id: string): void {
    for (const type of MEMORY_TYPES) {
      const all = this.loadFile(type);
      const idx = all.findIndex(m => m.id === id);
      if (idx !== -1) {
        all.splice(idx, 1);
        this.saveFile(type, all);
        return;
      }
    }
  }

  extractFromAgentOutput(agentId: string, output: string): Memory[] {
    const extractor = new MemoryExtractor();
    const extracted = extractor.extract(output);
    return extracted.map(e => this.save({ ...e, source: agentId }));
  }

  exportForTeam(): Memory[] {
    const all: Memory[] = [];
    for (const type of MEMORY_TYPES) {
      all.push(...this.loadFile(type));
    }
    return all.filter(m => m.confidence >= 0.7);
  }

  importFromTeam(memories: Memory[]): void {
    for (const m of memories) {
      const existing = this.loadFile(m.type);
      if (!existing.find(e => e.id === m.id)) {
        existing.push(m);
        this.saveFile(m.type, existing);
      }
    }
  }

  consolidate(): { merged: number; pruned: number; new: number } {
    let merged = 0, pruned = 0;
    for (const type of MEMORY_TYPES) {
      const all = this.loadFile(type);

      // Prune low-confidence, never-accessed memories
      const kept = all.filter(m => {
        if (m.confidence < 0.3 && m.accessCount === 0) { pruned++; return false; }
        return true;
      });

      // Simple dedup: merge memories with >80% content overlap
      const deduped: Memory[] = [];
      for (const m of kept) {
        const dup = deduped.find(d => this.similarity(d.content, m.content) > 0.8);
        if (dup) {
          dup.confidence = Math.max(dup.confidence, m.confidence);
          dup.accessCount += m.accessCount;
          dup.tags = [...new Set([...dup.tags, ...m.tags])];
          merged++;
        } else {
          deduped.push(m);
        }
      }
      this.saveFile(type, deduped);
    }
    return { merged, pruned, new: 0 };
  }

  private similarity(a: string, b: string): number {
    const wa = new Set(a.toLowerCase().split(/\s+/));
    const wb = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wa].filter(w => wb.has(w)).length;
    return intersection / Math.max(wa.size, wb.size);
  }
}

export interface ExtractedMemory {
  type: MemoryType;
  content: string;
  tags: string[];
  confidence: number;
  project?: string;
}

export class MemoryExtractor {
  private patterns: { regex: RegExp; type: MemoryType; confidence: number }[] = [
    { regex: /(?:decided|decision|chose|we\s+went\s+with)\s*[:.]\s*(.+)/gi, type: 'decision', confidence: 0.8 },
    { regex: /(?:pattern|recurring|always|every\s+time)\s*[:.]\s*(.+)/gi, type: 'pattern', confidence: 0.7 },
    { regex: /(?:gotcha|watch\s+out|careful|caveat|pitfall)\s*[:.]\s*(.+)/gi, type: 'gotcha', confidence: 0.9 },
    { regex: /(?:prefer|preference|like\s+to|always\s+use)\s*[:.]\s*(.+)/gi, type: 'preference', confidence: 0.6 },
    { regex: /(?:learned|lesson|takeaway|insight|TIL)\s*[:.]\s*(.+)/gi, type: 'learning', confidence: 0.7 },
  ];

  extract(text: string): ExtractedMemory[] {
    const results: ExtractedMemory[] = [];
    for (const { regex, type, confidence } of this.patterns) {
      const re = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = re.exec(text)) !== null) {
        const content = match[1]?.trim();
        if (content && content.length > 5) {
          results.push({
            type,
            content,
            tags: this.extractTags(content),
            confidence,
          });
        }
      }
    }
    return results;
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const techTerms = text.match(/\b(?:React|TypeScript|Node|API|SQL|Docker|AWS|Python|Rust|Go)\b/gi);
    if (techTerms) tags.push(...techTerms.map(t => t.toLowerCase()));
    return [...new Set(tags)];
  }
}
