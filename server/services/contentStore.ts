import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONTENT_DIR = join(homedir(), '.modular-studio', 'content');

export interface ContentRepoMeta {
  name: string;
  stack: string[] | Record<string, string>;
  totalFiles: number;
  totalTokens: number;
  baseUrl?: string;
  features: { name: string; keyFiles: string[] }[];
}

export interface StoredContent {
  sourceId: string;
  name: string;
  overviewMarkdown: string;
  knowledgeDocs: Record<string, string>;
  repoMeta: ContentRepoMeta;
}

export interface ContentListItem {
  sourceId: string;
  name: string;
  repoMeta: ContentRepoMeta;
}

function ensureDir(): void {
  if (!existsSync(CONTENT_DIR)) {
    mkdirSync(CONTENT_DIR, { recursive: true, mode: 0o755 });
  }
}

function filePath(sourceId: string): string {
  return join(CONTENT_DIR, `${sourceId}.json`);
}

export function saveContent(sourceId: string, data: Omit<StoredContent, 'sourceId'>): void {
  ensureDir();
  const record: StoredContent = { sourceId, ...data };
  writeFileSync(filePath(sourceId), JSON.stringify(record, null, 2), 'utf-8');
}

export function loadContent(sourceId: string): StoredContent | null {
  const fp = filePath(sourceId);
  if (!existsSync(fp)) return null;
  try {
    return JSON.parse(readFileSync(fp, 'utf-8')) as StoredContent;
  } catch {
    return null;
  }
}

export function listContent(): ContentListItem[] {
  ensureDir();
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
  const items: ContentListItem[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(readFileSync(join(CONTENT_DIR, f), 'utf-8')) as StoredContent;
      items.push({ sourceId: raw.sourceId, name: raw.name, repoMeta: raw.repoMeta });
    } catch {
      // skip corrupt files
    }
  }
  return items;
}

export function deleteContent(sourceId: string): boolean {
  const fp = filePath(sourceId);
  if (!existsSync(fp)) return false;
  try {
    unlinkSync(fp);
    return true;
  } catch {
    return false;
  }
}

/** Derive a deterministic sourceId from a GitHub URL */
export function githubSourceId(url: string): string {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (match) return `github-${match[1]}-${match[2]}`.toLowerCase();
  return `github-${url.replace(/[^a-zA-Z0-9-]/g, '-')}`.toLowerCase();
}

/** Derive a deterministic sourceId from a local path */
export function localSourceId(repoPath: string): string {
  const sanitized = repoPath.replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `local-${sanitized}`.toLowerCase();
}
