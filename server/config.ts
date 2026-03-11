import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AppConfig } from './types.js';

const CONFIG_DIR = join(homedir(), '.modular-studio');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  providers: [],
  mcpServers: [],
};

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o755 });
  }
}

export function readConfig(): AppConfig {
  ensureDir();
  if (!existsSync(CONFIG_PATH)) {
    writeConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as AppConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(config: AppConfig): void {
  ensureDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
