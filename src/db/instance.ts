import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createSchema } from "./schema";
import { runMigrations } from "./migrations";

export type Db = Database.Database;

let db: Db | null = null;

/**
 * Opens the shared SQLite database (WAL mode) and applies the schema.
 * Safe to call repeatedly — the first caller wins, others get the handle.
 * (schema.ts imports this module for types only, so there is no runtime cycle.)
 */
export function getDb(): Db {
  if (db) return db;
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "classroom-loop.db");
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  runMigrations(db);
  return db;
}

/** Test/dev helper: wipes the singleton so a fresh DB is created. */
export function resetDbForTests(): void {
  db = null;
}
