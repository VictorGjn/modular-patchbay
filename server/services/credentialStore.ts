/**
 * Persistent credential store for connector API keys.
 * Stores in ~/.modular-studio/credentials.json — encrypted at rest with AES-256-GCM.
 * Encryption key is a random 32-byte secret in ~/.modular-studio/.secret (created on first run).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const DIR = join(homedir(), '.modular-studio');
const CRED_PATH = join(DIR, 'credentials.json');
const SECRET_PATH = join(DIR, '.secret');
const ALGORITHM = 'aes-256-gcm';

// ── Encryption key ────────────────────────────────────────────────────────────

function getOrCreateKey(): Buffer {
  if (existsSync(SECRET_PATH)) {
    const raw = readFileSync(SECRET_PATH);
    if (raw.length === 32) return raw;
  }
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const key = randomBytes(32);
  writeFileSync(SECRET_PATH, key, { mode: 0o600 });
  return key;
}

// ── Per-value encrypt / decrypt ───────────────────────────────────────────────

function encryptValue(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Encode as "iv_b64:tag_b64:ciphertext_b64"
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptValue(encoded: string, key: Buffer): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted credential format');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf-8') + decipher.final('utf-8');
}

// ── Disk format ───────────────────────────────────────────────────────────────
// { "__v": 2, "service": "iv:tag:ct", ... }
// Legacy format (no __v): plaintext values — migrated automatically on first load.

interface StoredFile {
  __v?: number;
  [service: string]: string | number | undefined;
}

let cache: Record<string, string> | null = null; // in-memory plaintext cache
let keyCache: Buffer | null = null;

function getKey(): Buffer {
  if (!keyCache) keyCache = getOrCreateKey();
  return keyCache;
}

function load(): Record<string, string> {
  if (cache) return cache;

  cache = {};

  if (!existsSync(CRED_PATH)) return cache;

  let raw: StoredFile;
  try {
    raw = JSON.parse(readFileSync(CRED_PATH, 'utf-8')) as StoredFile;
  } catch {
    console.warn('[CredentialStore] Failed to parse credentials file, starting fresh');
    return cache;
  }

  const key = getKey();
  const isEncrypted = raw.__v === 2;

  for (const [svc, val] of Object.entries(raw)) {
    if (svc === '__v' || typeof val !== 'string') continue;
    if (isEncrypted) {
      try {
        cache[svc] = decryptValue(val, key);
      } catch {
        console.warn(`[CredentialStore] Failed to decrypt credential for "${svc}", skipping`);
      }
    } else {
      // Legacy plaintext — keep as-is in cache; will be re-encrypted on next save
      cache[svc] = val;
    }
  }

  // Migrate plaintext → encrypted on load
  if (!isEncrypted && Object.keys(cache).length > 0) {
    persistToDisk(cache, key);
  }

  return cache;
}

function persistToDisk(store: Record<string, string>, key: Buffer): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const file: StoredFile = { __v: 2 };
  for (const [svc, val] of Object.entries(store)) {
    file[svc] = encryptValue(val, key);
  }
  writeFileSync(CRED_PATH, JSON.stringify(file, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

function save(): void {
  if (!cache) return;
  persistToDisk(cache, getKey());
}

// ── Public API ────────────────────────────────────────────────────────────────

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
