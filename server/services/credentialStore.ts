/**
 * Persistent credential store for connector API keys.
 * Stores in ~/.modular-studio/credentials.json (plaintext for now — encrypt TODO).
 * Survives server restarts, unlike the in-memory sessionKeys maps.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DIR = join(homedir(), '.modular-studio');
const CRED_PATH = join(DIR, 'credentials.json');

let cache: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (cache) return cache;
  try {
    if (existsSync(CRED_PATH)) {
      cache = JSON.parse(readFileSync(CRED_PATH, 'utf-8'));
      return cache!;
    }
  } catch {
    console.warn('[CredentialStore] Failed to load, starting fresh');
  }
  cache = {};
  return cache;
}

function save(): void {
  if (!cache) return;
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(CRED_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

export function getCredential(service: string): string | null {
  const store = load();
  return store[service] ?? null;
}

export function setCredential(service: string, value: string): void {
  const store = load();
  store[service] = value;
  save();
}

export function deleteCredential(service: string): void {
  const store = load();
  delete store[service];
  save();
}

export function listCredentials(): string[] {
  return Object.keys(load());
}
