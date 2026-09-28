/**
 * Versioned schema migrations (production-debt item #11).
 *
 * Replaces ad-hoc per-boot "CREATE TABLE IF NOT EXISTS" patching with an
 * ordered, recorded migration list. Each migration runs exactly once, inside
 * a transaction, and its application is recorded in `schema_migrations`.
 *
 * History:
 *  001 baseline            — the schema as shipped through the video-evidence
 *                            pass (tables, indexes, sync_log cleanup, the
 *                            drafted_by rebuild, voice/video columns).
 *  002 drop sync_log legacy — explicit drop of the never-used sync_log table
 *                            for databases that predate 001.
 *  003 llm usage metering  — llm_usage table (#17).
 *
 * The legacy createSchema() remains as the CREATE IF NOT EXISTS bootstrap so
 * brand-new databases get 001's shape directly; the migration runner then
 * records 001 as applied without re-running DDL. Existing databases keep
 * every per-boot migration's effects and just start their recorded history
 * at 001. Both worlds converge on identical schema + identical history.
 */
import type BetterSqlite3 from "better-sqlite3";

export interface Migration {
  id: number;
  name: string;
  /** Must be idempotent-safe to run inside the runner's transaction. */
  up: (db: BetterSqlite3.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "baseline_schema",
    // DDL already applied by createSchema() for fresh DBs; recorded here so
    // every database shares one migration history from birth.
    up: () => {},
  },
  {
    id: 2,
    name: "drop_sync_log_legacy",
    up: (db) => {
      db.exec(`DROP TABLE IF EXISTS sync_log;`);
    },
  },
  {
    id: 3,
    name: "llm_usage_metering",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS llm_usage (
          id TEXT PRIMARY KEY,
          artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('task_generation', 'evidence_analysis', 'feedback_draft')),
          artifact_id TEXT NOT NULL,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          model TEXT,
          recorded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_llm_usage_artifact ON llm_usage(artifact_kind, artifact_id);
        CREATE INDEX IF NOT EXISTS idx_llm_usage_time ON llm_usage(recorded_at);
      `);
    },
  },
];

/**
 * Applies all pending migrations in order. Each migration is transactional;
 * the schema_migrations bookkeeping row commits with it, so a crash mid-run
 * leaves no half-applied migration behind.
 */
export function runMigrations(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare(`SELECT id FROM schema_migrations`).all() as Array<{ id: number }>).map((r) => r.id)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare(`INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)`).run(
        migration.id,
        migration.name,
        new Date().toISOString()
      );
    });
    apply();
  }
}
