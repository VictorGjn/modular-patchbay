import type { Node, Edge } from '@xyflow/react';
import type { ModuleConfig } from '../store/moduleDefinitions';

export interface PatchFile {
  version: 1;
  nodes: Node[];
  edges: Edge[];
  moduleConfigs: Record<string, ModuleConfig>;
}

export function exportPatch(
  nodes: Node[],
  edges: Edge[],
  moduleConfigs: Record<string, ModuleConfig>,
): string {
  const patch: PatchFile = { version: 1, nodes, edges, moduleConfigs };
  return JSON.stringify(patch, null, 2);
}

export function importPatch(json: string): PatchFile {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !('nodes' in parsed) ||
    !('edges' in parsed)
  ) {
    throw new Error('Invalid patch file format');
  }
  return parsed as PatchFile;
}

const STORAGE_KEY = 'modular-patchbay-state';

export function saveToLocalStorage(
  nodes: Node[],
  edges: Edge[],
  moduleConfigs: Record<string, ModuleConfig>,
): void {
  try {
    localStorage.setItem(STORAGE_KEY, exportPatch(nodes, edges, moduleConfigs));
  } catch {
    // Storage full or unavailable
  }
}

export function loadFromLocalStorage(): PatchFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return importPatch(raw);
  } catch {
    return null;
  }
}

export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
