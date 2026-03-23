/**
 * Database migration system for Modular Studio.
 * Tracks schema version and runs pending migrations on startup.
 */
import type { Database } from 'sql.js';

interface Migration {
  version: number;
  description: string;
  up: (db: Database) => void;
}

/** All migrations ordered by version number */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema (baseline)',
    // Version 1 is the baseline — tables are created by sqliteStore.ts initDb().
    // This migration just marks the schema as versioned.
    up: (_db) => { /* no-op: tables already created by initDb */ },
  },
];

const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** Ensure the schema_version tracking table exists */
function ensureVersionTable(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

/** Get the currently applied schema version (0 if none) */
function getCurrentVersion(db: Database): number {
  try {
    const result = db.exec(`SELECT MAX(version) as v FROM schema_version`);
    if (result.length === 0 || result[0]!.values.length === 0) return 0;
    const v = result[0]!.values[0]![0];
    return typeof v === 'number' ? v : 0;
  } catch {
    return 0;
  }
}

/**
 * Run all pending migrations on the given database.
 * Called once during server startup after initDb().
 */
export function runMigrations(db: Database): void {
  ensureVersionTable(db);
  const currentVersion = getCurrentVersion(db);

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    console.log(`[DB] Schema up-to-date (v${currentVersion})`);
    return;
  }

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  console.log(`[DB] Running ${pending.length} migration(s) (v${currentVersion} → v${CURRENT_SCHEMA_VERSION})`);

  for (const migration of pending) {
    try {
      migration.up(db);
      db.run(`INSERT INTO schema_version (version) VALUES (?)`, [migration.version]);
      console.log(`[DB] Applied migration v${migration.version}: ${migration.description}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[DB] Migration v${migration.version} failed: ${msg}`);
      throw err;
    }
  }
}
