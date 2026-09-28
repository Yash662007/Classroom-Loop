import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getDb, resetDbForTests } from "@/db/instance";
import { sweepExpiredUploads } from "@/lib/retention";

/**
 * Each test gets a throwaway DATA_DIR containing both the SQLite database and
 * the uploads tree, mirroring the production layout.
 */
let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "classroom-loop-retention-"));
  process.env.DATA_DIR = dataDir;
  delete process.env.EVIDENCE_RETENTION_DAYS;
  resetDbForTests();
  mkdirSync(path.join(dataDir, "uploads", "user-1"), { recursive: true });
  getDb(); // create schema up front
});
afterAll(() => {
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Windows may keep handles open; the OS temp dir reclaims it.
  }
});

/** One evidence row pointing at one photo on disk. */
function seedEvidenceWithPhoto(rel: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash, is_demo, created_at) VALUES ('user-1', 'u@t.demo', 'U', 'teacher', 'x', 0, ?)`
  ).run(now);
  db.prepare(`INSERT INTO competencies (id, title, description, created_at) VALUES ('comp-1', 'T', 'd', ?)`).run(now);
  getDb()
    .prepare(
      `INSERT INTO implementation_tasks (id, user_id, competency_id, attempt_number, status, title, activity, practice_scenario, scenario_choices, recommended_choice, difficulty, micro_learning, support, reasoning, generated_by, personalization_snapshot, created_at)
       VALUES ('task-1', 'user-1', 'comp-1', 1, 'completed', 'T', 'A', 'S', '[]', NULL, 'core', '[]', NULL, NULL, 'local_engine', '{}', ?)`
    )
    .run(new Date().toISOString());
  getDb()
    .prepare(
      `INSERT INTO evidence_submissions (id, user_id, task_id, attempt_number, reflection, checklist, photo_path, status, submitted_at)
       VALUES ('ev-1', 'user-1', 'task-1', 1, 'reflection', '{}', ?, 'submitted', ?)`
    )
    .run(rel, new Date().toISOString());
}

function uploads(): string[] {
  const dir = path.join(dataDir, "uploads", "user-1");
  return existsSync(dir) ? readdirSync(dir) : [];
}

describe("retention sweeper", () => {
  it("is a verified no-op when EVIDENCE_RETENTION_DAYS is unset", () => {
    writeFileSync(path.join(dataDir, "uploads", "user-1", "a.jpg"), "x");
    const result = sweepExpiredUploads();
    expect(result.enabled).toBe(false);
    expect(result.deletedFiles).toBe(0);
    expect(uploads()).toHaveLength(1);
  });

  it("is a no-op when EVIDENCE_RETENTION_DAYS=0 (explicitly disabled)", () => {
    process.env.EVIDENCE_RETENTION_DAYS = "0";
    writeFileSync(path.join(dataDir, "uploads", "user-1", "a.jpg"), "x");
    const result = sweepExpiredUploads();
    expect(result.enabled).toBe(false);
    expect(result.skippedReason).toMatch(/explicitly disabled/);
    expect(uploads()).toHaveLength(1);
  });

  it("treats garbage values as disabled rather than wiping everything", () => {
    process.env.EVIDENCE_RETENTION_DAYS = "banana";
    writeFileSync(path.join(dataDir, "uploads", "user-1", "a.jpg"), "x");
    const result = sweepExpiredUploads();
    expect(result.enabled).toBe(false);
    expect(uploads()).toHaveLength(1);
  });

  it("deletes expired files and nulls the evidence reference", () => {
    process.env.EVIDENCE_RETENTION_DAYS = "30";
    const rel = path.join("user-1", "old.jpg");
    const abs = path.join(dataDir, "uploads", rel);
    writeFileSync(abs, "old photo bytes");
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    utimesSync(abs, old, old);
    seedEvidenceWithPhoto(rel);

    const result = sweepExpiredUploads();
    expect(result.enabled).toBe(true);
    expect(result.deletedFiles).toBe(1);
    expect(result.nulledRefs).toBe(1);
    expect(existsSync(abs)).toBe(false);

    const row = getDb().prepare(`SELECT photo_path FROM evidence_submissions WHERE id = 'ev-1'`).get() as {
      photo_path: string | null;
    };
    expect(row.photo_path).toBeNull();
  });

  it("keeps recent files and their references intact", () => {
    process.env.EVIDENCE_RETENTION_DAYS = "30";
    const rel = path.join("user-1", "fresh.jpg");
    writeFileSync(path.join(dataDir, "uploads", rel), "fresh bytes");
    seedEvidenceWithPhoto(rel);

    const result = sweepExpiredUploads();
    expect(result.deletedFiles).toBe(0);
    expect(result.nulledRefs).toBe(0);
    expect(uploads()).toContain("fresh.jpg");

    const row = getDb().prepare(`SELECT photo_path FROM evidence_submissions WHERE id = 'ev-1'`).get() as {
      photo_path: string;
    };
    expect(row.photo_path).toBe(rel);
  });

  it("sweeps only files older than the window when both old and new exist", () => {
    process.env.EVIDENCE_RETENTION_DAYS = "30";
    const oldRel = path.join("user-1", "old.jpg");
    const newRel = path.join("user-1", "new.jpg");
    const oldAbs = path.join(dataDir, "uploads", oldRel);
    writeFileSync(oldAbs, "old");
    writeFileSync(path.join(dataDir, "uploads", newRel), "new");
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    utimesSync(oldAbs, old, old);
    seedEvidenceWithPhoto(oldRel);

    const result = sweepExpiredUploads();
    expect(result.deletedFiles).toBe(1);
    expect(uploads()).toEqual(["new.jpg"]);
  });

  it("never deletes anything when the uploads directory does not exist", () => {
    process.env.EVIDENCE_RETENTION_DAYS = "30";
    rmSync(path.join(dataDir, "uploads"), { recursive: true, force: true });
    const result = sweepExpiredUploads();
    expect(result).toEqual({ enabled: true, deletedFiles: 0, nulledRefs: 0 });
  });
});
