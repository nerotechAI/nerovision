import path from 'node:path';
import { createRequire } from 'node:module';
import { dataDir } from './paths';
import { ensureDir } from './fsutil';

// node:sqlite is built into Node >= 22.13 (no native build step, works on Windows).
// It still prints an ExperimentalWarning on some versions; silence only that one warning.
const origEmit = process.emitWarning.bind(process);
(process as { emitWarning: typeof process.emitWarning }).emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const msg = typeof warning === 'string' ? warning : warning?.message;
  if (msg && msg.includes('SQLite')) return;
  return (origEmit as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

const require = createRequire(import.meta.url);
type DatabaseSyncT = import('node:sqlite').DatabaseSync;

let db: DatabaseSyncT | null = null;

export function openDb(file = path.join(dataDir(), 'nero.sqlite')): DatabaseSyncT {
  if (db) return db;
  let sqlite: typeof import('node:sqlite');
  try {
    sqlite = require('node:sqlite');
  } catch {
    throw new Error(`node:sqlite is unavailable in Node ${process.version}. Nero Vision Studio needs Node >= 22.13.`);
  }
  if (file !== ':memory:') ensureDir(path.dirname(file));
  db = new sqlite.DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      params TEXT NOT NULL,
      status TEXT NOT NULL,
      stage TEXT,
      progress REAL NOT NULL DEFAULT 0,
      message TEXT,
      error TEXT,
      outputs TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS jobs_project ON jobs(project_id);
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      sha256 TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS assets_sha ON assets(sha256);
  `);
  return db;
}

/** For tests. */
export function closeDb(): void {
  db?.close();
  db = null;
}
